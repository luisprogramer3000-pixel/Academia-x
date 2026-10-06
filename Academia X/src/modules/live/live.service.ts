import { createHash, randomBytes, randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Quiz en vivo.
 *
 * El profesor controla el avance (lobby → pregunta → revelar → ... → fin) y los
 * alumnos se unen con un código y un apodo, sin cuenta. Cada alumno recibe un
 * token aleatorio que solo guarda su navegador; en base de datos va el hash.
 * La opción correcta no sale del servidor hasta que el profesor la revela.
 */

export type LiveStatus = "LOBBY" | "QUESTION" | "REVEAL" | "ENDED";

export interface LiveQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export class LiveError extends Error {}

const MAX_QUESTIONS = 30;
const MAX_PARTICIPANTS = 300;
const GRACE_MS = 1500;
const BASE_POINTS = 500;
const SPEED_POINTS = 500;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/**
 * Parte común del estado (pregunta, estado, participantes, ranking): es la misma
 * para todos los alumnos de una partida, así que se calcula como mucho una vez
 * por SHARED_TTL_MS y se reutiliza. Con 30 alumnos sondeando cada 1,5 s son ~20
 * peticiones por segundo que antes repetían 4 consultas cada una.
 * Caché en memoria del proceso: si hay varias instancias, cada una tiene la suya
 * (solo baja el ahorro). El retraso máximo (≈1 s) es menor que el intervalo de sondeo.
 */
const SHARED_TTL_MS = 900;
const MAX_CACHED_SESSIONS = 500;
type SharedState = Awaited<ReturnType<typeof loadSharedState>>;
const sharedCache = new Map<string, { at: number; value: Promise<SharedState> }>();

async function loadSharedState(code: string) {
  const s = await prisma.liveSession.findUnique({
    where: { code },
    select: { id: true, title: true, status: true, currentIndex: true, questionStartedAt: true, timeLimitSec: true, questions: true },
  });
  if (!s) return null;
  const revealed = s.status === "REVEAL" || s.status === "ENDED";
  const [participants, leaderboard] = await Promise.all([
    prisma.liveParticipant.count({ where: { sessionId: s.id } }),
    revealed
      ? prisma.liveParticipant.findMany({
          where: { sessionId: s.id },
          orderBy: [{ score: "desc" }, { createdAt: "asc" }],
          take: 5,
          select: { id: true, nickname: true, score: true },
        })
      : Promise.resolve([]),
  ]);
  return { session: s, questions: questionsOf(s), revealed, participants, leaderboard };
}

function sharedState(code: string): Promise<SharedState> {
  const now = Date.now();
  const hit = sharedCache.get(code);
  if (hit && now - hit.at < SHARED_TTL_MS) return hit.value;

  if (sharedCache.size >= MAX_CACHED_SESSIONS) {
    for (const [key, entry] of sharedCache) if (now - entry.at >= SHARED_TTL_MS) sharedCache.delete(key);
    if (sharedCache.size >= MAX_CACHED_SESSIONS) sharedCache.clear();
  }
  // Se guarda la promesa: las peticiones simultáneas comparten la misma consulta
  const value = loadSharedState(code);
  sharedCache.set(code, { at: now, value });
  value.catch(() => sharedCache.delete(code));
  return value;
}

/** Al cambiar el estado (siguiente, revelar, fin) los alumnos lo ven en el siguiente sondeo. */
function invalidateShared(code: string) {
  sharedCache.delete(code);
}

export function normalizeCode(code: string) {
  return code.replace(/\D/g, "").slice(0, 6);
}

function questionsOf(session: { questions: Prisma.JsonValue }): LiveQuestion[] {
  return (session.questions as unknown as LiveQuestion[]) ?? [];
}

function secondsLeft(s: { status: string; questionStartedAt: Date | null; timeLimitSec: number }) {
  if (s.status !== "QUESTION" || !s.questionStartedAt) return 0;
  const left = s.timeLimitSec - (Date.now() - s.questionStartedAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(left));
}

export class LiveService {
  static async createSession(input: {
    tenantId: string;
    hostUserId: string;
    title: string;
    resourceId?: string;
    questions: LiveQuestion[];
    timeLimitSec: number;
  }) {
    const questions = input.questions
      .filter((q) => q.options.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.options.length)
      .slice(0, MAX_QUESTIONS)
      .map((q) => ({ prompt: q.prompt, options: q.options.slice(0, 6), correctIndex: q.correctIndex, explanation: q.explanation }));
    if (questions.length === 0) throw new LiveError("Este recurso no tiene preguntas de opción múltiple.");

    for (let attempt = 0; attempt < 10; attempt++) {
      const code = String(randomInt(100000, 1000000));
      try {
        return await prisma.liveSession.create({
          data: {
            tenantId: input.tenantId,
            hostUserId: input.hostUserId,
            resourceId: input.resourceId ?? null,
            code,
            title: input.title.slice(0, 200),
            questions: questions as unknown as Prisma.InputJsonValue,
            timeLimitSec: input.timeLimitSec,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    throw new LiveError("No se pudo generar un código. Inténtalo de nuevo.");
  }

  /** Avanza el estado. Las transiciones inválidas se ignoran (dos clics seguidos, etc.). */
  static async control(sessionId: string, tenantId: string, action: "next" | "reveal" | "end") {
    const s = await prisma.liveSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!s) throw new LiveError("Sesión no encontrada.");
    invalidateShared(s.code);
    const total = questionsOf(s).length;

    if (action === "end" || (action === "next" && s.status === "REVEAL" && s.currentIndex >= total - 1)) {
      if (s.status !== "ENDED") await prisma.liveSession.update({ where: { id: s.id }, data: { status: "ENDED", endedAt: new Date() } });
      return;
    }
    if (action === "reveal" && s.status === "QUESTION") {
      await prisma.liveSession.updateMany({ where: { id: s.id, status: "QUESTION" }, data: { status: "REVEAL" } });
      return;
    }
    if (action === "next" && (s.status === "LOBBY" || s.status === "REVEAL")) {
      await prisma.liveSession.updateMany({
        where: { id: s.id, status: s.status, currentIndex: s.currentIndex },
        data: { status: "QUESTION", currentIndex: s.currentIndex + 1, questionStartedAt: new Date() },
      });
    }
  }

  static async join(rawCode: string, rawNickname: string) {
    const code = normalizeCode(rawCode);
    const nickname = rawNickname.replace(/\s+/g, " ").trim().slice(0, 20);
    if (nickname.length < 2) throw new LiveError("Escribe un apodo de al menos 2 letras.");

    const s = await prisma.liveSession.findUnique({ where: { code }, select: { id: true, status: true, _count: { select: { participants: true } } } });
    if (!s || s.status === "ENDED") throw new LiveError("No hay ningún juego activo con ese código.");
    if (s._count.participants >= MAX_PARTICIPANTS) throw new LiveError("La partida está llena.");

    const token = randomBytes(24).toString("hex");
    try {
      const p = await prisma.liveParticipant.create({ data: { sessionId: s.id, nickname, tokenHash: hashToken(token) } });
      return { participantId: p.id, token, nickname };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new LiveError("Ese apodo ya está en uso. Elige otro.");
      throw e;
    }
  }

  private static async participant(sessionId: string, participantId?: string | null, token?: string | null) {
    if (!participantId || !token) return null;
    const p = await prisma.liveParticipant.findFirst({ where: { id: participantId, sessionId } });
    return p && p.tokenHash === hashToken(token) ? p : null;
  }

  static async answer(rawCode: string, participantId: string, token: string, questionIndex: number, selected: number) {
    const s = await prisma.liveSession.findUnique({ where: { code: normalizeCode(rawCode) } });
    if (!s) throw new LiveError("Partida no encontrada.");
    const p = await LiveService.participant(s.id, participantId, token);
    if (!p) throw new LiveError("Vuelve a unirte a la partida.");
    if (s.status !== "QUESTION" || s.currentIndex !== questionIndex || !s.questionStartedAt) throw new LiveError("Esta pregunta ya se cerró.");

    const q = questionsOf(s)[questionIndex];
    if (!q || selected < 0 || selected >= q.options.length) throw new LiveError("Opción no válida.");

    const elapsed = Date.now() - s.questionStartedAt.getTime();
    const limitMs = s.timeLimitSec * 1000;
    if (elapsed > limitMs + GRACE_MS) throw new LiveError("Se acabó el tiempo.");

    const correct = selected === q.correctIndex;
    const speed = Math.max(0, 1 - Math.min(elapsed, limitMs) / limitMs);
    const points = correct ? Math.round(BASE_POINTS + SPEED_POINTS * speed) : 0;

    try {
      await prisma.$transaction([
        prisma.liveAnswer.create({ data: { sessionId: s.id, participantId: p.id, questionIndex, selected, correct, points } }),
        prisma.liveParticipant.update({ where: { id: p.id }, data: { score: { increment: points } } }),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new LiveError("Ya respondiste esta pregunta.");
      throw e;
    }
    return { ok: true };
  }

  /**
   * Datos del alumno en UNA consulta: su fila, su posición y su respuesta a la
   * pregunta actual (antes eran tres consultas encadenadas).
   */
  private static async playerRow(sessionId: string, participantId: string, questionIndex: number) {
    const rows = await prisma.$queryRaw<
      Array<{ nickname: string; score: number; tokenHash: string; rank: bigint; selected: number | null; correct: boolean | null; points: number | null; answered: boolean }>
    >`
      SELECT p."nickname", p."score", p."tokenHash",
             (SELECT count(*) FROM "LiveParticipant" o WHERE o."sessionId" = p."sessionId" AND o."score" > p."score") AS "rank",
             a."selected", a."correct", a."points", (a."id" IS NOT NULL) AS "answered"
      FROM "LiveParticipant" p
      LEFT JOIN "LiveAnswer" a ON a."participantId" = p."id" AND a."questionIndex" = ${questionIndex}
      WHERE p."id" = ${participantId} AND p."sessionId" = ${sessionId}
      LIMIT 1`;
    return rows[0] ?? null;
  }

  /** Vista del alumno: nunca incluye la respuesta correcta antes de revelarla. */
  static async playerState(rawCode: string, participantId?: string | null, token?: string | null) {
    const shared = await sharedState(normalizeCode(rawCode));
    if (!shared) return null;
    const { session: s, questions, revealed } = shared;
    const q = s.currentIndex >= 0 ? questions[s.currentIndex] : undefined;

    let me = null;
    if (participantId && token) {
      const row = await LiveService.playerRow(s.id, participantId, s.currentIndex);
      if (row && row.tokenHash === hashToken(token)) {
        me = {
          nickname: row.nickname,
          score: row.score,
          rank: Number(row.rank) + 1,
          answered: row.answered,
          selected: row.selected ?? null,
          // El resultado de la pregunta solo se muestra al revelarla
          lastCorrect: revealed && row.answered ? row.correct : null,
          lastPoints: revealed && row.answered ? row.points : null,
        };
      }
    }

    return {
      title: s.title,
      status: s.status as LiveStatus,
      index: s.currentIndex,
      total: questions.length,
      secondsLeft: secondsLeft(s),
      timeLimitSec: s.timeLimitSec,
      question: q && s.status !== "LOBBY" ? { prompt: q.prompt, options: q.options } : null,
      correctIndex: revealed && q ? q.correctIndex : null,
      explanation: revealed && q ? q.explanation : null,
      participants: shared.participants,
      leaderboard: shared.leaderboard,
      me,
    };
  }

  static async hostState(sessionId: string, tenantId: string) {
    const s = await prisma.liveSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!s) return null;
    const questions = questionsOf(s);
    const q = s.currentIndex >= 0 ? questions[s.currentIndex] : undefined;

    const [participants, answers] = await Promise.all([
      prisma.liveParticipant.findMany({
        where: { sessionId: s.id },
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        select: { id: true, nickname: true, score: true },
      }),
      s.currentIndex >= 0
        ? prisma.liveAnswer.groupBy({ by: ["selected"], where: { sessionId: s.id, questionIndex: s.currentIndex }, _count: { _all: true } })
        : [],
    ]);

    const distribution = q ? q.options.map((_, i) => answers.find((a) => a.selected === i)?._count._all ?? 0) : [];

    return {
      id: s.id,
      code: s.code,
      title: s.title,
      status: s.status as LiveStatus,
      index: s.currentIndex,
      total: questions.length,
      secondsLeft: secondsLeft(s),
      timeLimitSec: s.timeLimitSec,
      resourceId: s.resourceId,
      question: q ?? null,
      answeredCount: distribution.reduce((a, b) => a + b, 0),
      distribution,
      participants,
    };
  }
}

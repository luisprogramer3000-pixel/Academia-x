import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * Corrección de quizzes.
 *
 * Regla que sostiene todo el módulo: **la respuesta correcta nunca sale del
 * servidor**. El navegador del alumno recibe el enunciado y las opciones, pero
 * no cuál es la buena; y la nota se calcula aquí contra el contenido guardado
 * en base de datos, no contra lo que diga el cliente.
 */

export interface QuizBlock {
  id: string;
  question: string;
  options: string[];
  correctOptionIndex: number;
}

export interface QuizAnswerResult {
  blockId: string;
  selected: number;
  correct: boolean;
  correctOptionIndex: number;
}

export interface QuizGradeResult {
  score: number;
  correctCount: number;
  totalQuestions: number;
  results: QuizAnswerResult[];
}

/** Extrae los bloques de quiz de una lección, con sus respuestas. */
export function extractQuizBlocks(contentJson: string | null | undefined): QuizBlock[] {
  if (!contentJson) return [];
  try {
    const parsed = JSON.parse(contentJson);
    const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : Array.isArray(parsed) ? parsed : [];
    return blocks
      .filter(
        (b: Record<string, unknown>) =>
          b?.type === "quiz" && typeof b.question === "string" && Array.isArray(b.options) && b.options.length > 0
      )
      .map((b: Record<string, unknown>) => ({
        id: String(b.id),
        question: String(b.question),
        options: (b.options as string[]).map(String),
        correctOptionIndex: typeof b.correctOptionIndex === "number" ? b.correctOptionIndex : 0,
      }));
  } catch {
    return [];
  }
}

/**
 * Devuelve el contenido de la lección SIN las respuestas correctas, listo para
 * enviarlo al navegador del alumno.
 */
export function stripQuizAnswers(contentJson: string | null | undefined): string | null {
  if (!contentJson) return contentJson ?? null;
  try {
    const parsed = JSON.parse(contentJson);
    const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : Array.isArray(parsed) ? parsed : null;
    if (!blocks) return contentJson;

    const safeBlocks = blocks.map((b: Record<string, unknown>) => {
      if (b?.type !== "quiz") return b;
      const { correctOptionIndex, explanation, ...rest } = b;
      void correctOptionIndex;
      void explanation;
      return rest;
    });

    return JSON.stringify(Array.isArray(parsed.blocks) ? { ...parsed, blocks: safeBlocks } : safeBlocks);
  } catch {
    return contentJson;
  }
}

/** Corrige las respuestas contra el contenido real de la lección. */
export function gradeQuiz(blocks: QuizBlock[], answers: Record<string, number>): QuizGradeResult {
  const results: QuizAnswerResult[] = blocks.map((block) => {
    const selected = answers[block.id];
    return {
      blockId: block.id,
      selected: typeof selected === "number" ? selected : -1,
      correct: selected === block.correctOptionIndex,
      correctOptionIndex: block.correctOptionIndex,
    };
  });

  const correctCount = results.filter((r) => r.correct).length;
  const totalQuestions = blocks.length;

  return {
    score: totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0,
    correctCount,
    totalQuestions,
    results,
  };
}

export class QuizService {
  /** Corrige y guarda el intento de un alumno. */
  static async submitAttempt(input: {
    tenantId: string;
    lessonId: string;
    userId: string;
    answers: Record<string, number>;
  }): Promise<QuizGradeResult> {
    const lesson = await prisma.lesson.findUnique({
      where: { id: input.lessonId },
      select: { content: true },
    });
    if (!lesson) throw new Error("Lección no encontrada.");

    const blocks = extractQuizBlocks(lesson.content);
    if (blocks.length === 0) throw new Error("Esta lección no tiene preguntas.");

    const grade = gradeQuiz(blocks, input.answers);

    await prisma.quizAttempt.create({
      data: {
        tenantId: input.tenantId,
        lessonId: input.lessonId,
        userId: input.userId,
        score: grade.score,
        correctCount: grade.correctCount,
        totalQuestions: grade.totalQuestions,
        // Prisma espera JSON plano: el array tipado se serializa explícitamente
        answers: grade.results as unknown as Prisma.InputJsonValue,
      },
    });

    return grade;
  }

  /** Último intento del alumno en una lección (para no repetir el examen sin querer). */
  static async getLastAttempt(lessonId: string, userId: string) {
    return prisma.quizAttempt.findFirst({
      where: { lessonId, userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Resultados de todos los alumnos en una lección, para el profesor. */
  static async getLessonResults(tenantId: string, lessonId: string) {
    const attempts = await prisma.quizAttempt.findMany({
      where: { tenantId, lessonId },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Un alumno puede intentarlo varias veces: al profesor le interesa el último
    const latestByUser = new Map<string, (typeof attempts)[number]>();
    for (const attempt of attempts) {
      if (!latestByUser.has(attempt.userId)) latestByUser.set(attempt.userId, attempt);
    }

    const latest = Array.from(latestByUser.values());
    const average =
      latest.length > 0 ? Math.round(latest.reduce((sum, a) => sum + a.score, 0) / latest.length) : 0;

    return { attempts: latest, totalAttempts: attempts.length, average };
  }
}

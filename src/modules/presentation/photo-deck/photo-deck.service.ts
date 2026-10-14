import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AIService } from "@/modules/ai/ai.service";
import { extractLessonContent } from "../engine/planner/extract";
import { planFromContent, type TextDensity } from "../engine/planner/heuristic";
import { planWithLlm } from "../engine/planner/llm";
import { loadImage } from "../engine/sources";
import { deckScriptSchema, photoPrompt, planToScript, type DeckScript, type ScriptSlide } from "./script";
import { enrichScript } from "./enrich";
import { renderPhotoDeck, type DeckPhoto } from "./render";

export class PhotoDeckError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "PhotoDeckError";
  }
}

/** Lección de la academia, con lo que necesita el planificador. */
async function loadLesson(tenantId: string, lessonId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { tenantId } } },
    select: {
      title: true,
      content: true,
      teacherPlan: true,
      module: { select: { course: { select: { title: true, level: true, language: true, tenant: { select: { name: true, primaryColor: true } } } } } },
    },
  });
  if (!lesson) throw new PhotoDeckError("Lección no encontrada.", 404);
  let blocks: unknown[] = [];
  try {
    const parsed = JSON.parse(lesson.content || "{}");
    blocks = Array.isArray(parsed.blocks) ? parsed.blocks : Array.isArray(parsed) ? parsed : [];
  } catch {
    blocks = [];
  }
  return { lesson, blocks };
}

async function getDeckOrThrow(tenantId: string, deckId: string) {
  const deck = await prisma.photoDeck.findFirst({ where: { id: deckId, tenantId } });
  if (!deck) throw new PhotoDeckError("Presentación no encontrada.", 404);
  return deck;
}

export class PhotoDeckService {
  /**
   * Paso 1: la IA escribe el guion con el planificador del motor (objetivos,
   * clasificación real, lectura y ejercicios). Cobra el guion (2 créditos); si
   * la IA falla se usa el planificador interno y se devuelven los créditos.
   */
  static async createFromLesson(input: {
    tenantId: string;
    userId: string;
    lessonId: string;
    density: TextDensity;
    targetSlides?: number;
    idempotencyKey: string;
  }) {
    const { lesson, blocks } = await loadLesson(input.tenantId, input.lessonId);
    const course = lesson.module.course;
    const content = extractLessonContent({
      lessonId: input.lessonId,
      title: lesson.title,
      courseTitle: course.title,
      academyName: course.tenant.name,
      language: course.language || "es",
      level: course.level,
      blocks: blocks as never,
      teacherPlan: (lesson.teacherPlan as never) ?? null,
    });

    const planner = await AIService.presentationPlanner({
      tenantId: input.tenantId,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      lessonId: input.lessonId,
    });
    // El planificador genera la clase completa; el recorte lo hace planToScript
    // (12 por defecto, ~18 créditos) protegiendo lectura y ejercicios
    const opts = { density: input.density, designMode: "SMART_DESIGN" as const };
    let plan;
    let usedLlm = true;
    try {
      plan = await planWithLlm(content, planner.call, opts);
    } catch (error) {
      console.warn("[photo-deck] La IA no devolvió un plan válido; se usa el planificador interno:", error);
      usedLlm = false;
      plan = planFromContent(content, opts);
    }
    let script = planToScript(plan, content, input.targetSlides ?? 12);
    // Escenas de las fotos y resaltado de palabras clave (mismo cobro del guion)
    if (usedLlm) script = await enrichScript(script, planner.call, { topic: lesson.title, level: course.level ?? undefined, language: course.language || "es" });
    await planner.finish(usedLlm).catch(() => undefined);

    return prisma.photoDeck.create({
      data: {
        tenantId: input.tenantId,
        lessonId: input.lessonId,
        userId: input.userId,
        title: script.title,
        script: script as unknown as Prisma.InputJsonValue,
      },
    });
  }

  static async get(tenantId: string, deckId: string) {
    const deck = await getDeckOrThrow(tenantId, deckId);
    return { ...deck, script: deck.script as unknown as DeckScript };
  }

  /** La última presentación con fotos de una lección (para continuar donde se quedó). */
  static async latestForLesson(tenantId: string, lessonId: string) {
    return prisma.photoDeck.findFirst({ where: { tenantId, lessonId }, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true, updatedAt: true } });
  }

  /**
   * Paso 2: guarda el guion revisado. Las fotos solo se conservan si son las
   * que ya tenía esa diapositiva (nadie puede colar una URL ajena).
   */
  static async saveScript(tenantId: string, deckId: string, input: unknown) {
    const deck = await getDeckOrThrow(tenantId, deckId);
    const parsed = deckScriptSchema.parse(input);
    const previous = new Map((deck.script as unknown as DeckScript).slides.map((s) => [s.id, s]));
    const slides = parsed.slides.map((s) => {
      const before = previous.get(s.id);
      const keep = Boolean(s.imageUrl && before?.imageUrl === s.imageUrl);
      return { ...s, imageUrl: keep ? s.imageUrl : undefined, imageSource: keep ? before?.imageSource : undefined };
    });
    const script: DeckScript = { title: parsed.title, slides };
    await prisma.photoDeck.update({
      where: { id: deck.id },
      data: { title: script.title, script: script as unknown as Prisma.InputJsonValue, status: slides.every((s) => s.imageUrl) ? "READY" : "SCRIPT" },
    });
    return script;
  }

  /**
   * Paso 3: genera (o, con `instruction`, cambia) la foto de UNA diapositiva.
   * Se llama una vez por diapositiva y en paralelo desde el navegador.
   */
  static async generatePhoto(input: { tenantId: string; userId: string; deckId: string; slideId: string; instruction?: string; requestId: string }) {
    const deck = await getDeckOrThrow(input.tenantId, input.deckId);
    const script = deck.script as unknown as DeckScript;
    const slide = script.slides.find((s) => s.id === input.slideId);
    if (!slide) throw new PhotoDeckError("Diapositiva no encontrada.", 404);

    const instruction = input.instruction?.trim().slice(0, 500);
    let edit: { instruction: string; reference: Buffer; referenceMime: string } | undefined;
    if (instruction) {
      if (!slide.imageUrl) throw new PhotoDeckError("Primero genera la foto de esta diapositiva.");
      const current = await loadImage(slide.imageUrl);
      if (!current) throw new PhotoDeckError("No se pudo leer la foto actual.");
      edit = { instruction, reference: Buffer.from(current.data), referenceMime: current.mime };
    }

    const lessonTitle = deck.title;
    const url = await AIService.generateDeckPhoto({
      tenantId: input.tenantId,
      userId: input.userId,
      prompt: photoPrompt(slide, { topic: lessonTitle }),
      quality: slide.photo === "realistic" ? "hq" : "standard",
      aspectRatio: slide.type === "cover" ? "16:9" : "3:4",
      idempotencyKey: `photodeck:${deck.id}:${slide.id}:${input.requestId}`,
      edit,
    });

    // Varias fotos llegan a la vez: se actualiza el guion con la fila bloqueada
    await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ script: unknown }>>`SELECT "script" FROM "PhotoDeck" WHERE "id" = ${deck.id} FOR UPDATE`;
      const latest = rows[0]?.script as DeckScript | undefined;
      if (!latest) return;
      const slides = latest.slides.map((s) => (s.id === slide.id ? { ...s, imageUrl: url, imageSource: "ai" as const } : s));
      await tx.photoDeck.update({
        where: { id: deck.id },
        data: { script: { ...latest, slides } as unknown as Prisma.InputJsonValue, status: slides.every((s) => s.imageUrl) ? "READY" : "SCRIPT" },
      });
    });
    return { slideId: slide.id, imageUrl: url };
  }

  /** Paso 4: arma el PowerPoint con las fotos y el texto real. */
  static async buildPptx(tenantId: string, deckId: string) {
    const deck = await getDeckOrThrow(tenantId, deckId);
    const script = deck.script as unknown as DeckScript;
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, primaryColor: true } });
    const photos = new Map<string, DeckPhoto>();
    await Promise.all(
      script.slides.map(async (s: ScriptSlide) => {
        if (!s.imageUrl) return;
        const img = await loadImage(s.imageUrl).catch(() => null);
        if (img) photos.set(s.id, { data: Buffer.from(img.data), mime: img.mime, width: img.width, height: img.height });
      })
    );
    const file = await renderPhotoDeck(script, photos, { academyName: tenant.name, primary: tenant.primaryColor || "#2563EB" });
    return { file, title: script.title, missingPhotos: script.slides.filter((s) => !s.imageUrl).length };
  }
}

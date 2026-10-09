import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AIService } from "@/modules/ai/ai.service";
import { planToLessonBlocks, planToTeacherPlan } from "@/modules/resources/plan-to-lesson";

/**
 * Desarrollo de las lecciones de un curso con IA, después de que la IA propuso
 * la estructura (que solo crea los títulos).
 *
 * - "full": Agente de Clase (6 créditos): clase completa con explicación,
 *   lectura, actividades, ejercicios y el plan del profesor.
 * - "basic": contenido de la lección (2 créditos): explicación y bloques.
 *
 * Nunca sobrescribe una lección que ya tenga contenido.
 */
export type DevelopMode = "full" | "basic";
export const DEVELOP_CREDITS: Record<DevelopMode, number> = { full: 6, basic: 2 };

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Español", en: "Inglés", fr: "Francés", de: "Alemán", it: "Italiano", pt: "Portugués", zh: "Chino", ja: "Japonés",
};

export class LessonDevelopError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "LessonDevelopError";
  }
}

/** Bloque que deja el Copiloto IA al crear un curso: solo una frase de resumen, no es una clase. */
const PLACEHOLDER_TITLE = "Resumen Generado por IA";

/**
 * true si la lección está por desarrollar: sin bloques, o solo con el resumen
 * automático que el Copiloto IA pone al generar el curso.
 */
export function isLessonEmpty(content: string | null): boolean {
  if (!content) return true;
  try {
    const parsed = JSON.parse(content);
    const blocks: Array<{ title?: string }> = Array.isArray(parsed?.blocks) ? parsed.blocks : Array.isArray(parsed) ? parsed : [];
    return blocks.every((b) => b?.title === PLACEHOLDER_TITLE);
  } catch {
    return !content.trim();
  }
}

export async function developLesson(input: { tenantId: string; userId: string; lessonId: string; mode: DevelopMode; idempotencyKey: string }) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: input.lessonId, module: { course: { tenantId: input.tenantId } } },
    select: {
      id: true,
      title: true,
      content: true,
      module: { select: { title: true, course: { select: { id: true, title: true, level: true, language: true, description: true } } } },
    },
  });
  if (!lesson) throw new LessonDevelopError("Lección no encontrada.", 404);
  if (!isLessonEmpty(lesson.content)) return { lessonId: lesson.id, skipped: true as const };

  const course = lesson.module.course;
  const languageName = LANGUAGE_NAMES[(course.language || "es").slice(0, 2).toLowerCase()] ?? "Español";
  const context = [
    `Curso «${course.title}», nivel ${course.level || "B1"}.`,
    `Esta clase pertenece al módulo «${lesson.module.title}».`,
    course.description ? `Descripción del curso: ${course.description.slice(0, 900)}` : "",
    "Incluye siempre una lectura de comprensión y ejercicios con sus respuestas.",
  ].filter(Boolean).join(" ");

  if (input.mode === "basic") {
    await AIService.generateLessonContentAI({
      tenantId: input.tenantId,
      userId: input.userId,
      lessonId: lesson.id,
      topic: `${lesson.title} (${lesson.module.title})`,
      level: course.level || "B1",
      language: course.language || "es",
      lessonTitle: lesson.title,
      idempotencyKey: input.idempotencyKey,
    });
    return { lessonId: lesson.id, skipped: false as const };
  }

  const plan = await AIService.generateClassPlanAI({
    tenantId: input.tenantId,
    userId: input.userId,
    idempotencyKey: input.idempotencyKey,
    topic: lesson.title,
    grade: `Nivel ${course.level || "B1"}`,
    subject: course.title.slice(0, 120),
    durationMinutes: 60,
    methodology: "Aprendizaje activo",
    methodologyId: "comunicativo",
    language: languageName,
    competencies: [],
    context: context.slice(0, 2000),
  });

  // Puede haber cambiado mientras la IA escribía: no se pisa contenido nuevo
  const fresh = await prisma.lesson.findUnique({ where: { id: lesson.id }, select: { content: true } });
  if (!isLessonEmpty(fresh?.content ?? null)) return { lessonId: lesson.id, skipped: true as const };

  await prisma.lesson.update({
    where: { id: lesson.id },
    data: {
      content: JSON.stringify({ aiGenerated: true, blocks: planToLessonBlocks(plan) }),
      teacherPlan: planToTeacherPlan(plan) as Prisma.InputJsonValue,
    },
  });
  return { lessonId: lesson.id, skipped: false as const };
}

"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenantAccess, STAFF_ROLES, assertLessonInTenant } from "@/lib/session";
import { QuizService, extractQuizBlocks } from "@/modules/course/quiz.service";
import { revalidatePath } from "next/cache";

const answersSchema = z.record(z.string().max(80), z.number().int().min(0).max(20));

/**
 * El alumno envía sus respuestas. La nota se calcula en el servidor contra el
 * contenido guardado: lo que llegue del navegador solo indica qué opción marcó.
 */
export async function submitQuizAttemptAction(lessonId: string, answers: unknown) {
  try {
    const { tenantId, userId } = await requireTenantAccess();
    await assertLessonInTenant(lessonId, tenantId);

    const validated = answersSchema.parse(answers);
    const grade = await QuizService.submitAttempt({ tenantId, lessonId, userId, answers: validated });

    revalidatePath("/campus");
    return { success: true, ...grade };
  } catch (error: any) {
    return { success: false, error: error?.errors?.[0]?.message || error.message || "No se pudo corregir el examen." };
  }
}

const checkSchema = z.object({ blockId: z.string().min(1).max(80), selected: z.number().int().min(0).max(20) });

/**
 * Corrige UNA actividad intercalada en la lección, para dar feedback inmediato.
 * La respuesta correcta solo se revela después de que el alumno haya respondido;
 * la nota que ve el profesor se guarda al final con submitQuizAttemptAction.
 */
export async function checkQuizAnswerAction(lessonId: string, blockId: string, selected: number) {
  try {
    const { tenantId } = await requireTenantAccess();
    const lesson = await assertLessonInTenant(lessonId, tenantId);
    const input = checkSchema.parse({ blockId, selected });

    const full = await prisma.lesson.findUnique({ where: { id: lesson.id }, select: { content: true } });
    const block = extractQuizBlocks(full?.content).find((b) => b.id === input.blockId);
    if (!block) return { success: false as const, error: "Actividad no encontrada." };

    return {
      success: true as const,
      correct: input.selected === block.correctOptionIndex,
      correctOptionIndex: block.correctOptionIndex,
      explanation: extractExplanation(full?.content, input.blockId),
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || "No se pudo comprobar la respuesta." };
  }
}

function extractExplanation(contentJson: string | null | undefined, blockId: string): string {
  try {
    const parsed = JSON.parse(contentJson || "");
    const blocks: Array<Record<string, unknown>> = Array.isArray(parsed.blocks) ? parsed.blocks : Array.isArray(parsed) ? parsed : [];
    const b = blocks.find((x) => String(x?.id) === blockId);
    return typeof b?.explanation === "string" ? b.explanation : "";
  } catch {
    return "";
  }
}

/** Resultados de la lección para el profesor. */
export async function getQuizResultsAction(lessonId: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await assertLessonInTenant(lessonId, tenantId);

    const data = await QuizService.getLessonResults(tenantId, lessonId);
    return {
      success: true,
      average: data.average,
      totalAttempts: data.totalAttempts,
      students: data.attempts.map((a) => ({
        userId: a.userId,
        name: a.user.name || a.user.email,
        score: a.score,
        correctCount: a.correctCount,
        totalQuestions: a.totalQuestions,
        date: a.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudieron cargar los resultados." };
  }
}

/** Último intento del alumno, para mostrar su nota al volver a la lección. */
export async function getMyLastAttemptAction(lessonId: string) {
  try {
    const { tenantId, userId } = await requireTenantAccess();
    await assertLessonInTenant(lessonId, tenantId);
    const attempt = await QuizService.getLastAttempt(lessonId, userId);
    if (!attempt) return { success: true, attempt: null };
    return {
      success: true,
      attempt: {
        score: attempt.score,
        correctCount: attempt.correctCount,
        totalQuestions: attempt.totalQuestions,
        date: attempt.createdAt.toISOString(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

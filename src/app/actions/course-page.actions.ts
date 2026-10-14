"use server";

import { z } from "zod";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { requireActiveSubscription } from "@/modules/billing/entitlements";
import { AIService } from "@/modules/ai/ai.service";
import { getMaterialTool, type MaterialToolId } from "@/modules/ai/material-tools";
import { planToLessonBlocks, readResourceData } from "@/modules/resources/plan-to-lesson";

/**
 * "Añadir página" del builder: inserta una lección justo después de otra, en
 * blanco o generada con una de las Herramientas IA (quiz, lectura, flashcards...).
 */

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Español", en: "Inglés", fr: "Francés", pt: "Portugués", it: "Italiano", de: "Alemán",
};

const placeSchema = z.object({
  moduleId: z.string().min(1),
  afterLessonId: z.string().min(1).nullable(),
});

/** Módulo del tenant + posición (1..n) que tendrá la nueva lección. */
async function resolvePlace(tenantId: string, input: unknown) {
  const { moduleId, afterLessonId } = placeSchema.parse(input);
  const mod = await prisma.module.findFirst({
    where: { id: moduleId, course: { tenantId, deletedAt: null } },
    select: {
      id: true,
      courseId: true,
      course: { select: { title: true, level: true, language: true } },
      lessons: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true } },
    },
  });
  if (!mod) throw new Error("Módulo no encontrado en tu academia.");
  const index = afterLessonId ? mod.lessons.findIndex((l) => l.id === afterLessonId) : mod.lessons.length - 1;
  if (afterLessonId && index < 0) throw new Error("La lección de referencia ya no existe.");
  return { mod, position: index + 1 };
}

/** Crea la lección en la posición indicada renumerando el módulo (los órdenes antiguos pueden repetirse). */
async function insertLesson(
  mod: { id: string; lessons: Array<{ id: string }> },
  position: number,
  data: { title: string; content: string }
) {
  return prisma.$transaction(async (tx) => {
    const ids = mod.lessons.map((l) => l.id);
    await Promise.all(ids.map((id, i) => tx.lesson.update({ where: { id }, data: { order: i < position ? i + 1 : i + 2 } })));
    return tx.lesson.create({ data: { moduleId: mod.id, title: data.title.slice(0, 150), order: position + 1, content: data.content } });
  });
}

const blankSchema = z.object({ title: z.string().trim().min(2, "Escribe un título").max(150) });

export async function addBlankPageAction(input: { moduleId: string; afterLessonId: string | null; title: string }) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const { title } = blankSchema.parse(input);
    const { mod, position } = await resolvePlace(tenantId, input);
    const lesson = await insertLesson(mod, position, { title, content: JSON.stringify({ blocks: [] }) });
    revalidatePath(`/dashboard/courses/${mod.courseId}/builder`);
    return { success: true as const, lessonId: lesson.id, courseId: mod.courseId };
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "";
    return { success: false as const, error: message || "No se pudo añadir la página." };
  }
}

const toolSchema = z.object({
  toolId: z.string().refine((id) => Boolean(getMaterialTool(id)), "Herramienta no válida"),
  topic: z.string().trim().min(3, "Indica el tema").max(300),
  count: z.coerce.number().int().min(1).max(40),
  context: z.string().trim().max(2000).optional(),
});

export async function addToolPageAction(input: {
  moduleId: string;
  afterLessonId: string | null;
  toolId: string;
  topic: string;
  count: number;
  context?: string;
  idempotencyKey?: string;
}) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(tenantId);
    const data = toolSchema.parse(input);
    const { mod, position } = await resolvePlace(tenantId, input);
    const tool = getMaterialTool(data.toolId)!;

    const params = {
      toolId: data.toolId as MaterialToolId,
      topic: data.topic,
      grade: mod.course.level || "A1",
      subject: mod.course.title,
      language: LANGUAGE_NAMES[mod.course.language] ?? "Español",
      count: Math.min(data.count, tool.maxCount),
      context: data.context || undefined,
    };
    const { material } = await AIService.generateMaterialAI({
      tenantId,
      userId,
      idempotencyKey: input.idempotencyKey || crypto.randomUUID(),
      ...params,
    });

    // Se guarda también en "Mis recursos", como cualquier material de las Herramientas IA
    const title = material.title.slice(0, 150);
    const resource = await prisma.teachingResource.create({
      data: {
        tenantId,
        userId,
        kind: "MATERIAL",
        title,
        subject: params.subject.slice(0, 120),
        grade: params.grade,
        topic: params.topic,
        data: { tool: params.toolId, material } as unknown as Prisma.InputJsonValue,
      },
    });
    const { plan } = readResourceData("MATERIAL", resource.data, title);
    const lesson = await insertLesson(mod, position, { title, content: JSON.stringify({ blocks: planToLessonBlocks(plan) }) });
    await prisma.teachingResource.update({ where: { id: resource.id }, data: { lessonId: lesson.id } });

    revalidatePath(`/dashboard/courses/${mod.courseId}/builder`);
    revalidatePath("/dashboard/resources");
    return { success: true as const, lessonId: lesson.id, courseId: mod.courseId };
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : "";
    if (message === "INSUFFICIENT_AI_CREDITS") return { success: false as const, error: "No tienes créditos de IA suficientes." };
    if (!(error instanceof z.ZodError)) console.error("[course-page] Herramienta IA", error);
    // Fallos del proveedor de IA: el crédito ya se devolvió automáticamente
    if (/^(OPENAI|NVIDIA|AI)_|PROVIDER_ERROR/.test(message)) {
      return { success: false as const, error: "La IA no pudo generar la página. Se devolvió el crédito; inténtalo de nuevo." };
    }
    return { success: false as const, error: message || "No se pudo generar la página." };
  }
}

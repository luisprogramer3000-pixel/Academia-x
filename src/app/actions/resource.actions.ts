"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { ResourceService } from "@/modules/resources/resource.service";
import { safeExternalUrl } from "@/lib/utils";

async function findResource(id: string, tenantId: string) {
  const resource = await prisma.teachingResource.findFirst({ where: { id, tenantId } });
  if (!resource) throw new Error("Recurso no encontrado en tu academia.");
  return resource;
}

function fail(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? fallback };
  return { success: false as const, error: error instanceof Error ? error.message : fallback };
}

/** Mueve el recurso a la papelera (se puede restaurar durante 30 días). */
export async function deleteResourceAction(id: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const { TrashService } = await import("@/modules/course/trash.service");
    await TrashService.moveResourceToTrash(tenantId, id);
    revalidatePath("/dashboard/resources");
    revalidatePath("/dashboard/papelera");
    return { success: true as const };
  } catch (error) {
    return fail(error, "No se pudo eliminar el recurso.");
  }
}

export async function duplicateResourceAction(id: string) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    const r = await findResource(id, tenantId);
    const copy = await prisma.teachingResource.create({
      data: {
        tenantId,
        userId,
        kind: r.kind,
        title: `${r.title} (copia)`.slice(0, 200),
        subject: r.subject,
        grade: r.grade,
        topic: r.topic,
        data: r.data as Prisma.InputJsonValue,
      },
    });
    revalidatePath("/dashboard/resources");
    return { success: true as const, id: copy.id };
  } catch (error) {
    return fail(error, "No se pudo duplicar el recurso.");
  }
}

const renameSchema = z.string().trim().min(2, "El título es demasiado corto").max(200);

export async function renameResourceAction(id: string, title: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const r = await findResource(id, tenantId);
    const newTitle = renameSchema.parse(title);
    const stored = r.data as Record<string, unknown>;
    const data =
      r.kind === "MATERIAL"
        ? { ...stored, material: { ...(stored.material as Record<string, unknown>), title: newTitle } }
        : { ...stored, title: newTitle };
    await prisma.teachingResource.update({ where: { id }, data: { title: newTitle, data: data as Prisma.InputJsonValue } });
    revalidatePath("/dashboard/resources");
    revalidatePath(`/dashboard/resources/${id}`);
    return { success: true as const };
  } catch (error) {
    return fail(error, "No se pudo renombrar.");
  }
}

const convertSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("standalone") }),
  z.object({ mode: z.literal("module"), moduleId: z.string().min(1) }),
]);

/**
 * Convierte un plan de clase en una lección del campus: contenido + actividades
 * para el alumno, y el guion del profesor en el panel docente de la lección.
 */
export async function convertResourceToLessonAction(resourceId: string, target: unknown) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const r = await findResource(resourceId, tenantId);
    const dest = convertSchema.parse(target);
    const { courseId, lessonId } = await ResourceService.convertToLesson(r, tenantId, dest);

    revalidatePath("/dashboard/resources");
    revalidatePath("/dashboard/lessons");
    revalidatePath(`/dashboard/courses/${courseId}/builder`);
    return { success: true as const, courseId, lessonId };
  } catch (error) {
    return fail(error, "No se pudo crear la lección.");
  }
}

const scheduleSchema = z.object({
  title: z.string().trim().min(2, "Escribe un título").max(200),
  startsAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  groupName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(2000).optional(),
  resourceId: z.string().trim().optional(),
  // Enlace de la reunión online: solo https (Zoom, Meet, Teams...)
  meetingUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === "" || safeExternalUrl(v)?.startsWith("https://"), "El enlace de la reunión debe empezar por https://")
    .optional(),
});

export async function scheduleClassAction(input: unknown) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    const data = scheduleSchema.parse(input);
    if (data.resourceId) await findResource(data.resourceId, tenantId);

    const created = await prisma.scheduledClass.create({
      data: {
        tenantId,
        userId,
        title: data.title,
        startsAt: data.startsAt,
        durationMinutes: data.durationMinutes,
        groupName: data.groupName || null,
        notes: data.notes || null,
        resourceId: data.resourceId || null,
        meetingUrl: data.meetingUrl ? safeExternalUrl(data.meetingUrl) : null,
      },
    });
    revalidatePath("/dashboard/planner");
    revalidatePath("/dashboard");
    return { success: true as const, id: created.id };
  } catch (error) {
    return fail(error, "No se pudo programar la clase.");
  }
}

const statusSchema = z.enum(["SCHEDULED", "DONE", "CANCELLED"]);

/** Marca una clase como dada, cancelada o de nuevo programada. */
export async function setScheduledClassStatusAction(id: string, status: unknown) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const value = statusSchema.parse(status);
    const result = await prisma.scheduledClass.updateMany({ where: { id, tenantId }, data: { status: value } });
    if (result.count === 0) throw new Error("Clase no encontrada.");
    revalidatePath("/dashboard/planner");
    revalidatePath("/dashboard");
    return { success: true as const };
  } catch (error) {
    return fail(error, "No se pudo actualizar la clase.");
  }
}

export async function deleteScheduledClassAction(id: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const result = await prisma.scheduledClass.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) throw new Error("Clase no encontrada.");
    revalidatePath("/dashboard/planner");
    revalidatePath("/dashboard");
    return { success: true as const };
  } catch (error) {
    return fail(error, "No se pudo eliminar la clase.");
  }
}

"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenantAccess, STAFF_ROLES, assertLessonInTenant } from "@/lib/session";
import { safeExternalUrl } from "@/lib/utils";
import { revalidatePath } from "next/cache";

/**
 * Tareas por lección: el profesor las crea, el alumno entrega y el profesor
 * corrige. Toda comprobación de pertenencia pasa por el tenant de la sesión.
 */

const createAssignmentSchema = z.object({
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres").max(150),
  description: z.string().trim().min(5, "Describe qué debe hacer el alumno").max(5000),
  dueDate: z.string().optional(),
});

const submissionSchema = z.object({
  content: z.string().trim().max(10000),
  fileUrl: z.string().max(500).optional(),
});

const gradeSchema = z.object({
  grade: z.string().trim().max(20).optional(),
  feedback: z.string().trim().max(5000).optional(),
});

/** Comprueba que la tarea pertenece a la academia de la sesión. */
async function assertAssignmentInTenant(assignmentId: string, tenantId: string) {
  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, lesson: { module: { course: { tenantId, deletedAt: null } } } },
    select: { id: true, lessonId: true, lesson: { select: { module: { select: { courseId: true } } } } },
  });
  if (!assignment) throw new Error("Tarea no encontrada en tu academia.");
  return assignment;
}

export async function createAssignmentAction(lessonId: string, formData: FormData) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const lesson = await assertLessonInTenant(lessonId, tenantId);

    const validated = createAssignmentSchema.parse({
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      dueDate: (formData.get("dueDate") as string) || undefined,
    });

    // La fecha llega del navegador como YYYY-MM-DD: se guarda al final de ese día
    let dueDate: Date | null = null;
    if (validated.dueDate) {
      const parsed = new Date(`${validated.dueDate}T23:59:59`);
      if (!Number.isNaN(parsed.getTime())) dueDate = parsed;
    }

    await prisma.assignment.create({
      data: { lessonId, title: validated.title, description: validated.description, dueDate },
    });

    revalidatePath(`/dashboard/courses/${lesson.module.courseId}/lessons/${lessonId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.errors?.[0]?.message || error.message || "No se pudo crear la tarea." };
  }
}

export async function deleteAssignmentAction(assignmentId: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const assignment = await assertAssignmentInTenant(assignmentId, tenantId);

    await prisma.assignment.delete({ where: { id: assignmentId } });

    revalidatePath(`/dashboard/courses/${assignment.lesson.module.courseId}/lessons/${assignment.lessonId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo eliminar la tarea." };
  }
}

/** Tareas de una lección con sus entregas (vista del profesor). */
export async function getLessonAssignmentsAction(lessonId: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await assertLessonInTenant(lessonId, tenantId);

    const assignments = await prisma.assignment.findMany({
      where: { lessonId },
      orderBy: { createdAt: "asc" },
      include: {
        submissions: {
          orderBy: { createdAt: "desc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return {
      success: true,
      assignments: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate ? a.dueDate.toISOString() : null,
        submissions: a.submissions.map((s) => ({
          id: s.id,
          studentName: s.user.name || s.user.email,
          content: s.content,
          fileUrl: s.fileUrl,
          grade: s.grade,
          feedback: s.feedback,
          date: s.createdAt.toISOString(),
        })),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudieron cargar las tareas." };
  }
}

/** Tareas visibles para el alumno, con su propia entrega si ya la hizo. */
export async function getMyAssignmentsAction(lessonId: string) {
  try {
    const { tenantId, userId } = await requireTenantAccess();
    await assertLessonInTenant(lessonId, tenantId);

    const assignments = await prisma.assignment.findMany({
      where: { lessonId },
      orderBy: { createdAt: "asc" },
      include: { submissions: { where: { userId }, orderBy: { createdAt: "desc" }, take: 1 } },
    });

    return {
      success: true,
      assignments: assignments.map((a) => {
        const mine = a.submissions[0];
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          dueDate: a.dueDate ? a.dueDate.toISOString() : null,
          mySubmission: mine
            ? {
                id: mine.id,
                content: mine.content,
                fileUrl: mine.fileUrl,
                grade: mine.grade,
                feedback: mine.feedback,
                date: mine.createdAt.toISOString(),
              }
            : null,
        };
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudieron cargar las tareas." };
  }
}

/** El alumno entrega. Si ya había entregado, se guarda una entrega nueva. */
export async function submitAssignmentAction(assignmentId: string, formData: FormData) {
  try {
    const { tenantId, userId } = await requireTenantAccess();
    const assignment = await assertAssignmentInTenant(assignmentId, tenantId);

    const validated = submissionSchema.parse({
      content: (formData.get("content") as string) || "",
      fileUrl: (formData.get("fileUrl") as string) || undefined,
    });

    if (!validated.content && !validated.fileUrl) {
      return { success: false, error: "Escribe tu respuesta o adjunta un archivo." };
    }

    // El archivo solo puede ser uno subido a la plataforma, no un enlace externo
    const fileUrl = validated.fileUrl ? safeExternalUrl(validated.fileUrl) : null;
    if (validated.fileUrl && (!fileUrl || !fileUrl.startsWith("/api/uploads/"))) {
      return { success: false, error: "El archivo adjunto no es válido." };
    }

    await prisma.submission.create({
      data: { assignmentId, userId, content: validated.content, fileUrl },
    });

    revalidatePath(`/campus/courses/${assignment.lesson.module.courseId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.errors?.[0]?.message || error.message || "No se pudo entregar la tarea." };
  }
}

/** El profesor califica una entrega. */
export async function gradeSubmissionAction(submissionId: string, formData: FormData) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);

    const submission = await prisma.submission.findFirst({
      where: { id: submissionId, assignment: { lesson: { module: { course: { tenantId, deletedAt: null } } } } },
      select: { id: true, assignment: { select: { lessonId: true, lesson: { select: { module: { select: { courseId: true } } } } } } },
    });
    if (!submission) return { success: false, error: "Entrega no encontrada en tu academia." };

    const validated = gradeSchema.parse({
      grade: (formData.get("grade") as string) || undefined,
      feedback: (formData.get("feedback") as string) || undefined,
    });

    await prisma.submission.update({
      where: { id: submissionId },
      data: { grade: validated.grade || null, feedback: validated.feedback || null },
    });

    revalidatePath(
      `/dashboard/courses/${submission.assignment.lesson.module.courseId}/lessons/${submission.assignment.lessonId}`
    );
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo guardar la corrección." };
  }
}

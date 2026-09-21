"use server";

import { z } from "zod";
import { CourseService } from "@/modules/course/course.service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireTenantAccess,
  STAFF_ROLES,
  assertCourseInTenant,
  assertModuleInTenant,
  assertLessonInTenant,
} from "@/lib/session";
import { prisma } from "@/lib/db";
import { requireActiveSubscription } from "@/modules/billing/entitlements";

const createCourseSchema = z.object({
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres").max(150),
  slug: z.string().nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  level: z.string().max(20).default("A1"),
  language: z.string().max(10).default("es"),
  priceAmount: z.coerce.number().min(0).default(0),
});

const createModuleSchema = z.object({
  courseId: z.string().min(1, "Course ID requerido"),
  title: z.string().trim().min(2, "El título del módulo es requerido").max(150),
  description: z.string().max(2000).optional(),
});

const createLessonSchema = z.object({
  moduleId: z.string().min(1, "Module ID requerido"),
  title: z.string().trim().min(2, "El título de la lección es requerido").max(150),
});

const MAX_LESSON_CONTENT_BYTES = 500_000;

export async function createCourseAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  await requireActiveSubscription(tenantId);

  const validated = createCourseSchema.parse({
    title: formData.get("title") as string,
    slug: (formData.get("slug") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    level: (formData.get("level") as string) || "A1",
    language: (formData.get("language") as string) || "es",
    priceAmount: formData.get("priceAmount") as string,
  });

  const course = await CourseService.createCourse({
    tenantId,
    title: validated.title,
    slug: validated.slug || undefined,
    description: validated.description || undefined,
    level: validated.level,
    language: validated.language,
    priceAmount: validated.priceAmount,
  });

  revalidatePath("/dashboard/courses");
  redirect(`/dashboard/courses/${course.id}/builder`);
}

export async function createModuleAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);

  const validated = createModuleSchema.parse({
    courseId: formData.get("courseId") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
  });

  await assertCourseInTenant(validated.courseId, tenantId);
  await CourseService.createModule(validated);

  revalidatePath(`/dashboard/courses/${validated.courseId}/builder`);
}

export async function createLessonAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);

  const validated = createLessonSchema.parse({
    moduleId: formData.get("moduleId") as string,
    title: formData.get("title") as string,
  });

  const mod = await assertModuleInTenant(validated.moduleId, tenantId);
  await CourseService.createLesson(validated);

  revalidatePath(`/dashboard/courses/${mod.courseId}/builder`);
}

export async function updateLessonContentAction(lessonId: string, contentJsonString: string): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);

  if (typeof contentJsonString !== "string" || contentJsonString.length > MAX_LESSON_CONTENT_BYTES) {
    throw new Error("El contenido de la lección es demasiado grande.");
  }
  try {
    JSON.parse(contentJsonString);
  } catch {
    throw new Error("El contenido de la lección no es un JSON válido.");
  }

  const lesson = await assertLessonInTenant(lessonId, tenantId);
  await CourseService.updateLessonContent(lessonId, contentJsonString);
  revalidatePath(`/dashboard/courses/${lesson.module.courseId}/lessons/${lessonId}`);
}

export async function toggleCourseStatusAction(courseId: string, currentStatus: string): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const newStatus = currentStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
  await CourseService.updateCourseStatus(tenantId, courseId, newStatus);
  revalidatePath(`/dashboard/courses/${courseId}/builder`);
  revalidatePath("/dashboard/courses");
}

export async function deleteModuleAction(moduleId: string): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const mod = await assertModuleInTenant(moduleId, tenantId);
  await CourseService.deleteModule(moduleId);
  revalidatePath(`/dashboard/courses/${mod.courseId}/builder`);
}

export async function deleteLessonAction(lessonId: string): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const lesson = await assertLessonInTenant(lessonId, tenantId);
  await CourseService.deleteLesson(lessonId);
  revalidatePath(`/dashboard/courses/${lesson.module.courseId}/builder`);
}

/**
 * Marca/desmarca una lección como completada para el usuario de la sesión.
 * El alumno debe estar inscrito en el curso (o ser staff de la academia).
 */
export async function toggleLessonProgressAction(lessonId: string) {
  const { tenantId, userId, role } = await requireTenantAccess();

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { tenantId } } },
    select: { id: true, module: { select: { course: { select: { id: true, slug: true } } } } },
  });
  if (!lesson) throw new Error("Lección no encontrada.");

  const course = lesson.module.course;

  if (role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: { courseId: course.id, membership: { userId, tenantId } },
      select: { id: true },
    });
    if (!enrollment) throw new Error("No estás inscrito en este curso.");
  }

  const result = await CourseService.toggleLessonProgress(userId, lessonId);
  revalidatePath(`/campus/courses/${course.id}`);
  return result;
}

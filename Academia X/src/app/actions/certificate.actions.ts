"use server";

import { z } from "zod";
import { CertificateService } from "@/modules/certificate/certificate.service";
import { prisma } from "@/lib/db";
import { CourseService } from "@/modules/course/course.service";
import { revalidatePath } from "next/cache";
import { requireTenantAccess, STAFF_ROLES, assertCourseInTenant, assertUserInTenant } from "@/lib/session";

const issueCertificateSchema = z.object({
  userId: z.string().min(1, "User ID requerido"),
  courseId: z.string().min(1, "Course ID requerido"),
});

/**
 * Emisión manual de certificado por el staff de la academia.
 */
export async function issueCertificateAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);

  const validated = issueCertificateSchema.parse({
    userId: formData.get("userId") as string,
    courseId: formData.get("courseId") as string,
  });

  await assertUserInTenant(validated.userId, tenantId);
  await assertCourseInTenant(validated.courseId, tenantId);
  await CertificateService.issueCertificate({ tenantId, ...validated });

  revalidatePath("/dashboard/certificates");
}

/**
 * Emisión automática: el alumno reclama su certificado al completar el 100% del curso.
 */
export async function claimCertificateAction(courseId: string) {
  try {
    const { tenantId, userId } = await requireTenantAccess();
    await assertCourseInTenant(courseId, tenantId);

    const progress = await CourseService.getUserCourseProgress(userId, courseId);
    if (progress.totalLessons === 0 || progress.percentage < 100) {
      return { success: false as const, error: "Debes completar el 100% del curso para obtener tu certificado." };
    }

    const certificate = await CertificateService.issueCertificate({ tenantId, userId, courseId });
    revalidatePath("/campus");
    return { success: true as const, code: certificate.code };
  } catch (error: any) {
    return { success: false as const, error: error.message || "No se pudo emitir el certificado" };
  }
}

/**
 * Elige la plantilla de certificado de un curso.
 * Solo afecta a los certificados que se emitan a partir de ahora: los ya
 * emitidos conservan la plantilla con la que salieron.
 */
export async function setCourseCertificateTemplateAction(courseId: string, template: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await assertCourseInTenant(courseId, tenantId);

    const valid = ["CLASSIC", "MODERN", "ELEGANT"];
    const chosen = valid.includes(template) ? template : "CLASSIC";

    await prisma.course.updateMany({
      where: { id: courseId, tenantId },
      data: { certificateTemplate: chosen },
    });

    revalidatePath("/dashboard/certificates");
    return { success: true, template: chosen };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo guardar la plantilla." };
  }
}

/**
 * Lista de alumnos inscritos en un curso con su progreso y si ya tienen
 * certificado. Es la pantalla desde la que el profesor aprueba uno a uno.
 */
export async function getCourseStudentsForCertificationAction(courseId: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await assertCourseInTenant(courseId, tenantId);

    const course = await prisma.course.findFirst({
      where: { id: courseId, tenantId },
      select: {
        certificateTemplate: true,
        modules: { select: { lessons: { select: { id: true } } } },
        enrollments: {
          include: { membership: { include: { user: { select: { id: true, name: true, email: true } } } } },
        },
        certificates: { select: { userId: true, code: true, issuedAt: true, template: true } },
      },
    });
    if (!course) return { success: false, error: "Curso no encontrado." };

    const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const totalLessons = lessonIds.length;

    const userIds = course.enrollments.map((e) => e.membership.user.id);
    const progress = totalLessons
      ? await prisma.progress.findMany({
          where: { userId: { in: userIds }, lessonId: { in: lessonIds }, completed: true },
          select: { userId: true },
        })
      : [];

    const completedByUser = new Map<string, number>();
    for (const row of progress) {
      completedByUser.set(row.userId, (completedByUser.get(row.userId) || 0) + 1);
    }

    const certificateByUser = new Map(course.certificates.map((c) => [c.userId, c]));

    return {
      success: true,
      template: course.certificateTemplate,
      totalLessons,
      students: course.enrollments.map((e) => {
        const user = e.membership.user;
        const done = completedByUser.get(user.id) || 0;
        const cert = certificateByUser.get(user.id);
        return {
          userId: user.id,
          name: user.name || user.email,
          email: user.email,
          completedLessons: done,
          percentage: totalLessons ? Math.round((done / totalLessons) * 100) : 0,
          certificate: cert ? { code: cert.code, issuedAt: cert.issuedAt.toISOString(), template: cert.template } : null,
        };
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudieron cargar los alumnos." };
  }
}

/** El profesor aprueba y emite el certificado de un alumno concreto. */
export async function approveCertificateAction(courseId: string, studentUserId: string) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    await assertCourseInTenant(courseId, tenantId);
    await assertUserInTenant(studentUserId, tenantId);

    const certificate = await CertificateService.issueCertificate({
      tenantId,
      userId: studentUserId,
      courseId,
      issuedByUserId: userId,
    });

    revalidatePath("/dashboard/certificates");
    return { success: true, code: certificate.code };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo emitir el certificado." };
  }
}

"use server";

import { z } from "zod";
import { CertificateService } from "@/modules/certificate/certificate.service";
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

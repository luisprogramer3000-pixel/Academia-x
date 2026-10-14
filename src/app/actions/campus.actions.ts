"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantAccess } from "@/lib/session";
import { requireActiveSubscription } from "@/modules/billing/entitlements";
import { claimCertificateAction } from "@/app/actions/certificate.actions";

/**
 * Autoinscripción del alumno en un curso PUBLICADO y GRATUITO de su academia.
 * Los cursos de pago requieren que el staff inscriba al alumno.
 */
export async function selfEnrollAction(courseId: string): Promise<void> {
  const { tenantId, userId } = await requireTenantAccess();
  await requireActiveSubscription(tenantId);

  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId, status: "PUBLISHED" },
    select: { id: true, priceAmount: true },
  });
  if (!course) throw new Error("Curso no disponible.");
  if (Number(course.priceAmount) > 0) {
    throw new Error("Este curso es de pago. Contacta a tu academia para inscribirte.");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    select: { id: true },
  });
  if (!membership) throw new Error("No perteneces a esta academia.");

  await prisma.enrollment.upsert({
    where: { membershipId_courseId: { membershipId: membership.id, courseId } },
    update: {},
    create: { membershipId: membership.id, courseId },
  });

  revalidatePath("/campus");
  redirect(`/campus/courses/${courseId}`);
}

/**
 * Wrapper de formulario: emite el certificado y redirige a la página pública de verificación.
 */
export async function claimCertificateFormAction(courseId: string): Promise<void> {
  const result = await claimCertificateAction(courseId);
  if (!result.success) {
    redirect(`/campus?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/verify/${result.code}`);
}

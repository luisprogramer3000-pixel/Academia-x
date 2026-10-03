"use server";

import { z } from "zod";
import crypto from "crypto";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, setSession, requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { UPLOADS_ROOT, publicUploadUrl } from "@/lib/uploads";
import { requireActiveSubscription } from "@/modules/billing/entitlements";
import { EnrollmentRequestService } from "@/modules/course/enrollment-request.service";

/** Comprobante de pago: imagen o PDF. La extensión sale de esta tabla, nunca del nombre del archivo. */
const PROOF_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};
const MAX_PROOF_BYTES = 5 * 1024 * 1024;

class EnrollmentError extends Error {}

/**
 * Alumno de la academia dueña del curso. Si su sesión estaba abierta en otra
 * academia en la que también es miembro, se cambia a esta para que el campus
 * le muestre el curso.
 */
async function studentForCourse(courseId: string) {
  const session = await getSession();
  if (!session?.userId) throw new EnrollmentError("Inicia sesión o regístrate para inscribirte.");

  const course = await prisma.course.findFirst({
    where: { id: courseId, status: "PUBLISHED", contentType: "COURSE" },
    select: { id: true, slug: true, tenantId: true, priceAmount: true, tenant: { select: { slug: true } } },
  });
  if (!course) throw new EnrollmentError("Este curso no está disponible.");

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.userId, tenantId: course.tenantId } },
    include: { user: true },
  });
  if (!membership) throw new EnrollmentError("Regístrate en la academia para inscribirte.");

  if (session.tenantId !== course.tenantId) {
    await setSession({
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      globalRole: membership.user.globalRole,
      tenantId: course.tenantId,
      tenantSlug: course.tenant.slug,
      academyRole: membership.role,
    });
  }

  const enrollPage = `/a/${course.tenant.slug}/courses/${course.slug}/inscripcion`;
  return { course, membership, enrollPage };
}

async function storeProof(file: File, tenantId: string): Promise<string> {
  const extension = PROOF_TYPES[file.type];
  if (!extension) throw new EnrollmentError("El comprobante debe ser una imagen (JPG, PNG, WEBP) o un PDF.");
  if (file.size > MAX_PROOF_BYTES) throw new EnrollmentError("El comprobante no debe superar los 5 MB.");

  const folder = "payment-proofs";
  const fileName = `proof-${tenantId}-${crypto.randomBytes(12).toString("hex")}${extension}`;
  const dir = path.join(UPLOADS_ROOT, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
  return publicUploadUrl(folder, fileName);
}

/** Curso gratuito: inscripción inmediata. */
export async function freeEnrollAction(courseId: string): Promise<void> {
  let target: string;
  try {
    const { course, membership } = await studentForCourse(courseId);
    if (Number(course.priceAmount) > 0) throw new EnrollmentError("Este curso es de pago.");
    await requireActiveSubscription(course.tenantId);
    await prisma.enrollment.upsert({
      where: { membershipId_courseId: { membershipId: membership.id, courseId } },
      update: {},
      create: { membershipId: membership.id, courseId },
    });
    revalidatePath("/campus");
    target = `/campus/courses/${courseId}`;
  } catch (error) {
    if (!(error instanceof EnrollmentError)) console.error("[enrollment] Inscripción gratuita", error);
    target = `/campus?error=${encodeURIComponent(error instanceof Error ? error.message : "No se pudo completar la inscripción.")}`;
  }
  redirect(target);
}

/** Alumno ya inscrito: abre el curso en el campus (cambiando de academia si hace falta). */
export async function openEnrolledCourseAction(courseId: string): Promise<void> {
  let target = "/campus";
  try {
    await studentForCourse(courseId);
    target = `/campus/courses/${courseId}`;
  } catch (error) {
    target = `/campus?error=${encodeURIComponent(error instanceof Error ? error.message : "No se pudo abrir el curso.")}`;
  }
  redirect(target);
}

const requestSchema = z.object({
  message: z.string().trim().max(1000, "El mensaje no puede superar los 1000 caracteres.").optional(),
});

/** Curso de pago: solicitud (con comprobante opcional) que el profesor aprueba. */
export async function submitEnrollmentRequestAction(courseId: string, formData: FormData): Promise<void> {
  let enrollPage = "/campus";
  let target: string;
  try {
    const ctx = await studentForCourse(courseId);
    enrollPage = ctx.enrollPage;
    if (Number(ctx.course.priceAmount) <= 0) throw new EnrollmentError("Este curso es gratuito: inscríbete directamente.");

    const limit = await checkRateLimit({ key: `enroll_request:${ctx.membership.id}:${courseId}`, limit: 5, windowMs: 10 * 60_000 });
    if (!limit.success) throw new EnrollmentError("Has enviado demasiadas solicitudes. Espera unos minutos.");

    const { message } = requestSchema.parse({ message: (formData.get("message") as string) || undefined });
    const file = formData.get("proof");
    const proofUrl = file instanceof File && file.size > 0 ? await storeProof(file, ctx.course.tenantId) : null;

    await EnrollmentRequestService.submit({
      tenantId: ctx.course.tenantId,
      courseId,
      membershipId: ctx.membership.id,
      message: message ?? null,
      proofUrl,
    });
    revalidatePath("/dashboard/enrollment-requests");
    target = `${enrollPage}?enviada=1`;
  } catch (error) {
    const text = error instanceof z.ZodError ? error.errors[0].message : error instanceof Error ? error.message : "";
    if (!(error instanceof EnrollmentError) && !(error instanceof z.ZodError)) console.error("[enrollment] Solicitud", error);
    target = `${enrollPage}?error=${encodeURIComponent(text || "No se pudo enviar la solicitud.")}`;
  }
  redirect(target);
}

export async function approveEnrollmentRequestAction(requestId: string) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    await EnrollmentRequestService.approve(tenantId, requestId, userId);
    revalidatePath("/dashboard/enrollment-requests");
    revalidatePath("/dashboard/students");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo aprobar." };
  }
}

export async function rejectEnrollmentRequestAction(requestId: string, note: string) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    const cleanNote = z.string().trim().max(500).parse(note ?? "");
    await EnrollmentRequestService.reject(tenantId, requestId, userId, cleanNote || null);
    revalidatePath("/dashboard/enrollment-requests");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "No se pudo rechazar." };
  }
}

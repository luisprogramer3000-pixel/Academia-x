"use server";

import { z } from "zod";
import { UserService } from "@/modules/user/user.service";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  requireTenantAccess,
  setSession,
  STAFF_ROLES,
  OWNER_ONLY,
  assertCourseInTenant,
  assertMembershipInTenant,
  AuthError,
} from "@/lib/session";
import { prisma } from "@/lib/db";
import { assertCanAddMember, PlanLimitError } from "@/modules/billing/entitlements";
import { markEmailVerified, sendVerificationEmail } from "@/modules/user/email-verification";

const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email no válido"),
  role: z.enum(["STUDENT", "TEACHER"]).default("STUDENT"),
});

const enrollStudentSchema = z.object({
  membershipId: z.string().min(1, "Membresía requerida"),
  courseId: z.string().min(1, "Curso requerido"),
});

const passwordSchema = z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128);

/** Casilla obligatoria de aceptación de Términos y Política de Privacidad */
const termsSchema = z.literal("on", { errorMap: () => ({ message: "Debes aceptar los Términos y la Política de Privacidad." }) });

/** Deja constancia de la aceptación de los términos (solo la primera vez). */
async function recordTermsAcceptance(userId: string) {
  await prisma.user.updateMany({ where: { id: userId, termsAcceptedAt: null }, data: { termsAcceptedAt: new Date() } });
}

const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token de invitación requerido"),
  name: z.string().trim().min(2, "El nombre es requerido").max(80),
  password: passwordSchema,
  acceptTerms: termsSchema,
});

const publicRegisterSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  name: z.string().trim().min(2, "Nombre de al menos 2 caracteres").max(80),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: passwordSchema,
  acceptTerms: termsSchema,
});

export async function inviteUserAction(formData: FormData): Promise<void> {
  const validated = inviteUserSchema.parse({
    email: formData.get("email") as string,
    role: (formData.get("role") as "STUDENT" | "TEACHER") || "STUDENT",
  });

  // Solo el OWNER puede invitar profesores; el staff puede invitar alumnos
  const { tenantId } = await requireTenantAccess(validated.role === "TEACHER" ? OWNER_ONLY : STAFF_ROLES);

  await assertCanAddMember(tenantId, validated.role);
  await UserService.inviteUser({ tenantId, ...validated });

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/teachers");
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const id = z.string().min(1, "ID de invitación requerido").parse(formData.get("id"));

  await UserService.revokeInvitation(id, tenantId);

  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/teachers");
}

export async function enrollStudentAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const validated = enrollStudentSchema.parse({
    membershipId: formData.get("membershipId") as string,
    courseId: formData.get("courseId") as string,
  });

  await assertMembershipInTenant(validated.membershipId, tenantId);
  await assertCourseInTenant(validated.courseId, tenantId);
  await UserService.enrollStudentInCourse(validated.membershipId, validated.courseId);

  revalidatePath("/dashboard/students");
}

export async function unenrollStudentAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const validated = enrollStudentSchema.parse({
    membershipId: formData.get("membershipId") as string,
    courseId: formData.get("courseId") as string,
  });

  await assertMembershipInTenant(validated.membershipId, tenantId);
  await assertCourseInTenant(validated.courseId, tenantId);
  await UserService.unenrollStudentFromCourse(validated.membershipId, validated.courseId);

  revalidatePath("/dashboard/students");
}

async function startSessionForMembership(userId: string, tenantId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: { user: true, tenant: { select: { slug: true } } },
  });
  if (!membership) return;

  await setSession({
    userId,
    email: membership.user.email,
    name: membership.user.name,
    globalRole: membership.user.globalRole,
    tenantId,
    tenantSlug: membership.tenant.slug,
    academyRole: membership.role,
  });
}

export async function acceptInvitationAction(formData: FormData) {
  try {
    const validated = acceptInviteSchema.parse({
      token: formData.get("token") as string,
      name: formData.get("name") as string,
      password: (formData.get("password") as string) || "",
      acceptTerms: formData.get("acceptTerms"),
    });

    const rateLimit = await checkRateLimit({ key: `accept_invite:${validated.token}`, limit: 5, windowMs: 60_000 });
    if (!rateLimit.success) {
      return { success: false, error: "Demasiados intentos. Intenta de nuevo en un minuto." };
    }

    const result = await UserService.acceptInvitation(validated);
    // El enlace de la invitación llegó a ese correo: queda confirmado
    await markEmailVerified(result.user.id);
    await recordTermsAcceptance(result.user.id);
    await startSessionForMembership(result.user.id, result.tenant.id);

    return {
      success: true,
      data: {
        tenant: { slug: result.tenant.slug, name: result.tenant.name },
        redirectTo: result.membership.role === "STUDENT" ? "/campus" : "/dashboard",
      },
    };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: error.message || "Error al procesar la invitación" };
  }
}

export async function publicRegisterStudentAction(formData: FormData) {
  try {
    const validated = publicRegisterSchema.parse({
      tenantId: formData.get("tenantId") as string,
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: (formData.get("password") as string) || "",
      acceptTerms: formData.get("acceptTerms"),
    });

    // Mismo contador que el login: si el email ya existe, aquí también se comprueba su
    // contraseña, así que no puede servir para probar contraseñas saltándose ese límite
    // (antes la clave incluía la academia y bastaba con cambiar de academia).
    const rateLimit = await checkRateLimit({ key: `auth_login:${validated.email}`, limit: 5, windowMs: 60_000 });
    if (!rateLimit.success) {
      return {
        success: false,
        error: "Demasiados intentos. Por favor intenta nuevamente en un minuto.",
      };
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: validated.tenantId }, select: { id: true, name: true } });
    if (!tenant) {
      return { success: false, error: "Academia no encontrada." };
    }

    const result = await UserService.registerPublicStudent(validated.tenantId, {
      name: validated.name,
      email: validated.email,
      password: validated.password,
    });

    await recordTermsAcceptance(result.user.id);
    // Cuenta nueva: se pide confirmar el correo (las ya verificadas no reciben nada)
    if (!result.user.emailVerifiedAt) {
      await sendVerificationEmail(result.user.id, tenant.name).catch(() => undefined);
    }
    await startSessionForMembership(result.user.id, validated.tenantId);
    revalidatePath("/dashboard/students");

    return { success: true, data: { userId: result.user.id } };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    if (error instanceof AuthError || error instanceof PlanLimitError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message || "Error al registrar estudiante" };
  }
}

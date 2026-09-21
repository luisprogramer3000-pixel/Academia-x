"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { setSession, clearSession, getSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { getAppUrl } from "@/lib/stripe";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email no válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

const INVALID_CREDENTIALS = "Email o contraseña incorrectos.";

// Hash de referencia para igualar el tiempo de respuesta cuando el usuario no existe (evita enumeración de emails).
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword("dummy-password-for-timing");
  return dummyHashPromise;
}

type MembershipWithTenant = {
  tenantId: string;
  role: "OWNER" | "TEACHER" | "STUDENT";
  tenant: { slug: string };
};

/**
 * Prioriza una membresía de staff (OWNER > TEACHER) sobre STUDENT al iniciar sesión.
 */
function pickPrimaryMembership(memberships: MembershipWithTenant[]): MembershipWithTenant | undefined {
  const priority = { OWNER: 0, TEACHER: 1, STUDENT: 2 } as const;
  return [...memberships].sort((a, b) => priority[a.role] - priority[b.role])[0];
}

function destinationForRole(role?: string) {
  return role === "STUDENT" ? "/campus" : "/dashboard";
}

export async function loginAction(formData: FormData) {
  try {
    const validated = loginSchema.parse({
      email: (formData.get("email") as string) || "",
      password: (formData.get("password") as string) || "",
    });

    // Rate Limiting para prevenir intentos desmedidos de login (Fuerza Bruta)
    const rateLimit = await checkRateLimit({ key: `auth_login:${validated.email}`, limit: 5, windowMs: 60_000 });
    if (!rateLimit.success) {
      return {
        success: false,
        error: "Demasiados intentos de inicio de sesión. Por favor intenta de nuevo en un minuto.",
      };
    }

    const user = await prisma.user.findUnique({
      where: { email: validated.email },
      include: { memberships: { include: { tenant: { select: { slug: true } } } } },
    });

    if (!user || !user.passwordHash) {
      await verifyPassword(validated.password, await getDummyHash());
      return { success: false, error: INVALID_CREDENTIALS };
    }

    const passwordOk = await verifyPassword(validated.password, user.passwordHash);
    if (!passwordOk) {
      return { success: false, error: INVALID_CREDENTIALS };
    }

    const membership = pickPrimaryMembership(user.memberships);
    if (!membership) {
      return { success: false, error: "Tu cuenta no pertenece a ninguna academia." };
    }

    await setSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      globalRole: user.globalRole,
      tenantId: membership.tenantId,
      tenantSlug: membership.tenant.slug,
      academyRole: membership.role,
    });

    return {
      success: true,
      tenantSlug: membership.tenant.slug,
      redirectTo: destinationForRole(membership.role),
    };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    console.error("[auth] loginAction error:", error?.message);
    return { success: false, error: "Error al iniciar sesión" };
  }
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}

/**
 * Cambia la academia activa de la sesión (para usuarios con varias membresías).
 */
export async function switchTenantAction(tenantId: string) {
  const session = await getSession();
  if (!session?.userId) return { success: false, error: "UNAUTHORIZED" };

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.userId, tenantId } },
    include: { tenant: { select: { slug: true } } },
  });
  if (!membership) return { success: false, error: "FORBIDDEN" };

  await setSession({
    ...session,
    tenantId: membership.tenantId,
    tenantSlug: membership.tenant.slug,
    academyRole: membership.role,
  });

  return { success: true, redirectTo: destinationForRole(membership.role) };
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Solicita un enlace de restablecimiento. Siempre responde igual para no revelar si el email existe.
 */
export async function requestPasswordResetAction(formData: FormData) {
  const GENERIC = { success: true, message: "Si el email está registrado, recibirás un enlace para restablecer tu contraseña." };
  try {
    const email = z.string().trim().toLowerCase().email().parse(formData.get("email"));

    const rateLimit = await checkRateLimit({ key: `password_reset:${email}`, limit: 3, windowMs: 15 * 60_000 });
    if (!rateLimit.success) return GENERIC;

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) return GENERIC;

    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    await sendEmail({ to: user.email, ...EmailTemplates.passwordReset({ url: `${getAppUrl()}/reset-password/${token}` }) });
    return GENERIC;
  } catch (error: any) {
    if (error instanceof z.ZodError) return { success: false, message: "Email no válido." };
    console.error("[auth] requestPasswordResetAction:", error?.message);
    return GENERIC;
  }
}

/**
 * Establece una nueva contraseña con un token válido de un solo uso.
 */
export async function resetPasswordAction(formData: FormData) {
  try {
    const token = z.string().min(32).parse(formData.get("token"));
    const password = z
      .string()
      .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
      .max(128)
      .parse(formData.get("password"));

    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return { success: false, error: "El enlace no es válido o ha caducado. Solicita uno nuevo." };
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      // Invalidar cualquier otro token pendiente del usuario
      prisma.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } }),
    ]);

    return { success: true };
  } catch (error: any) {
    if (error instanceof z.ZodError) return { success: false, error: error.errors[0].message };
    return { success: false, error: "No se pudo restablecer la contraseña." };
  }
}

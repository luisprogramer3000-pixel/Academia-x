import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { getAppUrl } from "@/lib/app-url";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Confirmación del email de las cuentas nuevas: un enlace de un solo uso
 * (se guarda solo su hash SHA-256) que caduca en 48 horas. Hasta confirmarlo,
 * el panel y el campus no se abren (session.ts → EMAIL_UNVERIFIED).
 */

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** Envía (o reenvía) el enlace. Devuelve false si se pidió demasiadas veces seguidas. */
export async function sendVerificationEmail(userId: string, academyName?: string | null): Promise<boolean> {
  const limit = await checkRateLimit({ key: `verify_email:${userId}`, limit: 3, windowMs: 15 * 60_000 });
  if (!limit.success) return false;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, deletedAt: true } });
  if (!user || user.emailVerifiedAt || user.deletedAt) return true;

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  await sendEmail({ to: user.email, ...EmailTemplates.verifyEmail({ url: `${getAppUrl()}/confirmar-email/${token}`, academyName }) });
  return true;
}

/** Marca el email como confirmado si el token es válido. Devuelve el userId o null. */
export async function confirmEmailToken(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;

  const now = new Date();
  await prisma.$transaction([
    prisma.user.updateMany({ where: { id: record.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } }),
    prisma.emailVerificationToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: now } }),
  ]);
  return record.userId;
}

/** El email quedó demostrado por otra vía (invitación o restablecer contraseña por correo). */
export async function markEmailVerified(userId: string) {
  await prisma.user.updateMany({ where: { id: userId, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
}

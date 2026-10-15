"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, clearSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/modules/user/email-verification";

/**
 * Acciones de "Mi cuenta": reenviar la confirmación del email, cerrar sesión en
 * todos los dispositivos y eliminar la cuenta (derecho de eliminación de datos).
 * Todas toman al usuario de la sesión; nunca de lo que envía el navegador.
 */

export async function resendVerificationAction(): Promise<{ success: boolean; message: string }> {
  const session = await getSession();
  if (!session?.userId) return { success: false, message: "Inicia sesión para continuar." };
  const sent = await sendVerificationEmail(session.userId);
  return sent
    ? { success: true, message: "Te enviamos un nuevo enlace. Revisa tu bandeja de entrada (y la carpeta de spam)." }
    : { success: false, message: "Ya pediste varios enlaces. Espera unos minutos antes de pedir otro." };
}

/** Invalida todos los tokens de sesión emitidos (también el de este navegador). */
export async function logoutEverywhereAction(): Promise<void> {
  const session = await getSession();
  if (session?.userId) {
    await prisma.user.update({ where: { id: session.userId }, data: { sessionVersion: { increment: 1 } } });
  }
  await clearSession();
  redirect("/login");
}

const deleteSchema = z.object({
  password: z.string().min(1, "Escribe tu contraseña para confirmar."),
  confirm: z.literal("ELIMINAR", { errorMap: () => ({ message: "Escribe ELIMINAR para confirmar." }) }),
});

/**
 * Elimina la cuenta del usuario. Se borran sus datos de aprendizaje (membresías,
 * inscripciones, progreso, entregas, intentos, certificados, notificaciones) y se
 * anonimiza la ficha (email, nombre, foto, contraseña). Se conservan, sin datos
 * personales, los registros contables (pagos y movimientos de créditos) que la ley
 * obliga a guardar, y el material que un profesor creó para su academia.
 *
 * El dueño de una academia no puede borrarse solo: la academia, sus alumnos y su
 * facturación dependen de esa cuenta. Debe pedir la baja de la academia a soporte.
 */
export async function deleteAccountAction(formData: FormData): Promise<{ success: false; error: string } | void> {
  const session = await getSession();
  if (!session?.userId) return { success: false, error: "Inicia sesión para continuar." };

  const parsed = deleteSchema.safeParse({ password: formData.get("password") ?? "", confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const limit = await checkRateLimit({ key: `delete_account:${session.userId}`, limit: 5, windowMs: 15 * 60_000 });
  if (!limit.success) return { success: false, error: "Demasiados intentos. Espera unos minutos." };

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true, globalRole: true, memberships: { where: { role: "OWNER" }, select: { id: true } } },
  });
  if (!user) return { success: false, error: "Cuenta no encontrada." };
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { success: false, error: "La contraseña no es correcta." };
  }
  if (user.globalRole === "SUPER_ADMIN") {
    return { success: false, error: "La cuenta de administración de la plataforma no se puede eliminar desde aquí." };
  }
  if (user.memberships.length > 0) {
    const support = process.env.SUPPORT_EMAIL;
    return {
      success: false,
      error: `Eres dueño de una academia: para eliminar tu cuenta hay que dar de baja la academia. Escríbenos${support ? ` a ${support}` : " a soporte"} y lo haremos en un máximo de 15 días.`,
    };
  }

  const userId = user.id;
  await prisma.$transaction([
    prisma.membership.deleteMany({ where: { userId } }),
    prisma.progress.deleteMany({ where: { userId } }),
    prisma.submission.deleteMany({ where: { userId } }),
    prisma.quizAttempt.deleteMany({ where: { userId } }),
    prisma.certificate.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.emailVerificationToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: `eliminado-${userId}@cuenta-eliminada.invalid`,
        name: null,
        avatarUrl: null,
        passwordHash: null,
        emailVerifiedAt: null,
        deletedAt: new Date(),
        sessionVersion: { increment: 1 },
      },
    }),
  ]);

  await clearSession();
  redirect("/login?cuenta=eliminada");
}

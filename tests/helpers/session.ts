import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

function jar(): Map<string, string> {
  return (globalThis as any).__testCookieJar as Map<string, string>;
}

/**
 * Inicia sesión en los tests como el usuario indicado dentro de un tenant.
 * El rol se toma de la membresía real en DB (si no existe, las acciones responderán UNAUTHORIZED).
 *
 * `ensurePlan` crea (solo si no hay ninguna) una suscripción activa de prueba sin tocar la billetera,
 * ya que las acciones protegidas exigen un plan vigente.
 */
export async function loginAs(
  tenantId: string,
  userId: string,
  options: { ensurePlan?: "STARTER" | "PRO" | "ACADEMY" | false } = {}
) {
  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } } }),
  ]);

  const token = await createSessionToken({
    userId,
    email: user?.email || "test@example.com",
    name: user?.name,
    globalRole: user?.globalRole || "USER",
    tenantId,
    academyRole: membership?.role,
  });
  jar().set(SESSION_COOKIE_NAME, token);

  const plan = options.ensurePlan === undefined ? "PRO" : options.ensurePlan;
  if (plan) {
    const existing = await prisma.subscription.findFirst({ where: { tenantId } });
    if (!existing) {
      await prisma.subscription.create({
        data: {
          tenantId,
          externalId: `sub_test_${tenantId}`,
          planId: plan,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }
}

export function logout() {
  jar().delete(SESSION_COOKIE_NAME);
}

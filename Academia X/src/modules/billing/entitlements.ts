import { prisma } from "@/lib/db";
import { BillingService, ActiveSubscription } from "./billing.service";
import type { PlanConfig } from "./plans";

export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export const NO_ACTIVE_PLAN_MESSAGE =
  "Tu academia no tiene un plan activo. El propietario debe activar o renovar la suscripción en Facturación.";

/**
 * Exige una suscripción vigente. Devuelve la suscripción activa.
 */
export async function requireActiveSubscription(tenantId: string): Promise<ActiveSubscription> {
  const active = await BillingService.getActiveSubscription(tenantId);
  if (!active) throw new PlanLimitError(NO_ACTIVE_PLAN_MESSAGE);
  return active;
}

/**
 * Verifica si la academia puede sumar un miembro con el rol indicado según los límites de su plan.
 * Cuenta miembros actuales + invitaciones pendientes del mismo tipo.
 */
export async function assertCanAddMember(
  tenantId: string,
  role: "STUDENT" | "TEACHER",
  options: { countPendingInvitations?: boolean } = {}
): Promise<void> {
  const { plan } = await requireActiveSubscription(tenantId);
  const countPending = options.countPendingInvitations ?? true;

  if (role === "STUDENT") {
    const [members, pending] = await Promise.all([
      prisma.membership.count({ where: { tenantId, role: "STUDENT" } }),
      countPending
        ? prisma.invitation.count({ where: { tenantId, role: "STUDENT", expiresAt: { gt: new Date() } } })
        : Promise.resolve(0),
    ]);
    if (members + pending >= plan.maxStudents) {
      throw new PlanLimitError(
        `Tu plan ${plan.name} permite hasta ${plan.maxStudents} estudiantes. Mejora tu plan para inscribir más alumnos.`
      );
    }
    return;
  }

  // El OWNER cuenta como profesor
  const [members, pending] = await Promise.all([
    prisma.membership.count({ where: { tenantId, role: { in: ["TEACHER", "OWNER"] } } }),
    countPending
      ? prisma.invitation.count({ where: { tenantId, role: "TEACHER", expiresAt: { gt: new Date() } } })
      : Promise.resolve(0),
  ]);
  if (members + pending >= plan.maxTeachers) {
    throw new PlanLimitError(
      `Tu plan ${plan.name} permite hasta ${plan.maxTeachers} profesor(es) incluyendo al propietario. Mejora tu plan para añadir más.`
    );
  }
}

/**
 * Exige que el plan activo incluya una capacidad concreta.
 */
export async function assertPlanCapability(
  tenantId: string,
  capability: keyof PlanConfig["capabilities"]
): Promise<void> {
  const { plan } = await requireActiveSubscription(tenantId);
  if (!plan.capabilities[capability]) {
    const labels: Record<keyof PlanConfig["capabilities"], string> = {
      customBranding: "El branding personalizado",
      customDomain: "El dominio personalizado",
      advancedAnalytics: "Las analíticas avanzadas",
    };
    throw new PlanLimitError(`${labels[capability]} no está incluido en tu plan ${plan.name}.`);
  }
}

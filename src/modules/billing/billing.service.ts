import { prisma } from "@/lib/db";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { BillingInterval } from "@prisma/client";

export { BillingInterval };
import { SAAS_PLANS, SECOND_INSTALLMENT_DELAY_HOURS, type PlanConfig } from "./plans";
export { SAAS_PLANS };
export type { PlanConfig, PlanPricing } from "./plans";

export type PlanId = "STARTER" | "PRO" | "ACADEMY";

/** Estados que otorgan acceso al servicio */
export const ACCESS_GRANTING_STATUSES = ["active", "trialing"];
/** Días de gracia tras vencer sin poder cobrar (past_due) antes de bloquear el acceso */
export const PAST_DUE_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Plan en dos pagos: días de acceso tras pagar la parte 1, mientras se paga la parte 2 (después corre la gracia) */
export const PROVISIONAL_ACCESS_DAYS = 3;
/** Plan en dos pagos: pasado este plazo sin parte 2, el siguiente pago vuelve a ser la parte 1 */
export const SECOND_INSTALLMENT_WINDOW_DAYS = 10;

/** Identificador de la suscripción de una academia pagada con Payphone */
export const payphoneSubscriptionId = (tenantId: string) => `pp_${tenantId}`;

export interface ActiveSubscription {
  id: string;
  externalId: string | null;
  planId: PlanId;
  plan: PlanConfig;
  billingInterval: BillingInterval;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  autoRenew: boolean;
}

export function normalizePlanId(planId: string | null | undefined): PlanId | null {
  const upper = planId?.toUpperCase();
  return upper && upper in SAAS_PLANS ? (upper as PlanId) : null;
}

/** Suma un mes o un año (calendario) a una fecha. */
export function addInterval(from: Date, interval: BillingInterval): Date {
  const d = new Date(from);
  if (interval === "YEARLY") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

export class BillingService {
  /**
   * Devuelve la suscripción que otorga acceso al tenant, o null si no tiene ninguna vigente.
   * Nunca asume un plan por defecto.
   */
  static async getActiveSubscription(tenantId: string): Promise<ActiveSubscription | null> {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
    if (!subscription) return null;

    const planId = normalizePlanId(subscription.planId);
    if (!planId) return null;

    const now = Date.now();
    const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const periodEnd = subscription.currentPeriodEnd.getTime();

    const hasAccess =
      (ACCESS_GRANTING_STATUSES.includes(subscription.status) && periodEnd + graceMs > now) ||
      (subscription.status === "past_due" && periodEnd + graceMs > now);

    if (!hasAccess) return null;

    return {
      id: subscription.id,
      externalId: subscription.externalId,
      planId,
      plan: SAAS_PLANS[planId],
      billingInterval: subscription.billingInterval,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      autoRenew: subscription.autoRenew,
    };
  }

  /**
   * Cómo se pagó el plan vigente: método del último pago de plan aprobado
   * ("BUTTON" = Cajita, "TOKEN" = tarjeta guardada, "LINK" = Link de Suscripción
   * de PayPhone, que renueva solo). null si no hay pagos (cortesía o simulado).
   */
  static async getCurrentSubscriptionPaymentMethod(tenantId: string): Promise<string | null> {
    const last = await prisma.payment.findFirst({
      where: { tenantId, kind: "SUBSCRIPTION", status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: { method: true },
    });
    return last?.method ?? null;
  }

  /**
   * Obtiene la información de suscripción y consumo de un tenant para el panel de facturación.
   */
  static async getTenantSubscriptionInfo(tenantId: string) {
    const [active, latest, studentsCount, teachersCount, card, payments, paymentMethod, pendingLink, pendingSecondInstallment] = await Promise.all([
      this.getActiveSubscription(tenantId),
      prisma.subscription.findFirst({ where: { tenantId }, orderBy: { updatedAt: "desc" } }),
      prisma.membership.count({ where: { tenantId, role: "STUDENT" } }),
      prisma.membership.count({ where: { tenantId, role: { in: ["TEACHER", "OWNER"] } } }),
      prisma.paymentCard.findUnique({ where: { tenantId }, select: { cardBrand: true, lastDigits: true, consentAt: true } }),
      prisma.payment.findMany({
        where: { tenantId, status: { in: ["APPROVED", "FAILED"] } },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true, kind: true, method: true, status: true, planId: true, billingInterval: true, amountCents: true,
          cardBrand: true, lastDigits: true, authorizationCode: true, failureReason: true, createdAt: true,
        },
      }),
      this.getCurrentSubscriptionPaymentMethod(tenantId),
      // Suscripción por link iniciada y aún sin primer cobro verificado (estado PENDING)
      prisma.payment.findFirst({
        where: {
          tenantId, kind: "SUBSCRIPTION", method: "LINK", status: "PENDING",
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        select: { planId: true, billingInterval: true, createdAt: true },
      }),
      // Academy Executive anual (Cajita en dos pagos): parte 1 pagada, falta la parte 2
      this.getAwaitingSecondInstallment(tenantId),
    ]);

    return {
      active,
      latestStatus: latest?.status ?? null,
      plan: active?.plan ?? null,
      billingInterval: active?.billingInterval ?? ("MONTHLY" as BillingInterval),
      card,
      payments,
      /** El plan vigente se paga con un Link de Suscripción: PayPhone lo renueva solo */
      recurringLink: Boolean(active) && paymentMethod === "LINK",
      pendingLink,
      pendingSecondInstallment,
      usage: {
        studentsCount,
        maxStudents: active?.plan.maxStudents ?? 0,
        teachersCount,
        maxTeachers: active?.plan.maxTeachers ?? 0,
      },
    };
  }

  /**
   * Aplica un pago de plan aprobado:
   * - mismo plan y modalidad con acceso vigente → se suma un periodo al vencimiento actual
   *   (renovar antes de tiempo no hace perder días);
   * - academia nueva, plan distinto o cambio mensual/anual → el periodo empieza hoy.
   * Re-sincroniza la billetera de créditos solo al activarse o cambiar de plan.
   */
  static async applySubscriptionPayment(input: {
    tenantId: string;
    planId: PlanId;
    billingInterval: BillingInterval;
    externalId?: string;
  }) {
    const externalId = input.externalId ?? payphoneSubscriptionId(input.tenantId);
    const [active, previous] = await Promise.all([
      this.getActiveSubscription(input.tenantId),
      prisma.subscription.findUnique({ where: { externalId } }),
    ]);

    const now = new Date();
    const extendsCurrent =
      active && active.planId === input.planId && active.billingInterval === input.billingInterval;
    const base = extendsCurrent && active.currentPeriodEnd > now ? active.currentPeriodEnd : now;
    const currentPeriodEnd = addInterval(base, input.billingInterval);

    const data = {
      planId: input.planId,
      billingInterval: input.billingInterval,
      status: "active",
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      renewalAttempts: 0,
      lastRenewalAttemptAt: null,
    };
    const saved = await prisma.subscription.upsert({
      where: { externalId },
      update: data,
      create: { tenantId: input.tenantId, externalId, autoRenew: true, ...data },
    });

    if (!active || active.planId !== input.planId || !previous) {
      await AICreditEngine.syncWalletWithPlan(input.tenantId, input.planId);
    }
    return saved;
  }

  /**
   * Fija el vencimiento del plan a una fecha concreta (planes cobrados en dos
   * partes): activa el plan hasta `periodEnd` sin acortar nunca un acceso ya
   * pagado del mismo plan y modalidad. Re-sincroniza créditos solo si cambia el plan.
   */
  static async setSubscriptionPeriod(input: {
    tenantId: string;
    planId: PlanId;
    billingInterval: BillingInterval;
    periodEnd: Date;
  }) {
    const externalId = payphoneSubscriptionId(input.tenantId);
    const [active, previous] = await Promise.all([
      this.getActiveSubscription(input.tenantId),
      prisma.subscription.findUnique({ where: { externalId } }),
    ]);
    const samePlan = active && active.planId === input.planId && active.billingInterval === input.billingInterval;
    const currentPeriodEnd =
      samePlan && active.currentPeriodEnd > input.periodEnd ? active.currentPeriodEnd : input.periodEnd;

    const data = {
      planId: input.planId,
      billingInterval: input.billingInterval,
      status: "active",
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      renewalAttempts: 0,
      lastRenewalAttemptAt: null,
    };
    const saved = await prisma.subscription.upsert({
      where: { externalId },
      update: data,
      create: { tenantId: input.tenantId, externalId, autoRenew: true, ...data },
    });
    if (!active || active.planId !== input.planId || !previous) {
      await AICreditEngine.syncWalletWithPlan(input.tenantId, input.planId);
    }
    return saved;
  }

  /**
   * Plan cobrado en dos pagos (Academy Executive anual por la Cajita): si el
   * último pago de plan aprobado es la parte 1 y es reciente, falta la parte 2.
   * Devuelve la parte 1 y desde cuándo se puede pagar la 2 (día 2), o null.
   */
  static async getAwaitingSecondInstallment(tenantId: string, now = new Date()) {
    const last = await prisma.payment.findFirst({
      where: { tenantId, kind: "SUBSCRIPTION", status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, planId: true, billingInterval: true, installment: true, amountCents: true, confirmedAt: true, createdAt: true },
    });
    if (!last || last.installment !== 1 || !last.planId || !last.billingInterval) return null;
    const paidAt = last.confirmedAt ?? last.createdAt;
    if (now.getTime() - paidAt.getTime() > SECOND_INSTALLMENT_WINDOW_DAYS * DAY_MS) return null;
    return {
      part1Id: last.id,
      planId: last.planId as PlanId,
      billingInterval: last.billingInterval,
      amountCents: last.amountCents,
      part1PaidAt: paidAt,
      availableAt: new Date(paidAt.getTime() + SECOND_INSTALLMENT_DELAY_HOURS * 60 * 60 * 1000),
    };
  }

  /**
   * Parte 1 aprobada: acceso provisional mientras se paga la parte 2. Nunca
   * acorta un periodo ya pagado (renovación anticipada).
   */
  static async applyFirstInstallment(input: { tenantId: string; planId: PlanId; billingInterval: BillingInterval; paidAt: Date }) {
    return this.setSubscriptionPeriod({
      ...input,
      periodEnd: new Date(input.paidAt.getTime() + PROVISIONAL_ACCESS_DAYS * DAY_MS),
    });
  }

  /**
   * Parte 2 aprobada: el plan queda pagado un periodo completo. Si la academia
   * renovaba con acceso aún vigente, se suma al vencimiento que tenía; si no,
   * el periodo cuenta desde el pago de la parte 1.
   */
  static async applySecondInstallment(input: { tenantId: string; planId: PlanId; billingInterval: BillingInterval; part1PaidAt: Date }) {
    const active = await this.getActiveSubscription(input.tenantId);
    const provisionalEnd = input.part1PaidAt.getTime() + PROVISIONAL_ACCESS_DAYS * DAY_MS;
    const renewing =
      active &&
      active.planId === input.planId &&
      active.billingInterval === input.billingInterval &&
      active.currentPeriodEnd.getTime() > provisionalEnd + 60 * 60 * 1000;
    const base = renewing ? active.currentPeriodEnd : input.part1PaidAt;
    return this.setSubscriptionPeriod({
      tenantId: input.tenantId,
      planId: input.planId,
      billingInterval: input.billingInterval,
      periodEnd: addInterval(base, input.billingInterval),
    });
  }

  /** Activa o desactiva el cobro automático de la tarjeta guardada al vencer. */
  static async setAutoRenew(tenantId: string, enabled: boolean) {
    const sub = await prisma.subscription.findUnique({ where: { externalId: payphoneSubscriptionId(tenantId) } });
    if (!sub) throw new Error("Tu academia aún no tiene un plan pagado con Payphone.");
    return prisma.subscription.update({
      where: { id: sub.id },
      data: { autoRenew: enabled, cancelAtPeriodEnd: !enabled, renewalAttempts: 0 },
    });
  }

  /** Borra la tarjeta guardada: no habrá más cobros automáticos. */
  static async removeSavedCard(tenantId: string) {
    await prisma.paymentCard.deleteMany({ where: { tenantId } });
  }
}

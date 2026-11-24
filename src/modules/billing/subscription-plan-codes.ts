import type { BillingInterval } from "@prisma/client";

/**
 * Códigos de los planes recurrentes que se cobran con un Link de Suscripción
 * de PayPhone (PayPhone gestiona la recurrencia). Módulo puro: seguro para
 * componentes cliente. Las URLs de los links NO están aquí: viven solo en el
 * servidor (payphone-subscription-links.ts).
 *
 * Academy Executive anual (1,910.40) NO usa link: supera el límite de USD 1,000
 * de PayPhone y se cobra con la Cajita en dos pagos de 955.20 (día 1 y día 2),
 * sin renovación automática (ver PayphonePaymentService.startSubscriptionPayment).
 */
export const SUBSCRIPTION_PLAN_CODES = [
  "STARTER_MONTHLY",
  "STARTER_ANNUAL",
  "PROFESSIONAL_VIP_MONTHLY",
  "PROFESSIONAL_VIP_ANNUAL",
  "ACADEMY_EXECUTIVE_MONTHLY",
] as const;

export type SubscriptionPlanCode = (typeof SUBSCRIPTION_PLAN_CODES)[number];

/** Plan interno ("STARTER" | "PRO" | "ACADEMY") y modalidad de cada código. */
export const SUBSCRIPTION_PLAN_CODE_MAP: Record<
  SubscriptionPlanCode,
  { planId: "STARTER" | "PRO" | "ACADEMY"; billingInterval: BillingInterval }
> = {
  STARTER_MONTHLY: { planId: "STARTER", billingInterval: "MONTHLY" },
  STARTER_ANNUAL: { planId: "STARTER", billingInterval: "YEARLY" },
  PROFESSIONAL_VIP_MONTHLY: { planId: "PRO", billingInterval: "MONTHLY" },
  PROFESSIONAL_VIP_ANNUAL: { planId: "PRO", billingInterval: "YEARLY" },
  ACADEMY_EXECUTIVE_MONTHLY: { planId: "ACADEMY", billingInterval: "MONTHLY" },
};

export function isSubscriptionPlanCode(value: unknown): value is SubscriptionPlanCode {
  return typeof value === "string" && (SUBSCRIPTION_PLAN_CODES as readonly string[]).includes(value);
}

/** Código de Link de Suscripción para un plan y modalidad, o null si ese plan no usa link (Academy anual va por la Cajita). */
export function toSubscriptionPlanCode(planId: string, billingInterval: BillingInterval): SubscriptionPlanCode | null {
  const entry = (Object.entries(SUBSCRIPTION_PLAN_CODE_MAP) as [SubscriptionPlanCode, { planId: string; billingInterval: BillingInterval }][]).find(
    ([, v]) => v.planId === planId && v.billingInterval === billingInterval
  );
  return entry ? entry[0] : null;
}

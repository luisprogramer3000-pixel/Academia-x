import type { SubscriptionPlanCode } from "./subscription-plan-codes";

/**
 * Configuración centralizada de los Links de Suscripción de PayPhone
 * (creados en PayPhone Business). SOLO servidor: las URLs nunca viajan en el
 * bundle del cliente y el frontend nunca envía una URL, solo el planCode.
 *
 *   STARTER_MONTHLY           → PAYPHONE_SUB_STARTER_MONTHLY
 *   STARTER_ANNUAL            → PAYPHONE_SUB_STARTER_ANNUAL
 *   PROFESSIONAL_VIP_MONTHLY  → PAYPHONE_SUB_PRO_MONTHLY
 *   PROFESSIONAL_VIP_ANNUAL   → PAYPHONE_SUB_PRO_ANNUAL
 *   ACADEMY_EXECUTIVE_MONTHLY → PAYPHONE_SUB_ACADEMY_MONTHLY
 *
 * Academy Executive anual no tiene link: se cobra con la Cajita en dos pagos.
 */
type LinkKey = SubscriptionPlanCode;

export const PAYPHONE_SUBSCRIPTION_LINK_ENV: Record<LinkKey, string> = {
  STARTER_MONTHLY: "PAYPHONE_SUB_STARTER_MONTHLY",
  STARTER_ANNUAL: "PAYPHONE_SUB_STARTER_ANNUAL",
  PROFESSIONAL_VIP_MONTHLY: "PAYPHONE_SUB_PRO_MONTHLY",
  PROFESSIONAL_VIP_ANNUAL: "PAYPHONE_SUB_PRO_ANNUAL",
  ACADEMY_EXECUTIVE_MONTHLY: "PAYPHONE_SUB_ACADEMY_MONTHLY",
};

/** Se lee en cada llamada (no al importar) para que un cambio de variables no requiera recompilar. */
export function getPayphoneSubscriptionLinks(): Record<LinkKey, string | undefined> {
  return {
    STARTER_MONTHLY: process.env.PAYPHONE_SUB_STARTER_MONTHLY,
    STARTER_ANNUAL: process.env.PAYPHONE_SUB_STARTER_ANNUAL,
    PROFESSIONAL_VIP_MONTHLY: process.env.PAYPHONE_SUB_PRO_MONTHLY,
    PROFESSIONAL_VIP_ANNUAL: process.env.PAYPHONE_SUB_PRO_ANNUAL,
    ACADEMY_EXECUTIVE_MONTHLY: process.env.PAYPHONE_SUB_ACADEMY_MONTHLY,
  };
}

/**
 * URL del link de un plan, o null si la variable falta o no es una URL https
 * válida (el error se registra en el servidor; al usuario se le da un mensaje amable).
 */
export function getPayphoneSubscriptionLink(planCode: LinkKey): string | null {
  const envName = PAYPHONE_SUBSCRIPTION_LINK_ENV[planCode];
  const raw = getPayphoneSubscriptionLinks()[planCode]?.trim();
  if (!raw) {
    console.error(`[payphone] Falta la variable ${envName} (Link de Suscripción de ${planCode}).`);
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") throw new Error("no es https");
    return url.toString();
  } catch {
    console.error(`[payphone] ${envName} no es una URL https válida.`);
    return null;
  }
}

/** Variables de links que faltan (para diagnóstico al arrancar o en el panel de admin). */
export function missingPayphoneSubscriptionLinks(): string[] {
  const links = getPayphoneSubscriptionLinks();
  return (Object.keys(PAYPHONE_SUBSCRIPTION_LINK_ENV) as LinkKey[])
    .filter((code) => !links[code]?.trim())
    .map((code) => PAYPHONE_SUBSCRIPTION_LINK_ENV[code]);
}

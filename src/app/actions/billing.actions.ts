"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantAccess, OWNER_ONLY } from "@/lib/session";
import { BillingService, type BillingInterval } from "@/modules/billing/billing.service";
import { PayphonePaymentService, SecondInstallmentNotYetError } from "@/modules/billing/payphone-payment.service";
import { getI18n } from "@/i18n/server";
import { fmt } from "@/i18n/format";
import { LOCALE_INTL } from "@/i18n/config";
import { formatInTimezone } from "@/lib/timezone";
import { toSubscriptionPlanCode } from "@/modules/billing/subscription-plan-codes";

const createCheckoutSchema = z.object({
  planId: z.enum(["STARTER", "PRO", "ACADEMY"]),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
});

/**
 * Pago puntual de plan con la Cajita/botón de Payphone. Hoy solo lo usa
 * Academy Executive anual (los demás planes van por Link de Suscripción).
 * Solo el OWNER. El tenant se toma SIEMPRE de la sesión. "saveCard" = el cliente
 * aceptó guardar la tarjeta para los cobros automáticos.
 */
export async function createCheckoutAction(formData: FormData): Promise<void> {
  const { tenantId, userId, tenant } = await requireTenantAccess(OWNER_ONLY);
  const { locale, t } = await getI18n();
  const validated = createCheckoutSchema.parse({
    planId: formData.get("planId") as string,
    billingInterval: (formData.get("billingInterval") as string) || "MONTHLY",
  });

  // Los 5 planes recurrentes se contratan con su Link de Suscripción
  // (POST /api/payphone/subscription-checkout), nunca con la Cajita.
  if (toSubscriptionPlanCode(validated.planId, validated.billingInterval as BillingInterval)) {
    redirect(`/dashboard/billing?checkout=error&message=${encodeURIComponent(t.serverErrors.planCheckout)}`);
  }

  let redirectUrl: string;
  try {
    ({ redirectUrl } = await PayphonePaymentService.startSubscriptionPayment({
      tenantId,
      userId,
      planId: validated.planId,
      billingInterval: validated.billingInterval as BillingInterval,
      saveCard: formData.get("saveCard") === "1",
    }));
  } catch (error) {
    const message =
      error instanceof SecondInstallmentNotYetError
        ? fmt(t.serverErrors.secondInstallmentNotYet, {
            date: formatInTimezone(error.availableAt, tenant.timezone, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }, LOCALE_INTL[locale]),
          })
        : t.serverErrors.paymentStartFailed;
    redirect(`/dashboard/billing?checkout=error&message=${encodeURIComponent(message)}`);
  }
  revalidatePath("/dashboard/billing");
  redirect(redirectUrl);
}

/** Activa o desactiva el cobro automático de la tarjeta guardada. */
export async function setAutoRenewAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(OWNER_ONLY);
  await BillingService.setAutoRenew(tenantId, formData.get("enabled") === "1");
  revalidatePath("/dashboard/billing");
}

/** Borra la tarjeta guardada (no habrá más cobros automáticos). */
export async function removeSavedCardAction(): Promise<void> {
  const { tenantId } = await requireTenantAccess(OWNER_ONLY);
  await BillingService.removeSavedCard(tenantId);
  revalidatePath("/dashboard/billing");
}

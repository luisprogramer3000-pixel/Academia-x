"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantAccess, OWNER_ONLY } from "@/lib/session";
import { BillingService, type BillingInterval } from "@/modules/billing/billing.service";
import { PayphonePaymentService } from "@/modules/billing/payphone-payment.service";

const createCheckoutSchema = z.object({
  planId: z.enum(["STARTER", "PRO", "ACADEMY"]),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
});

/**
 * Contratar, renovar o cambiar de plan: lleva al formulario de pago de Payphone.
 * Solo el OWNER. El tenant se toma SIEMPRE de la sesión. "saveCard" = el cliente
 * aceptó guardar la tarjeta para los cobros automáticos.
 */
export async function createCheckoutAction(formData: FormData): Promise<void> {
  const { tenantId, userId } = await requireTenantAccess(OWNER_ONLY);
  const validated = createCheckoutSchema.parse({
    planId: formData.get("planId") as string,
    billingInterval: (formData.get("billingInterval") as string) || "MONTHLY",
  });

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
    const message = error instanceof Error ? error.message : "No se pudo iniciar el pago.";
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

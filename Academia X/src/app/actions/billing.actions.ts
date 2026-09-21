"use server";

import { z } from "zod";
import { BillingService, BillingInterval } from "@/modules/billing/billing.service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTenantAccess, OWNER_ONLY } from "@/lib/session";

const createCheckoutSchema = z.object({
  planId: z.enum(["STARTER", "PRO", "ACADEMY"]),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
});

/**
 * Inicia el checkout de Stripe para el plan elegido. Solo el OWNER puede contratar planes.
 * El tenant se toma SIEMPRE de la sesión.
 */
export async function createCheckoutAction(formData: FormData): Promise<void> {
  const { tenantId, user } = await requireTenantAccess(OWNER_ONLY);

  const validated = createCheckoutSchema.parse({
    planId: formData.get("planId") as string,
    billingInterval: (formData.get("billingInterval") as string) || "MONTHLY",
  });

  const result = await BillingService.createCheckoutSession(
    tenantId,
    validated.planId,
    validated.billingInterval as BillingInterval,
    { customerEmail: user.email }
  );

  revalidatePath("/dashboard/billing");
  redirect(result.checkoutUrl);
}

/**
 * Variante programática. El primer argumento se conserva por compatibilidad pero se IGNORA:
 * el tenant proviene de la sesión.
 */
export async function createCheckoutSessionAction(
  _clientTenantId: string | undefined,
  planId: string,
  billingInterval: string = "MONTHLY"
) {
  try {
    const { tenantId, user } = await requireTenantAccess(OWNER_ONLY);
    const validated = createCheckoutSchema.parse({ planId, billingInterval });

    const result = await BillingService.createCheckoutSession(
      tenantId,
      validated.planId,
      validated.billingInterval as BillingInterval,
      { customerEmail: user.email }
    );

    return { success: true as const, ...result };
  } catch (error: any) {
    return { success: false as const, error: error.message || "FAILED_TO_CREATE_CHECKOUT" };
  }
}

/**
 * Abre el portal de cliente de Stripe (cambiar plan, tarjeta, facturas, cancelar).
 */
export async function openBillingPortalAction(): Promise<void> {
  const { tenantId } = await requireTenantAccess(OWNER_ONLY);
  const portal = await BillingService.createBillingPortalSession(tenantId);
  redirect(portal.url);
}

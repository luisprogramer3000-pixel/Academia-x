"use server";

import { TOPUP_PACKAGES } from "@/modules/ai/ai.topup-catalog";
import { CreditPurchaseService } from "@/modules/billing/credit-purchase.service";
import { requireTenantAccess, OWNER_ONLY, STAFF_ROLES } from "@/lib/session";
import { isMockPaymentsMode } from "@/lib/stripe";
import { prisma } from "@/lib/db";

/**
   Obtiene el catálogo oficial de paquetes Top-Up de créditos de IA.
 */
export async function getTopUpPackagesAction() {
  try {
    return {
      success: true,
      packages: Object.values(TOPUP_PACKAGES),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "FAILED_TO_GET_PACKAGES" };
  }
}

import { topupPackageIdSchema } from "@/lib/validations";

/**
   Crea una intención de compra atómica para un paquete Top-Up.
 */
export async function createTopUpCheckoutAction(
  _clientTenantId: string | undefined,
  packageId: string
) {
  try {
    const { tenantId, userId, user } = await requireTenantAccess(OWNER_ONLY);
    const validPackageId = topupPackageIdSchema.parse(packageId);

    const result = await CreditPurchaseService.createPurchaseIntent({
      tenantId,
      packageId: validPackageId,
      userId,
      customerEmail: user.email,
    });

    return {
      success: true,
      purchaseId: result.purchaseId,
      providerPaymentId: result.providerPaymentId,
      checkoutUrl: result.checkoutUrl,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "FAILED_TO_CREATE_CHECKOUT" };
  }
}

/**
   Cumple una compra de créditos confirmada por el proveedor de pagos.
 */
export async function fulfillTopUpPurchaseAction(providerPaymentId: string) {
  try {
    // En producción los créditos se otorgan EXCLUSIVAMENTE vía webhook de Stripe.
    if (!isMockPaymentsMode()) {
      return { success: false, error: "FULFILLMENT_VIA_WEBHOOK_ONLY" };
    }
    if (!providerPaymentId) {
      return { success: false, error: "PAYMENT_ID_REQUIRED" };
    }
    const { tenantId } = await requireTenantAccess(OWNER_ONLY);
    const purchase = await prisma.aICreditPurchase.findUnique({ where: { providerPaymentId } });
    if (!purchase || purchase.tenantId !== tenantId || purchase.provider !== "mock") {
      return { success: false, error: "PURCHASE_NOT_FOUND" };
    }

    const result = await CreditPurchaseService.fulfillPurchase({
      providerPaymentId,
    });

    return {
      success: true,
      alreadyProcessed: result.alreadyProcessed,
      creditsGranted: result.creditsGranted,
      creditType: result.creditType,
    };
  } catch (error: any) {
    return { success: false, error: error.message || "FAILED_TO_FULFILL_PURCHASE" };
  }
}

/**
   Obtiene el historial de compras de paquetes Top-Up para un tenant.
 */
export async function getTopUpHistoryAction(_clientTenantId?: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);

    const history = await CreditPurchaseService.getTenantPurchaseHistory(tenantId);
    return {
      success: true,
      purchases: history.map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        packageId: p.packageId,
        creditType: p.creditType,
        creditsGranted: p.creditsGranted,
        priceAmount: Number(p.priceAmount),
        currency: p.currency,
        status: p.status,
        userName: p.user?.name || p.user?.email || "Administrador",
        createdAt: p.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message || "FAILED_TO_GET_PURCHASE_HISTORY" };
  }
}

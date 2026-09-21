import {
  IPaymentProvider,
  CheckoutSessionOptions,
  CheckoutSessionResult,
} from "./payment-provider.interface";
import { getStripe, getAppUrl } from "@/lib/stripe";
import { BillingService } from "./billing.service";

/**
 * Proveedor de pagos único (Top-Ups de créditos IA) con Stripe Checkout.
 * Los créditos se otorgan exclusivamente al recibir checkout.session.completed vía webhook.
 */
export class StripePaymentProvider implements IPaymentProvider {
  async createCheckoutSession(options: CheckoutSessionOptions & { packageName?: string; customerEmail?: string }): Promise<CheckoutSessionResult> {
    const customerId = await BillingService.getOrCreateStripeCustomer(options.tenantId, options.customerEmail);
    const appUrl = getAppUrl();

    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        client_reference_id: options.tenantId,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: options.currency.toLowerCase(),
              unit_amount: Math.round(options.amount * 100),
              product_data: { name: options.packageName || `Créditos IA (${options.packageId})` },
            },
          },
        ],
        metadata: {
          type: "topup",
          purchaseId: options.idempotencyKey,
          tenantId: options.tenantId,
          packageId: options.packageId,
        },
        success_url: `${appUrl}/dashboard/ai-copilot?topup=success`,
        cancel_url: `${appUrl}/dashboard/ai-copilot?topup=canceled`,
      },
      { idempotencyKey: `topup_checkout:${options.idempotencyKey}` }
    );

    if (!session.url) throw new Error("Stripe no devolvió una URL de pago.");

    return {
      providerPaymentId: session.id,
      checkoutUrl: session.url,
      status: "PENDING",
    };
  }
}

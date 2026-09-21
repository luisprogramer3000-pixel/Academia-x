import {
  IPaymentProvider,
  CheckoutSessionOptions,
  CheckoutSessionResult,
} from "./payment-provider.interface";

export class MockPaymentProvider implements IPaymentProvider {
  async createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult> {
    const providerPaymentId = `mock_pay_${options.idempotencyKey}`;
    const checkoutUrl = `/dashboard/billing?topup_success=true&pay_id=${providerPaymentId}`;

    return {
      providerPaymentId,
      checkoutUrl,
      status: "PENDING",
    };
  }
}

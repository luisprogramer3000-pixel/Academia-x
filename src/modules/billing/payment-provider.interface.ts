export interface CheckoutSessionOptions {
  tenantId: string;
  userId?: string;
  packageId: string;
  packageName?: string;
  customerEmail?: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
}

export interface CheckoutSessionResult {
  providerPaymentId: string;
  checkoutUrl: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
}

export interface IPaymentProvider {
  createCheckoutSession(options: CheckoutSessionOptions): Promise<CheckoutSessionResult>;
}

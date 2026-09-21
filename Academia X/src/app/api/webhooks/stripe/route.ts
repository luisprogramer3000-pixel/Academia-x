import { NextResponse } from "next/server";
import { BillingService } from "@/modules/billing/billing.service";
import { CreditPurchaseService } from "@/modules/billing/credit-purchase.service";
import { verifyStripeWebhookSignature } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured" },
      { status: 500 }
    );
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json(
      { error: "Could not read request body" },
      { status: 400 }
    );
  }

  const signature = req.headers.get("stripe-signature");

  const verification = verifyStripeWebhookSignature({
    rawBody,
    signatureHeader: signature,
    secret: webhookSecret,
  });

  if (!verification.valid) {
    return NextResponse.json(
      { error: verification.error || "Invalid signature" },
      { status: 400 }
    );
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  if (!event || !event.type) {
    return NextResponse.json(
      { error: "Invalid Stripe event structure" },
      { status: 400 }
    );
  }

  try {
    // 1. Manejo de compras Top-Up completadas
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data?.object || {};
      const metadata = session.metadata || {};
      if (metadata.type === "topup" || metadata.purchaseId) {
        // Pagos asíncronos (p. ej. transferencias) completan el checkout sin cobro: esperar async_payment_succeeded
        if (session.payment_status && session.payment_status !== "paid") {
          return NextResponse.json({ received: true, type: "topup", pending: true }, { status: 200 });
        }
        const topupResult = await CreditPurchaseService.fulfillPurchase({
          providerPaymentId: event.data.object.id,
          purchaseId: metadata.purchaseId,
        });

        return NextResponse.json(
          { received: true, type: "topup", ...topupResult },
          { status: 200 }
        );
      }
    }

    // 2. Manejo de suscripciones SaaS y eventos soportados
    const result = await BillingService.handleStripeWebhook(event);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("[stripe-webhook] Error procesando evento", event?.type, error?.message);
    return NextResponse.json(
      { error: "Error al procesar el webhook" },
      { status: 500 }
    );
  }
}

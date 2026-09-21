import { resetTestStripeEvents } from "./helpers/session";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as stripeWebhookHandler } from "@/app/api/webhooks/stripe/route";
import { BillingService, SAAS_PLANS } from "@/modules/billing/billing.service";
import { CreditPurchaseService } from "@/modules/billing/credit-purchase.service";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { TOPUP_PACKAGES } from "@/modules/ai/ai.topup-catalog";
import { generateStripeTestSignature } from "@/lib/stripe";
import { createTopUpCheckoutAction } from "@/app/actions/topup.actions";
import { prisma } from "@/lib/db";

describe("Stripe Sandbox / Test Mode + Webhooks Suite — Step 6.4", () => {
  const testSecret = "whsec_test_secret_for_vitest_sandbox_verification_12345";
  const originalEnv = { ...process.env };

  const tenantAId = "tenant_stripe_a_id";
  const tenantBId = "tenant_stripe_b_id";
  const userAId = "user_stripe_a_id";

  beforeEach(async () => {
    await resetTestStripeEvents();
    process.env = { ...originalEnv };
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_sandbox_key";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_mock_sandbox_key";

    // Limpieza de base de datos
    await prisma.aICreditPurchase.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: userAId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    // Sembrar tenants de prueba
    await prisma.tenant.create({
      data: { id: tenantAId, name: "Stripe Tenant A", slug: "stripe-tenant-a" },
    });
    await prisma.tenant.create({
      data: { id: tenantBId, name: "Stripe Tenant B", slug: "stripe-tenant-b" },
    });
    await prisma.user.create({
      data: { id: userAId, email: "user_stripe_a@test.com", name: "Prof. Stripe User A" },
    });
    await prisma.membership.create({
      data: { tenantId: tenantAId, userId: userAId, role: "OWNER" },
    });

    // Inicializar wallets de créditos
    await AICreditEngine.getTenantWalletSummary(tenantAId);
    await AICreditEngine.getTenantWalletSummary(tenantBId);
  }, 30000);

  afterEach(async () => {
    process.env = { ...originalEnv };

    await prisma.aICreditPurchase.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: userAId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  }, 30000);

  it("A. Checkout válido: Generación de Checkout Session autoritativa de suscripción y Top-Up", async () => {
    // 1. Checkout de suscripción SaaS
    const subCheckout = await BillingService.createCheckoutSession(tenantAId, "PRO");
    expect(subCheckout.checkoutUrl).toContain("success=true");
    expect(subCheckout.checkoutUrl).toContain("plan=PRO");
    expect(subCheckout.subscription).toBeDefined();

    // 2. Checkout de Top-Up
    const topupIntent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });
    expect(topupIntent.status).toBe("PENDING");
    expect(topupIntent.pkg.price).toBe(15);
    expect(topupIntent.pkg.credits).toBe(50);
  });

  it("B. Precio manipulado / rechazado: Validación Zod y catálogo autoritativo rechazan precios o paquetes alterados", async () => {
    // 1. Paquete inválido
    const invalidPkgRes = await createTopUpCheckoutAction(tenantAId, "HACKED_FREE_CREDITS");
    expect(invalidPkgRes.success).toBe(false);
    expect(invalidPkgRes.error).toContain("Paquete de Top-Up inválido");

    // 2. Plan no válido en BillingService
    await expect(BillingService.createCheckoutSession(tenantAId, "FREE_HACK" as any)).rejects.toThrow(/Plan no válido/);
  });

  it("C. Webhook con firma válida: Procesa exitosamente y responde HTTP 200", async () => {
    const event = {
      id: "evt_test_valid_signature_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test_valid_sig",
          customer: "cus_test_valid_sig",
          status: "active",
          metadata: { tenantId: tenantAId, planId: "PRO" },
        },
      },
    };

    const rawBody = JSON.stringify(event);
    const signature = generateStripeTestSignature({ rawBody, secret: testSecret });

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      body: rawBody,
    });

    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it("D. Webhook con firma inválida: Rechaza con HTTP 400 por discrepancia criptográfica", async () => {
    const event = { id: "evt_tampered", type: "customer.subscription.updated", data: {} };
    const rawBody = JSON.stringify(event);

    const nowSeconds = Math.floor(Date.now() / 1000);
    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${nowSeconds},v1=bad_signature_hex_00000000000000000000000000000000`,
      },
      body: rawBody,
    });

    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Signature mismatch");
  });

  it("E. Webhook duplicado: Múltiples entregas del mismo evento no duplican suscripciones", async () => {
    const stripeSubId = "sub_stripe_dedup_test";
    const event = {
      id: "evt_test_dedup",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: stripeSubId,
          customer: "cus_stripe_dedup",
          status: "active",
          metadata: { tenantId: tenantAId, planId: "PRO" },
        },
      },
    };

    const rawBody = JSON.stringify(event);
    const signature = generateStripeTestSignature({ rawBody, secret: testSecret });

    // 1er envío
    const req1 = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res1 = await stripeWebhookHandler(req1);
    expect(res1.status).toBe(200);

    // 2do envío (reintento de Stripe)
    const req2 = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res2 = await stripeWebhookHandler(req2);
    expect(res2.status).toBe(200);

    // Comprobar que en base de datos existe exactamente una suscripción con ese ID
    const count = await prisma.subscription.count({
      where: { stripeSubscriptionId: stripeSubId },
    });
    expect(count).toBe(1);
  });

  it("F. Evento Stripe desconocido: Se reconoce con HTTP 200 sin producir excepciones", async () => {
    const event = {
      id: "evt_unknown_info",
      type: "payment_intent.created",
      data: { object: { id: "pi_12345" } },
    };

    const rawBody = JSON.stringify(event);
    const signature = generateStripeTestSignature({ rawBody, secret: testSecret });

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });

    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it("G. Subscription update: Actualización de plan sincroniza la billetera de créditos AI", async () => {
    // Inicializar en STARTER
    await BillingService.createCheckoutSession(tenantAId, "STARTER");
    let wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(150);

    // Webhook de upgrade a ACADEMY
    const event = {
      id: "evt_upgrade_academy",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: `sub_upgrade_${tenantAId}`,
          customer: `cus_${tenantAId}`,
          status: "active",
          metadata: { tenantId: tenantAId, planId: "ACADEMY" },
        },
      },
    };

    const rawBody = JSON.stringify(event);
    const signature = generateStripeTestSignature({ rawBody, secret: testSecret });

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });

    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(200);

    // Verificar actualización de suscripción y saldo en wallet (ACADEMY = 2,000 Teacher credits)
    const sub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: `sub_upgrade_${tenantAId}` },
    });
    expect(sub?.planId).toBe("ACADEMY");

    wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(2000);
    expect(wallet.studentCredits.available).toBe(800);
  });

  it("H. Top-Up confirmado: Webhook checkout.session.completed cumple la compra y otorga créditos", async () => {
    // 1. Crear intención de compra de 150 créditos Teacher
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_150",
    });

    // 2. Webhook de checkout completado por Stripe
    const event = {
      id: "evt_topup_completed_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: intent.providerPaymentId,
          metadata: {
            type: "topup",
            purchaseId: intent.purchaseId,
            tenantId: tenantAId,
          },
        },
      },
    };

    const rawBody = JSON.stringify(event);
    const signature = generateStripeTestSignature({ rawBody, secret: testSecret });

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });

    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.received).toBe(true);
    expect(json.type).toBe("topup");
    expect(json.creditsGranted).toBe(150);

    // Verificar en BD que el status sea COMPLETED
    const purchase = await prisma.aICreditPurchase.findUnique({ where: { id: intent.purchaseId } });
    expect(purchase?.status).toBe("COMPLETED");

    // Verificar saldo en billetera
    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(150 + 150); // 150 base + 150 topup
  });

  it("I. Top-Up duplicado: Reintento de webhook de Top-Up completado no duplica créditos (alreadyProcessed: true)", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    const event = {
      id: "evt_topup_dedup_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: intent.providerPaymentId,
          metadata: {
            type: "topup",
            purchaseId: intent.purchaseId,
            tenantId: tenantAId,
          },
        },
      },
    };

    const rawBody = JSON.stringify(event);
    const signature = generateStripeTestSignature({ rawBody, secret: testSecret });

    // 1er Fulfillment
    const req1 = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res1 = await stripeWebhookHandler(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.alreadyProcessed).toBe(false);

    // 2do Fulfillment (Reintento de Stripe)
    const req2 = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res2 = await stripeWebhookHandler(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.alreadyProcessed).toBe(true);

    // Saldo verificado: Solo 50 créditos añadidos una vez
    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(150 + 50);
  });

  it("J. Protección multi-tenant: Los eventos del Tenant A no alteran el Tenant B", async () => {
    const eventA = {
      id: "evt_tenant_a",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_tenant_a_unique",
          customer: "cus_tenant_a",
          status: "active",
          metadata: { tenantId: tenantAId, planId: "ACADEMY" },
        },
      },
    };

    const rawBody = JSON.stringify(eventA);
    const signature = generateStripeTestSignature({ rawBody, secret: testSecret });

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });

    await stripeWebhookHandler(req);

    // Tenant A actualizado a ACADEMY
    const subA = await prisma.subscription.findFirst({ where: { tenantId: tenantAId } });
    expect(subA?.planId).toBe("ACADEMY");

    // Tenant B sin suscripción ni impacto
    const subB = await prisma.subscription.findFirst({ where: { tenantId: tenantBId } });
    expect(subB).toBeNull();
  });

  it("K. Falta de STRIPE_WEBHOOK_SECRET: Rechaza con HTTP 500 Fail-Fast", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "ping" }),
    });

    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toBe("STRIPE_WEBHOOK_SECRET is not configured");
  });

  it("L. Error de Stripe correctamente manejado: JSON corrupto responde HTTP 400", async () => {
    const malformedRawBody = "{ invalid_json_payload: ";
    const signature = generateStripeTestSignature({ rawBody: malformedRawBody, secret: testSecret });

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: malformedRawBody,
    });

    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Invalid JSON payload");
  });
});

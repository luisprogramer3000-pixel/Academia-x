import { resetTestStripeEvents } from "./helpers/session";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as stripeWebhookHandler } from "@/app/api/webhooks/stripe/route";
import {
  BillingService,
  SAAS_PLANS,
  getStripePriceId,
  BillingInterval,
} from "@/modules/billing/billing.service";
import { createCheckoutSessionAction } from "@/app/actions/billing.actions";
import { CreditPurchaseService } from "@/modules/billing/credit-purchase.service";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { generateStripeTestSignature } from "@/lib/stripe";
import { prisma } from "@/lib/db";

describe("Stripe Sandbox End-to-End Suite — Step 6.7", () => {
  const testWebhookSecret = "whsec_sandbox_e2e_verification_test_secret_998877";
  const originalEnv = { ...process.env };

  const tenantAId = "tenant_e2e_stripe_a";
  const tenantBId = "tenant_e2e_stripe_b";
  const userAId = "user_e2e_stripe_a";
  const userBId = "user_e2e_stripe_b";

  beforeEach(async () => {
    await resetTestStripeEvents();
    process.env = { ...originalEnv };
    process.env.STRIPE_WEBHOOK_SECRET = testWebhookSecret;
    process.env.STRIPE_SECRET_KEY = "sk_test_mock_sandbox_key";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_mock_sandbox_key";

    // Precios de entorno de prueba configurados
    process.env.STRIPE_PRICE_STARTER_MONTHLY = "price_test_starter_monthly_123";
    process.env.STRIPE_PRICE_STARTER_YEARLY = "price_test_starter_yearly_123";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_test_pro_monthly_123";
    process.env.STRIPE_PRICE_PRO_YEARLY = "price_test_pro_yearly_123";
    process.env.STRIPE_PRICE_ACADEMY_MONTHLY = "price_test_academy_monthly_123";
    process.env.STRIPE_PRICE_ACADEMY_YEARLY = "price_test_academy_yearly_123";

    // Limpieza de datos
    await prisma.aICreditPurchase.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    // Sembrar tenants y usuarios
    await prisma.tenant.create({
      data: { id: tenantAId, name: "Tenant A Sandbox", slug: "tenant-a-sandbox" },
    });
    await prisma.tenant.create({
      data: { id: tenantBId, name: "Tenant B Sandbox", slug: "tenant-b-sandbox" },
    });

    await prisma.user.create({
      data: { id: userAId, email: "user_a@sandbox.com", name: "Profesor A" },
    });
    await prisma.user.create({
      data: { id: userBId, email: "user_b@sandbox.com", name: "Profesor B" },
    });

    await prisma.membership.create({
      data: { tenantId: tenantAId, userId: userAId, role: "OWNER" },
    });
    await prisma.membership.create({
      data: { tenantId: tenantBId, userId: userBId, role: "OWNER" },
    });

    // Inicializar wallets
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
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  }, 30000);

  // A. Price ID correcto para Starter Monthly
  it("A. Price ID correcto para Starter Monthly", () => {
    const priceId = getStripePriceId("STARTER", "MONTHLY");
    expect(priceId).toBe("price_test_starter_monthly_123");
    expect(SAAS_PLANS.STARTER.pricing.MONTHLY.amountCents).toBe(2900);
    expect(SAAS_PLANS.STARTER.pricing.MONTHLY.price).toBe(29);
  });

  // B. Price ID correcto para Starter Yearly
  it("B. Price ID correcto para Starter Yearly", () => {
    const priceId = getStripePriceId("STARTER", "YEARLY");
    expect(priceId).toBe("price_test_starter_yearly_123");
    expect(SAAS_PLANS.STARTER.pricing.YEARLY.amountCents).toBe(27840);
    expect(SAAS_PLANS.STARTER.pricing.YEARLY.price).toBe(278.4);
    expect(SAAS_PLANS.STARTER.pricing.YEARLY.equivalentMonthlyPrice).toBe(23.2);
  });

  // C. Price ID correcto para Pro Monthly
  it("C. Price ID correcto para Pro Monthly", () => {
    const priceId = getStripePriceId("PRO", "MONTHLY");
    expect(priceId).toBe("price_test_pro_monthly_123");
    expect(SAAS_PLANS.PRO.pricing.MONTHLY.amountCents).toBe(7900);
    expect(SAAS_PLANS.PRO.pricing.MONTHLY.price).toBe(79);
  });

  // D. Price ID correcto para Pro Yearly
  it("D. Price ID correcto para Pro Yearly", () => {
    const priceId = getStripePriceId("PRO", "YEARLY");
    expect(priceId).toBe("price_test_pro_yearly_123");
    expect(SAAS_PLANS.PRO.pricing.YEARLY.amountCents).toBe(75840);
    expect(SAAS_PLANS.PRO.pricing.YEARLY.price).toBe(758.4);
    expect(SAAS_PLANS.PRO.pricing.YEARLY.equivalentMonthlyPrice).toBe(63.2);
  });

  // E. Price ID correcto para Academy Monthly
  it("E. Price ID correcto para Academy Monthly", () => {
    const priceId = getStripePriceId("ACADEMY", "MONTHLY");
    expect(priceId).toBe("price_test_academy_monthly_123");
    expect(SAAS_PLANS.ACADEMY.pricing.MONTHLY.amountCents).toBe(19900);
    expect(SAAS_PLANS.ACADEMY.pricing.MONTHLY.price).toBe(199);
  });

  // F. Price ID correcto para Academy Yearly
  it("F. Price ID correcto para Academy Yearly", () => {
    const priceId = getStripePriceId("ACADEMY", "YEARLY");
    expect(priceId).toBe("price_test_academy_yearly_123");
    expect(SAAS_PLANS.ACADEMY.pricing.YEARLY.amountCents).toBe(191040);
    expect(SAAS_PLANS.ACADEMY.pricing.YEARLY.price).toBe(1910.4);
    expect(SAAS_PLANS.ACADEMY.pricing.YEARLY.equivalentMonthlyPrice).toBe(159.2);
  });

  // G. Importe enviado por cliente no puede alterar precio
  it("G. Importe enviado por cliente no puede alterar precio", async () => {
    const session = await BillingService.createCheckoutSession(tenantAId, "PRO", "YEARLY");
    // El precio debe ser exactamente 75840 centavos ($758.40) según el catálogo oficial del servidor
    expect(session.amountCents).toBe(75840);
    expect(session.stripePriceId).toBe("price_test_pro_yearly_123");
  });

  // H. Price ID arbitrario enviado por cliente es rechazado/ignorado
  it("H. Price ID arbitrario enviado por cliente es rechazado/ignorado", async () => {
    const actionResult = await createCheckoutSessionAction(tenantAId, "INVALID_PLAN_ID", "MONTHLY");
    expect(actionResult.success).toBe(false);
    expect(actionResult.error).toBeDefined();

    // Invocación directa a getStripePriceId con plan inválido lanza excepción
    expect(() => getStripePriceId("HACKED_PLAN" as any, "MONTHLY")).toThrow(/Plan no válido/);
  });

  // I. billingInterval inválido es rechazado
  it("I. billingInterval inválido es rechazado", async () => {
    const actionResult = await createCheckoutSessionAction(tenantAId, "PRO", "BIWEEKLY_INVALID" as any);
    expect(actionResult.success).toBe(false);
    expect(actionResult.error).toBeDefined();
  });

  // J. Subscription MONTHLY queda correctamente persistida
  it("J. Subscription MONTHLY queda correctamente persistida", async () => {
    await BillingService.createCheckoutSession(tenantAId, "STARTER", "MONTHLY");

    const sub = await prisma.subscription.findFirst({
      where: { tenantId: tenantAId },
    });

    expect(sub).toBeDefined();
    expect(sub?.planId).toBe("STARTER");
    expect(sub?.billingInterval).toBe("MONTHLY");
    expect(sub?.status).toBe("active");
  });

  // K. Subscription YEARLY queda correctamente persistida
  it("K. Subscription YEARLY queda correctamente persistida", async () => {
    await BillingService.createCheckoutSession(tenantAId, "ACADEMY", "YEARLY");

    const sub = await prisma.subscription.findFirst({
      where: { tenantId: tenantAId },
    });

    expect(sub).toBeDefined();
    expect(sub?.planId).toBe("ACADEMY");
    expect(sub?.billingInterval).toBe("YEARLY");
    expect(sub?.status).toBe("active");
  });

  // L. Webhook válido es aceptado
  it("L. Webhook válido es aceptado", async () => {
    const event = {
      id: "evt_valid_sandbox_e2e_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_sandbox_valid_1",
          customer: "cus_sandbox_valid_1",
          status: "active",
          metadata: {
            tenantId: tenantAId,
            planId: "PRO",
            billingInterval: "MONTHLY",
          },
        },
      },
    };

    const rawBody = JSON.stringify(event);
    const signature = generateStripeTestSignature({ rawBody, secret: testWebhookSecret });

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

    const sub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: "sub_sandbox_valid_1" },
    });
    expect(sub?.planId).toBe("PRO");
    expect(sub?.billingInterval).toBe("MONTHLY");
  });

  // M. Webhook con firma inválida es rechazado
  it("M. Webhook con firma inválida es rechazado", async () => {
    const event = {
      id: "evt_tampered_sig",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_tampered" } },
    };

    const rawBody = JSON.stringify(event);
    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=invalid_hmac_hex_key_1234567890`,
      },
      body: rawBody,
    });

    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Signature mismatch");
  });

  // N. Webhook repetido no duplica la suscripción
  it("N. Webhook repetido no duplica la suscripción", async () => {
    const stripeSubId = "sub_sandbox_dedup_unique_123";
    const event = {
      id: "evt_dedup_delivery",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: stripeSubId,
          customer: "cus_sandbox_dedup",
          status: "active",
          metadata: {
            tenantId: tenantAId,
            planId: "PRO",
            billingInterval: "YEARLY",
          },
        },
      },
    };

    const rawBody = JSON.stringify(event);
    const signature = generateStripeTestSignature({ rawBody, secret: testWebhookSecret });

    // 1ra entrega
    const req1 = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res1 = await stripeWebhookHandler(req1);
    expect(res1.status).toBe(200);

    // 2da entrega (reintento idempotente)
    const req2 = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res2 = await stripeWebhookHandler(req2);
    expect(res2.status).toBe(200);

    const count = await prisma.subscription.count({
      where: { stripeSubscriptionId: stripeSubId },
    });
    expect(count).toBe(1);
  });

  // O. Subscription queda asociada al tenant correcto
  it("O. Subscription queda asociada al tenant correcto", async () => {
    await BillingService.createCheckoutSession(tenantAId, "PRO", "MONTHLY");

    const subA = await prisma.subscription.findFirst({ where: { tenantId: tenantAId } });
    const subB = await prisma.subscription.findFirst({ where: { tenantId: tenantBId } });

    expect(subA).toBeDefined();
    expect(subA?.tenantId).toBe(tenantAId);
    expect(subB).toBeNull();
  });

  // P. Wallet queda asociada al tenant correcto
  it("P. Wallet queda asociada al tenant correcto", async () => {
    const walletA = await AICreditEngine.getTenantWalletSummary(tenantAId);
    const walletB = await AICreditEngine.getTenantWalletSummary(tenantBId);

    expect(walletA.tenantId).toBe(tenantAId);
    expect(walletB.tenantId).toBe(tenantBId);
  });

  // Q. YEARLY no asigna 12 meses de créditos
  it("Q. YEARLY no asigna 12 meses de créditos", async () => {
    // Contratar ACADEMY YEARLY
    await BillingService.createCheckoutSession(tenantAId, "ACADEMY", "YEARLY");

    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    // Debe recibir la cuota mensual estándar (2,000 Teacher / 800 Student) y NO 24,000 ni 9,600
    expect(wallet.teacherCredits.available).toBe(2000);
    expect(wallet.studentCredits.available).toBe(800);
    expect(wallet.teacherCredits.monthlyAllowance).toBe(2000);
    expect(wallet.studentCredits.monthlyAllowance).toBe(800);
  });

  // R. MONTHLY mantiene la cuota mensual
  it("R. MONTHLY mantiene la cuota mensual", async () => {
    // Contratar STARTER MONTHLY
    await BillingService.createCheckoutSession(tenantAId, "STARTER", "MONTHLY");

    const walletStarter = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(walletStarter.teacherCredits.available).toBe(150);
    expect(walletStarter.studentCredits.available).toBe(0);

    // Contratar PRO MONTHLY
    await BillingService.createCheckoutSession(tenantAId, "PRO", "MONTHLY");
    const walletPro = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(walletPro.teacherCredits.available).toBe(600);
    expect(walletPro.studentCredits.available).toBe(200);
  });

  // S. Top-Ups permanecen intactos
  it("S. Top-Ups permanecen intactos ante cambio de plan y cancelación", async () => {
    // 1. Iniciar en STARTER y comprar Top-Up de 150 créditos Teacher
    await BillingService.createCheckoutSession(tenantAId, "STARTER", "MONTHLY");
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_150",
    });

    await CreditPurchaseService.fulfillPurchase({
      purchaseId: intent.purchaseId,
    });

    let wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(150 + 150); // 300
    expect(wallet.teacherCredits.purchasedCredits).toBe(150);

    // 2. Upgrade a PRO (cuota base 600) -> 600 + 150 topup = 750
    await BillingService.createCheckoutSession(tenantAId, "PRO", "MONTHLY");
    wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(600 + 150);
    expect(wallet.teacherCredits.purchasedCredits).toBe(150);

    // 3. Webhook de cancelación (customer.subscription.deleted)
    const cancelEvent = {
      id: "evt_cancel_e2e",
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: `sub_simulated_${tenantAId}`,
          metadata: { tenantId: tenantAId },
        },
      },
    };
    const rawBody = JSON.stringify(cancelEvent);
    const signature = generateStripeTestSignature({ rawBody, secret: testWebhookSecret });

    const req = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res = await stripeWebhookHandler(req);
    expect(res.status).toBe(200);

    // Suscripción marcada como cancelada sin destruir la wallet ni los Top-Ups
    const sub = await prisma.subscription.findFirst({ where: { tenantId: tenantAId } });
    expect(sub?.status).toBe("canceled");

    wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.purchasedCredits).toBe(150);
  });

  // T. Tenant A no puede modificar Subscription de Tenant B
  it("T. Tenant A no puede modificar Subscription de Tenant B", async () => {
    // Configurar suscripción inicial de Tenant B en STARTER
    await BillingService.createCheckoutSession(tenantBId, "STARTER", "MONTHLY");

    // Operación realizada sobre Tenant A cambiando a ACADEMY
    await BillingService.createCheckoutSession(tenantAId, "ACADEMY", "YEARLY");

    const subA = await prisma.subscription.findFirst({ where: { tenantId: tenantAId } });
    const subB = await prisma.subscription.findFirst({ where: { tenantId: tenantBId } });

    expect(subA?.planId).toBe("ACADEMY");
    expect(subA?.billingInterval).toBe("YEARLY");

    // Tenant B permanece completamente inalterado en STARTER MONTHLY
    expect(subB?.planId).toBe("STARTER");
    expect(subB?.billingInterval).toBe("MONTHLY");
  });
});

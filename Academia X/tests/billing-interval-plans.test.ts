import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BillingService, SAAS_PLANS, getStripePriceId, BillingInterval } from "@/modules/billing/billing.service";
import { createCheckoutSessionAction } from "@/app/actions/billing.actions";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { POST as stripeWebhookHandler } from "@/app/api/webhooks/stripe/route";
import { generateStripeTestSignature } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import { loginAs, resetTestStripeEvents } from "./helpers/session";

describe("SaaS Plans Monthly & Yearly Billing Suite — 20% Discount Adjustment", () => {
  const testSecret = "whsec_test_billing_interval_suite_12345";
  const originalEnv = { ...process.env };

  const tenantAId = "tenant_billing_interval_a";
  const tenantBId = "tenant_billing_interval_b";

  beforeEach(async () => {
    await resetTestStripeEvents();
    process.env = { ...originalEnv };
    process.env.STRIPE_WEBHOOK_SECRET = testSecret;

    // Limpieza de base de datos
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    // Sembrar tenants de prueba
    await prisma.tenant.create({
      data: { id: tenantAId, name: "Interval Tenant A", slug: "interval-tenant-a" },
    });
    await prisma.tenant.create({
      data: { id: tenantBId, name: "Interval Tenant B", slug: "interval-tenant-b" },
    });

    await AICreditEngine.getTenantWalletSummary(tenantAId);
    await AICreditEngine.getTenantWalletSummary(tenantBId);
  }, 30000);

  afterEach(async () => {
    process.env = { ...originalEnv };

    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  }, 30000);

  it("A. Starter Monthly: $29/mes (2900 centavos exactos)", () => {
    const starter = SAAS_PLANS.STARTER;
    expect(starter.price).toBe(29);
    expect(starter.pricing.MONTHLY.price).toBe(29);
    expect(starter.pricing.MONTHLY.amountCents).toBe(2900);
    expect(starter.pricing.MONTHLY.currency).toBe("USD");
  });

  it("B. Starter Yearly: 20% descuento exacto ($278.40/año = 27840 centavos, $23.20/mes equiv, $69.60 ahorro)", () => {
    const starterYearly = SAAS_PLANS.STARTER.pricing.YEARLY;
    // 12 * 29 = 348; 348 * 0.20 = 69.60; 348 - 69.60 = 278.40
    expect(starterYearly.price).toBe(278.4);
    expect(starterYearly.amountCents).toBe(27840);
    expect(starterYearly.equivalentMonthlyPrice).toBe(23.2);
    expect(starterYearly.annualSavings).toBe(69.6);
  });

  it("C. Professional Monthly: $79/mes (7900 centavos exactos)", () => {
    const pro = SAAS_PLANS.PRO;
    expect(pro.price).toBe(79);
    expect(pro.pricing.MONTHLY.price).toBe(79);
    expect(pro.pricing.MONTHLY.amountCents).toBe(7900);
    expect(pro.pricing.MONTHLY.currency).toBe("USD");
  });

  it("D. Professional Yearly: 20% descuento exacto ($758.40/año = 75840 centavos, $63.20/mes equiv, $189.60 ahorro)", () => {
    const proYearly = SAAS_PLANS.PRO.pricing.YEARLY;
    // 12 * 79 = 948; 948 * 0.20 = 189.60; 948 - 189.60 = 758.40
    expect(proYearly.price).toBe(758.4);
    expect(proYearly.amountCents).toBe(75840);
    expect(proYearly.equivalentMonthlyPrice).toBe(63.2);
    expect(proYearly.annualSavings).toBe(189.6);
  });

  it("E. Academy Monthly: $199/mes (19900 centavos exactos)", () => {
    const academy = SAAS_PLANS.ACADEMY;
    expect(academy.price).toBe(199);
    expect(academy.pricing.MONTHLY.price).toBe(199);
    expect(academy.pricing.MONTHLY.amountCents).toBe(19900);
    expect(academy.pricing.MONTHLY.currency).toBe("USD");
  });

  it("F. Academy Yearly: 20% descuento exacto ($1,910.40/año = 191040 centavos, $159.20/mes equiv, $477.60 ahorro)", () => {
    const academyYearly = SAAS_PLANS.ACADEMY.pricing.YEARLY;
    // 12 * 199 = 2388; 2388 * 0.20 = 477.60; 2388 - 477.60 = 1910.40
    expect(academyYearly.price).toBe(1910.4);
    expect(academyYearly.amountCents).toBe(191040);
    expect(academyYearly.equivalentMonthlyPrice).toBe(159.2);
    expect(academyYearly.annualSavings).toBe(477.6);
  });

  it("G. Precio enviado o manipulado desde cliente debe ser ignorado y resuelto autoritativamente en servidor", async () => {
    // El servidor resuelve el precio basándose en planId y billingInterval
    const res = await BillingService.createCheckoutSession(tenantAId, "PRO", "YEARLY");
    expect(res.amountCents).toBe(75840); // 758.40 en centavos
    expect(res.billingInterval).toBe("YEARLY");
    expect(res.checkoutUrl).toContain("plan=PRO");
    expect(res.checkoutUrl).toContain("interval=YEARLY");
  });

  it("H. billingInterval inválido debe ser rechazado estrictamente por validación", async () => {
    const result = await createCheckoutSessionAction(tenantAId, "PRO", "LIFETIME_FREE" as any);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("I. Usuario no debe poder seleccionar un Price ID arbitrario", () => {
    // getStripePriceId sólo resuelve IDs desde catálogo y variables de entorno autorizadas
    const starterMonthlyPriceId = getStripePriceId("STARTER", "MONTHLY");
    const starterYearlyPriceId = getStripePriceId("STARTER", "YEARLY");
    const proYearlyPriceId = getStripePriceId("PRO", "YEARLY");

    expect(starterMonthlyPriceId).toBeDefined();
    expect(starterYearlyPriceId).toBeDefined();
    expect(starterMonthlyPriceId).not.toBe(starterYearlyPriceId);
    expect(starterYearlyPriceId).not.toBe(proYearlyPriceId);

    // Plan inválido lanza error
    expect(() => getStripePriceId("UNKNOWN" as any, "MONTHLY")).toThrow(/Plan no válido/);
  });

  it("J. Subscription debe conservar correctamente MONTHLY y YEARLY en base de datos", async () => {
    // 1. Crear suscripción anual
    await BillingService.createCheckoutSession(tenantAId, "PRO", "YEARLY");
    const subYearly = await prisma.subscription.findFirst({ where: { tenantId: tenantAId } });
    expect(subYearly?.billingInterval).toBe("YEARLY");
    expect(subYearly?.planId).toBe("PRO");

    // 2. Cambiar a suscripción mensual
    await BillingService.createCheckoutSession(tenantAId, "STARTER", "MONTHLY");
    const subMonthly = await prisma.subscription.findFirst({ where: { tenantId: tenantAId } });
    expect(subMonthly?.billingInterval).toBe("MONTHLY");
    expect(subMonthly?.planId).toBe("STARTER");
  });

  it("K. Webhook duplicado debe continuar siendo idempotente con billingInterval", async () => {
    const event = {
      id: "evt_dedup_interval_test",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: `sub_dedup_${tenantAId}`,
          customer: `cus_${tenantAId}`,
          status: "active",
          metadata: {
            tenantId: tenantAId,
            planId: "ACADEMY",
            billingInterval: "YEARLY",
          },
        },
      },
    };

    const rawBody = JSON.stringify(event);
    const signature = generateStripeTestSignature({ rawBody, secret: testSecret });

    // 1ra entrega
    const req1 = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res1 = await stripeWebhookHandler(req1);
    expect(res1.status).toBe(200);

    // 2da entrega (reintento duplicado)
    const req2 = new Request("http://localhost:3000/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawBody,
    });
    const res2 = await stripeWebhookHandler(req2);
    expect(res2.status).toBe(200);

    const count = await prisma.subscription.count({
      where: { stripeSubscriptionId: `sub_dedup_${tenantAId}` },
    });
    expect(count).toBe(1);

    const sub = await prisma.subscription.findFirst({
      where: { stripeSubscriptionId: `sub_dedup_${tenantAId}` },
    });
    expect(sub?.billingInterval).toBe("YEARLY");
    expect(sub?.planId).toBe("ACADEMY");
  });

  it("L. Créditos AI no deben multiplicarse por 12 en una contratación anual", async () => {
    // Contratar plan anual ACADEMY
    await BillingService.createCheckoutSession(tenantAId, "ACADEMY", "YEARLY");

    // Verificar que la wallet recibe la asignación mensual estándar (2,000 Teacher / 800 Student)
    // y NO 24,000 ni 9,600 créditos
    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(2000);
    expect(wallet.studentCredits.available).toBe(800);
  });

  it("M. Usuarios existentes con suscripción mensual deben seguir funcionando sin interrupción", async () => {
    // Simular un registro previo creado antes del campo con valor por defecto
    await prisma.subscription.create({
      data: {
        tenantId: tenantBId,
        planId: "STARTER",
        billingInterval: "MONTHLY",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const info = await BillingService.getTenantSubscriptionInfo(tenantBId);
    expect(info.plan?.id).toBe("STARTER");
    expect(info.billingInterval).toBe("MONTHLY");
    expect(info.plan?.price).toBe(29);
  });

  it("N. No debe existir ninguna posibilidad de cambiar el precio mediante manipulación del frontend", async () => {
    // Iniciar sesión como OWNER del tenant A (el tenant se toma de la sesión, no del argumento)
    const owner = await prisma.user.upsert({
      where: { email: "owner_interval_a@test.com" },
      update: {},
      create: { email: "owner_interval_a@test.com", name: "Owner Interval A" },
    });
    await prisma.membership.create({ data: { tenantId: tenantAId, userId: owner.id, role: "OWNER" } });
    await loginAs(tenantAId, owner.id, { ensurePlan: false });

    // Intentar pasar una solicitud manipulada a través del Server Action
    const result = await createCheckoutSessionAction(tenantBId, "STARTER", "YEARLY");
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected successful checkout session creation");
    // El precio lo determina el backend sin importar lo que mande el frontend
    expect(result.amountCents).toBe(27840);
    // Y la suscripción se crea en el tenant de la sesión (A), nunca en el enviado por el cliente (B)
    expect(await prisma.subscription.count({ where: { tenantId: tenantBId } })).toBe(0);
    expect(await prisma.subscription.count({ where: { tenantId: tenantAId } })).toBe(1);
  });
});

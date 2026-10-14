import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BillingService, SAAS_PLANS, addInterval, payphoneSubscriptionId } from "@/modules/billing/billing.service";
import { PayphonePaymentService } from "@/modules/billing/payphone-payment.service";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { splitIva, newClientTransactionId } from "@/lib/payphone";
import { prisma } from "@/lib/db";

describe("Planes mensual y anual con Payphone (precios con IVA incluido)", () => {
  const originalEnv = { ...process.env };
  const tenantAId = "tenant_billing_interval_a";
  const tenantBId = "tenant_billing_interval_b";

  beforeEach(async () => {
    process.env = { ...originalEnv };
    // Sin credenciales de Payphone: modo simulado de desarrollo
    delete process.env.PAYPHONE_TOKEN;
    delete process.env.PAYPHONE_STORE_ID;
    (process.env as any).NODE_ENV = "test";

    await prisma.payment.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    await prisma.tenant.create({ data: { id: tenantAId, name: "Interval Tenant A", slug: "interval-tenant-a" } });
    await prisma.tenant.create({ data: { id: tenantBId, name: "Interval Tenant B", slug: "interval-tenant-b" } });
    await AICreditEngine.getTenantWalletSummary(tenantAId);
    await AICreditEngine.getTenantWalletSummary(tenantBId);
  }, 30000);

  afterEach(async () => {
    process.env = { ...originalEnv };
    await prisma.payment.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  }, 30000);

  it("A. Importes oficiales en centavos (mensual y anual con 20% de descuento)", () => {
    expect(SAAS_PLANS.STARTER.pricing.MONTHLY.amountCents).toBe(2900);
    expect(SAAS_PLANS.STARTER.pricing.YEARLY.amountCents).toBe(27840);
    expect(SAAS_PLANS.PRO.pricing.MONTHLY.amountCents).toBe(7900);
    expect(SAAS_PLANS.PRO.pricing.YEARLY.amountCents).toBe(75840);
    expect(SAAS_PLANS.ACADEMY.pricing.MONTHLY.amountCents).toBe(19900);
    expect(SAAS_PLANS.ACADEMY.pricing.YEARLY.amountCents).toBe(191040);
  });

  it("B. IVA del 15% incluido: base + IVA suman exactamente el precio", () => {
    for (const plan of Object.values(SAAS_PLANS)) {
      for (const interval of ["MONTHLY", "YEARLY"] as const) {
        const total = plan.pricing[interval].amountCents;
        const { amountWithTax, tax } = splitIva(total);
        expect(amountWithTax + tax).toBe(total);
        expect(Math.abs(tax - amountWithTax * 0.15)).toBeLessThanOrEqual(1);
      }
    }
    expect(splitIva(2900)).toEqual({ amountWithTax: 2522, tax: 378 });
  });

  it("C. clientTransactionId: 15 caracteres y sin repetirse", () => {
    const ids = new Set(Array.from({ length: 500 }, () => newClientTransactionId("S")));
    expect(ids.size).toBe(500);
    for (const id of ids) expect(id).toMatch(/^S[0-9A-Z]{14}$/);
  });

  it("D. Un mes y un año se suman por calendario", () => {
    const from = new Date("2026-01-31T12:00:00Z");
    expect(addInterval(from, "YEARLY").toISOString()).toBe("2027-01-31T12:00:00.000Z");
    expect(addInterval(new Date("2026-10-08T00:00:00Z"), "MONTHLY").toISOString()).toBe("2026-11-08T00:00:00.000Z");
  });

  it("E. Primer pago: activa el plan desde hoy y sincroniza los créditos del plan", async () => {
    await BillingService.applySubscriptionPayment({ tenantId: tenantAId, planId: "PRO", billingInterval: "MONTHLY" });
    const active = await BillingService.getActiveSubscription(tenantAId);
    expect(active?.planId).toBe("PRO");
    expect(active?.externalId).toBe(payphoneSubscriptionId(tenantAId));
    const days = (active!.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(27);
    expect(days).toBeLessThan(32);
    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(wallet?.monthlyTeacherAllowance).toBe(800);
  });

  it("F. Renovar el mismo plan antes de vencer suma un periodo (no se pierden días)", async () => {
    await BillingService.applySubscriptionPayment({ tenantId: tenantAId, planId: "STARTER", billingInterval: "MONTHLY" });
    const first = await BillingService.getActiveSubscription(tenantAId);
    await BillingService.applySubscriptionPayment({ tenantId: tenantAId, planId: "STARTER", billingInterval: "MONTHLY" });
    const second = await BillingService.getActiveSubscription(tenantAId);
    expect(second!.currentPeriodEnd.toISOString()).toBe(addInterval(first!.currentPeriodEnd, "MONTHLY").toISOString());
  });

  it("G. Cambiar de plan o de modalidad empieza el periodo hoy", async () => {
    await BillingService.applySubscriptionPayment({ tenantId: tenantAId, planId: "STARTER", billingInterval: "MONTHLY" });
    await BillingService.applySubscriptionPayment({ tenantId: tenantAId, planId: "STARTER", billingInterval: "MONTHLY" });
    await BillingService.applySubscriptionPayment({ tenantId: tenantAId, planId: "ACADEMY", billingInterval: "YEARLY" });
    const active = await BillingService.getActiveSubscription(tenantAId);
    expect(active?.planId).toBe("ACADEMY");
    expect(active?.billingInterval).toBe("YEARLY");
    const days = (active!.currentPeriodEnd.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(360);
    expect(days).toBeLessThan(367);
  });

  it("H. Los créditos IA de un plan anual no se multiplican por 12", async () => {
    await BillingService.applySubscriptionPayment({ tenantId: tenantAId, planId: "PRO", billingInterval: "YEARLY" });
    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(wallet?.monthlyTeacherAllowance).toBe(800);
  });

  it("I. Sin Payphone (desarrollo) el pago se simula y nunca cuenta como cobro real", async () => {
    const res = await PayphonePaymentService.startSubscriptionPayment({
      tenantId: tenantBId,
      planId: "PRO",
      billingInterval: "MONTHLY",
      saveCard: false,
    });
    expect(res.redirectUrl).toContain("checkout=success");
    const active = await BillingService.getActiveSubscription(tenantBId);
    expect(active?.externalId).toBe(`sub_simulated_${tenantBId}`);
    expect(await prisma.payment.count({ where: { tenantId: tenantBId } })).toBe(0);
  });

  it("J. Un pago que vuelve de Payphone sin existir aquí no aplica nada", async () => {
    const outcome = await PayphonePaymentService.handleReturn({ id: 123, clientTransactionId: "SNOEXISTE000000" });
    expect(outcome.status).toBe("error");
    expect(await BillingService.getActiveSubscription(tenantAId)).toBeNull();
  });

  it("K. Un pago ya aprobado no se vuelve a aplicar (idempotencia)", async () => {
    await prisma.payment.create({
      data: {
        tenantId: tenantAId,
        kind: "SUBSCRIPTION",
        planId: "PRO",
        billingInterval: "MONTHLY",
        amountCents: 7900,
        clientTransactionId: "STESTIDEMPOTENT",
        status: "APPROVED",
      },
    });
    const outcome = await PayphonePaymentService.handleReturn({ id: 1, clientTransactionId: "STESTIDEMPOTENT" });
    expect(outcome.status).toBe("approved");
    // No llamó a Payphone ni activó un periodo nuevo
    expect(await BillingService.getActiveSubscription(tenantAId)).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Academy Executive anual (1,910.40): supera el máximo de USD 1,000 por cobro de
 * PayPhone y se cobra con la Cajita en dos pagos de 955.20 (día 1 y día 2), sin
 * renovación automática. Sin base de datos: Prisma y la API de PayPhone simulados.
 */

const h = vi.hoisted(() => ({
  prisma: {
    payment: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    subscription: { findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
  },
  preparePayment: vi.fn(),
  syncWallet: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/lib/app-url", () => ({ getAppUrl: () => "https://mentor.test" }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/modules/ai/ai.credit-engine", () => ({ AICreditEngine: { syncWalletWithPlan: h.syncWallet } }));
vi.mock("@/lib/payphone", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payphone")>()),
  isMockPaymentsMode: () => false,
  isTokenizationEnabled: () => false,
  preparePayment: h.preparePayment,
}));

import { PayphonePaymentService } from "@/modules/billing/payphone-payment.service";
import { BillingService } from "@/modules/billing/billing.service";
import { chargeInstallments, PAYPHONE_MAX_CHARGE_CENTS } from "@/modules/billing/plans";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

beforeEach(() => {
  vi.clearAllMocks();
  h.preparePayment.mockResolvedValue({ paymentId: "x", payWithCard: "https://pay.payphone/cajita", payWithPayPhone: "" });
  h.prisma.payment.create.mockImplementation(async ({ data }) => ({ id: "pay-1", ...data }));
  h.prisma.payment.findFirst.mockResolvedValue(null);
  h.prisma.subscription.findFirst.mockResolvedValue(null);
  h.prisma.subscription.findUnique.mockResolvedValue(null);
  h.prisma.subscription.upsert.mockImplementation(async ({ create }) => create);
});

const start = () =>
  PayphonePaymentService.startSubscriptionPayment({ tenantId: "t1", userId: "u1", planId: "ACADEMY", billingInterval: "YEARLY", saveCard: false });

describe("Academy Executive anual: dos pagos con la Cajita", () => {
  it("solo Academy anual supera el máximo por cobro y se divide en 2", () => {
    expect(PAYPHONE_MAX_CHARGE_CENTS).toBe(100000);
    expect(chargeInstallments("ACADEMY", "YEARLY")).toBe(2);
    for (const [plan, interval] of [["ACADEMY", "MONTHLY"], ["PRO", "YEARLY"], ["STARTER", "YEARLY"]] as const) {
      expect(chargeInstallments(plan, interval)).toBe(1);
    }
  });

  it("día 1: cobra la parte 1 por 955.20", async () => {
    const res = await start();
    expect(res.redirectUrl).toBe("https://pay.payphone/cajita");
    expect(h.prisma.payment.create.mock.calls[0][0].data).toMatchObject({ installment: 1, amountCents: 95520, planId: "ACADEMY" });
    expect(h.preparePayment.mock.calls[0][0]).toMatchObject({ amountCents: 95520 });
    expect(h.preparePayment.mock.calls[0][0].reference).toContain("parte 1 de 2");
  });

  it("antes de 24 h no deja pagar la parte 2", async () => {
    const paidAt = new Date(Date.now() - 2 * HOUR);
    h.prisma.payment.findFirst.mockResolvedValue({ id: "p1", planId: "ACADEMY", billingInterval: "YEARLY", installment: 1, amountCents: 95520, confirmedAt: paidAt, createdAt: paidAt });
    await expect(start()).rejects.toThrow(/segunda parte se habilita/);
    expect(h.prisma.payment.create).not.toHaveBeenCalled();
  });

  it("día 2: el mismo botón cobra la parte 2 por 955.20", async () => {
    const paidAt = new Date(Date.now() - 25 * HOUR);
    h.prisma.payment.findFirst.mockResolvedValue({ id: "p1", planId: "ACADEMY", billingInterval: "YEARLY", installment: 1, amountCents: 95520, confirmedAt: paidAt, createdAt: paidAt });
    await start();
    expect(h.prisma.payment.create.mock.calls[0][0].data).toMatchObject({ installment: 2, amountCents: 95520 });
    expect(h.preparePayment.mock.calls[0][0].reference).toContain("parte 2 de 2");
  });

  it("parte 1 de hace más de 10 días sin parte 2: se empieza de nuevo por la parte 1", async () => {
    const paidAt = new Date(Date.now() - 11 * DAY);
    h.prisma.payment.findFirst.mockResolvedValue({ id: "p1", planId: "ACADEMY", billingInterval: "YEARLY", installment: 1, amountCents: 95520, confirmedAt: paidAt, createdAt: paidAt });
    await start();
    expect(h.prisma.payment.create.mock.calls[0][0].data).toMatchObject({ installment: 1 });
  });

  it("Academy mensual sigue siendo un solo cobro (sin partes)", async () => {
    await PayphonePaymentService.startSubscriptionPayment({ tenantId: "t1", planId: "ACADEMY", billingInterval: "MONTHLY", saveCard: false });
    expect(h.prisma.payment.create.mock.calls[0][0].data).toMatchObject({ installment: null, amountCents: 19900 });
  });
});

describe("Periodo del plan al pagar cada parte", () => {
  it("parte 1: acceso provisional de 3 días", async () => {
    const paidAt = new Date();
    await BillingService.applyFirstInstallment({ tenantId: "t1", planId: "ACADEMY", billingInterval: "YEARLY", paidAt });
    const saved = h.prisma.subscription.upsert.mock.calls[0][0].create;
    expect(saved.status).toBe("active");
    expect(saved.currentPeriodEnd.getTime()).toBe(paidAt.getTime() + 3 * DAY);
  });

  it("parte 2 (primer año): un año desde el pago de la parte 1", async () => {
    const part1PaidAt = new Date(Date.now() - 25 * HOUR);
    h.prisma.subscription.findFirst.mockResolvedValue({
      id: "s1", planId: "ACADEMY", billingInterval: "YEARLY", status: "active", externalId: "pp_t1",
      currentPeriodEnd: new Date(part1PaidAt.getTime() + 3 * DAY), cancelAtPeriodEnd: false, autoRenew: true,
    });
    await BillingService.applySecondInstallment({ tenantId: "t1", planId: "ACADEMY", billingInterval: "YEARLY", part1PaidAt });
    const expected = new Date(part1PaidAt);
    expected.setUTCFullYear(expected.getUTCFullYear() + 1);
    expect(h.prisma.subscription.upsert.mock.calls[0][0].update.currentPeriodEnd.getTime()).toBe(expected.getTime());
  });

  it("parte 2 (renovación anticipada): suma un año al vencimiento vigente", async () => {
    const part1PaidAt = new Date(Date.now() - 25 * HOUR);
    const currentEnd = new Date(Date.now() + 20 * DAY);
    h.prisma.subscription.findFirst.mockResolvedValue({
      id: "s1", planId: "ACADEMY", billingInterval: "YEARLY", status: "active", externalId: "pp_t1",
      currentPeriodEnd: currentEnd, cancelAtPeriodEnd: false, autoRenew: true,
    });
    await BillingService.applySecondInstallment({ tenantId: "t1", planId: "ACADEMY", billingInterval: "YEARLY", part1PaidAt });
    const expected = new Date(currentEnd);
    expected.setUTCFullYear(expected.getUTCFullYear() + 1);
    expect(h.prisma.subscription.upsert.mock.calls[0][0].update.currentPeriodEnd.getTime()).toBe(expected.getTime());
  });

  it("parte 1 en una renovación anticipada no acorta el periodo ya pagado", async () => {
    const currentEnd = new Date(Date.now() + 20 * DAY);
    h.prisma.subscription.findFirst.mockResolvedValue({
      id: "s1", planId: "ACADEMY", billingInterval: "YEARLY", status: "active", externalId: "pp_t1",
      currentPeriodEnd: currentEnd, cancelAtPeriodEnd: false, autoRenew: true,
    });
    await BillingService.applyFirstInstallment({ tenantId: "t1", planId: "ACADEMY", billingInterval: "YEARLY", paidAt: new Date() });
    expect(h.prisma.subscription.upsert.mock.calls[0][0].update.currentPeriodEnd.getTime()).toBe(currentEnd.getTime());
  });
});

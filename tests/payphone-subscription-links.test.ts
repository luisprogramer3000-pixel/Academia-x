import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Links de Suscripción de PayPhone: endpoint POST /api/payphone/subscription-checkout
 * y aplicación de los cobros notificados. Sin base de datos: Prisma, la sesión,
 * BillingService y la API de PayPhone están simulados.
 */

const h = vi.hoisted(() => {
  class AuthError extends Error {
    constructor(public code: "UNAUTHORIZED" | "FORBIDDEN" | "EMAIL_UNVERIFIED", message?: string) {
      super(message || code);
      this.name = "AuthError";
    }
  }
  return {
    AuthError,
    session: { current: null as null | { tenantId: string; userId: string } },
    prisma: {
      payment: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
    },
    billing: {
      getActiveSubscription: vi.fn(),
      getCurrentSubscriptionPaymentMethod: vi.fn(),
      applySubscriptionPayment: vi.fn(),
    },
    getSale: vi.fn(),
  };
});

vi.mock("@/lib/session", () => ({
  AuthError: h.AuthError,
  OWNER_ONLY: ["OWNER"],
  requireTenantAccess: vi.fn(async () => {
    if (!h.session.current) throw new h.AuthError("UNAUTHORIZED", "Debes iniciar sesión para continuar.");
    return h.session.current;
  }),
}));
vi.mock("@/lib/db", () => ({ prisma: h.prisma }));
vi.mock("@/modules/billing/billing.service", () => ({
  BillingService: h.billing,
  addInterval: (from: Date, interval: string) => {
    const d = new Date(from);
    if (interval === "YEARLY") d.setUTCFullYear(d.getUTCFullYear() + 1);
    else d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  },
}));
vi.mock("@/lib/payphone", () => ({
  getSale: h.getSale,
  newClientTransactionId: (p: string) => `${p}TEST0000000000`,
  splitIva: (total: number) => ({ amountWithTax: Math.round(total / 1.15), tax: total - Math.round(total / 1.15) }),
}));

import { POST } from "@/app/api/payphone/subscription-checkout/route";
import { PayphoneSubscriptionLinkService, linkAmountCents } from "@/modules/billing/payphone-subscription-link.service";
import { SUBSCRIPTION_PLAN_CODES, toSubscriptionPlanCode } from "@/modules/billing/subscription-plan-codes";

const LINKS = {
  PAYPHONE_SUB_STARTER_MONTHLY: "https://ppls.me/starter-monthly",
  PAYPHONE_SUB_STARTER_ANNUAL: "https://ppls.me/starter-annual",
  PAYPHONE_SUB_PRO_MONTHLY: "https://ppls.me/pro-monthly",
  PAYPHONE_SUB_PRO_ANNUAL: "https://ppls.me/pro-annual",
  PAYPHONE_SUB_ACADEMY_MONTHLY: "https://ppls.me/academy-monthly",
};

const request = (body: unknown) =>
  new NextRequest("http://localhost/api/payphone/subscription-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(process.env, LINKS);
  h.session.current = { tenantId: "tenant-1", userId: "user-1" };
  h.billing.getActiveSubscription.mockResolvedValue(null);
  h.billing.getCurrentSubscriptionPaymentMethod.mockResolvedValue(null);
  h.prisma.payment.findFirst.mockResolvedValue(null);
  h.prisma.payment.create.mockResolvedValue({ id: "pay-1" });
});

afterEach(() => {
  for (const key of Object.keys(LINKS)) delete process.env[key];
});

describe("POST /api/payphone/subscription-checkout", () => {
  const cases: [string, string, string, "MONTHLY" | "YEARLY", number][] = [
    ["STARTER_MONTHLY", LINKS.PAYPHONE_SUB_STARTER_MONTHLY, "STARTER", "MONTHLY", 2900],
    ["STARTER_ANNUAL", LINKS.PAYPHONE_SUB_STARTER_ANNUAL, "STARTER", "YEARLY", 27840],
    ["PROFESSIONAL_VIP_MONTHLY", LINKS.PAYPHONE_SUB_PRO_MONTHLY, "PRO", "MONTHLY", 7900],
    ["PROFESSIONAL_VIP_ANNUAL", LINKS.PAYPHONE_SUB_PRO_ANNUAL, "PRO", "YEARLY", 75840],
    ["ACADEMY_EXECUTIVE_MONTHLY", LINKS.PAYPHONE_SUB_ACADEMY_MONTHLY, "ACADEMY", "MONTHLY", 19900],
  ];

  it.each(cases)("TEST %s devuelve su link y registra el intento PENDING", async (planCode, url, planId, interval, cents) => {
    const res = await POST(request({ planCode }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.checkoutUrl).toBe(url);
    expect(h.prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          userId: "user-1",
          kind: "SUBSCRIPTION",
          method: "LINK",
          planId,
          billingInterval: interval,
          amountCents: cents,
        }),
      })
    );
    // Redirigir no activa el plan
    expect(h.billing.applySubscriptionPayment).not.toHaveBeenCalled();
  });

  it("TEST 6: plan inexistente → 400", async () => {
    for (const planCode of ["GOLD_MONTHLY", "ACADEMY_EXECUTIVE_ANNUAL", "", null, 42]) {
      const res = await POST(request({ planCode }));
      expect(res.status).toBe(400);
    }
    expect(h.prisma.payment.create).not.toHaveBeenCalled();
  });

  it("TEST 7: variable de entorno faltante → 503 con mensaje amable y error en el servidor", async () => {
    delete process.env.PAYPHONE_SUB_PRO_ANNUAL;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await POST(request({ planCode: "PROFESSIONAL_VIP_ANNUAL" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Este método de pago no está disponible temporalmente.");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("PAYPHONE_SUB_PRO_ANNUAL"));
    expect(h.prisma.payment.create).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("TEST 7b: una URL no https se trata como configuración ausente", async () => {
    process.env.PAYPHONE_SUB_STARTER_MONTHLY = "javascript:alert(1)";
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await POST(request({ planCode: "STARTER_MONTHLY" }));
    expect(res.status).toBe(503);
  });

  it("TEST 8: usuario no autenticado → 401", async () => {
    h.session.current = null;
    const res = await POST(request({ planCode: "STARTER_MONTHLY" }));
    expect(res.status).toBe(401);
    expect(h.prisma.payment.create).not.toHaveBeenCalled();
  });

  it("ignora cualquier URL enviada por el cliente", async () => {
    const res = await POST(request({ planCode: "STARTER_MONTHLY", checkoutUrl: "https://evil.example" }));
    expect((await res.json()).checkoutUrl).toBe(LINKS.PAYPHONE_SUB_STARTER_MONTHLY);
  });

  it("mismo plan ya activo por link → 409 sin crear duplicado", async () => {
    h.billing.getActiveSubscription.mockResolvedValue({ planId: "STARTER", billingInterval: "MONTHLY" });
    h.billing.getCurrentSubscriptionPaymentMethod.mockResolvedValue("LINK");
    const res = await POST(request({ planCode: "STARTER_MONTHLY" }));
    expect(res.status).toBe(409);
    expect(h.prisma.payment.create).not.toHaveBeenCalled();
  });

  it("reutiliza un intento pendiente del mismo plan (doble clic)", async () => {
    h.prisma.payment.findFirst.mockResolvedValue({ id: "pay-existing" });
    const res = await POST(request({ planCode: "STARTER_MONTHLY" }));
    expect(res.status).toBe(200);
    expect(h.prisma.payment.create).not.toHaveBeenCalled();
  });

  it("cambio de plan con link activo: se permite y avisa", async () => {
    h.billing.getActiveSubscription.mockResolvedValue({ planId: "STARTER", billingInterval: "MONTHLY" });
    h.billing.getCurrentSubscriptionPaymentMethod.mockResolvedValue("LINK");
    const res = await POST(request({ planCode: "PROFESSIONAL_VIP_MONTHLY" }));
    expect(res.status).toBe(200);
    expect((await res.json()).replacesActiveLinkSubscription).toBe(true);
  });
});

describe("Mapeo de planes", () => {
  it("5 planes por link; Academy anual queda en la Cajita (dos pagos)", () => {
    expect(SUBSCRIPTION_PLAN_CODES).toHaveLength(5);
    expect(toSubscriptionPlanCode("ACADEMY", "YEARLY")).toBeNull();
    expect(toSubscriptionPlanCode("PRO", "YEARLY")).toBe("PROFESSIONAL_VIP_ANNUAL");
    expect(linkAmountCents("STARTER_MONTHLY")).toBe(2900);
    expect(linkAmountCents("ACADEMY_EXECUTIVE_MONTHLY")).toBe(19900);
  });
});

describe("Notificación de cobro de un Link de Suscripción", () => {
  const approvedSale = (amountCents: number, email = "Owner@Academia.com") => ({
    approved: true,
    statusCode: 3,
    transactionId: 9001,
    clientTransactionId: "PP-GENERATED",
    amountCents,
    authorizationCode: "A1",
    cardBrand: "Visa",
    lastDigits: "1234",
    email,
  });

  beforeEach(() => {
    h.prisma.payment.findUnique.mockResolvedValue(null);
    h.prisma.payment.updateMany.mockResolvedValue({ count: 1 });
  });

  it("primer cobro verificado activa el plan del intento pendiente", async () => {
    h.getSale.mockResolvedValue(approvedSale(2900));
    h.prisma.payment.findMany.mockResolvedValueOnce([
      { id: "pay-1", tenantId: "tenant-1", planId: "STARTER", billingInterval: "MONTHLY", userId: "user-1" },
    ]);
    const out = await PayphoneSubscriptionLinkService.handleNotification({ transactionId: 9001 });
    expect(out).toMatchObject({ status: "approved", tenantId: "tenant-1", renewal: false });
    expect(h.billing.applySubscriptionPayment).toHaveBeenCalledWith({ tenantId: "tenant-1", planId: "STARTER", billingInterval: "MONTHLY" });
  });

  it("no activa nada si PayPhone no confirma la venta como aprobada", async () => {
    h.getSale.mockResolvedValue({ ...approvedSale(2900), approved: false, statusCode: 2 });
    const out = await PayphoneSubscriptionLinkService.handleNotification({ transactionId: 9001 });
    expect(out.status).toBe("ignored");
    expect(h.billing.applySubscriptionPayment).not.toHaveBeenCalled();
  });

  it("no activa nada si el importe no es el de un plan con link", async () => {
    h.getSale.mockResolvedValue(approvedSale(191040));
    const out = await PayphoneSubscriptionLinkService.handleNotification({ transactionId: 9001 });
    expect(out.status).toBe("ignored");
    expect(h.prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it("coincidencia ambigua entre academias → no adivina", async () => {
    h.getSale.mockResolvedValue(approvedSale(2900));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    h.prisma.payment.findMany.mockResolvedValueOnce([
      { id: "p1", tenantId: "tenant-1" },
      { id: "p2", tenantId: "tenant-2" },
    ]);
    const out = await PayphoneSubscriptionLinkService.handleNotification({ transactionId: 9001 });
    expect(out.status).toBe("ignored");
    expect(h.billing.applySubscriptionPayment).not.toHaveBeenCalled();
  });

  it("notificación repetida es idempotente", async () => {
    h.prisma.payment.findUnique.mockResolvedValue({ id: "pay-1", tenantId: "tenant-1", status: "APPROVED" });
    const out = await PayphoneSubscriptionLinkService.handleNotification({ transactionId: 9001 });
    expect(out.status).toBe("approved");
    expect(h.getSale).not.toHaveBeenCalled();
    expect(h.billing.applySubscriptionPayment).not.toHaveBeenCalled();
  });

  it("renovación cobrada por PayPhone extiende el periodo", async () => {
    h.getSale.mockResolvedValue(approvedSale(7900));
    const previous = { id: "pay-old", tenantId: "tenant-1", userId: "user-1", planId: "PRO", billingInterval: "MONTHLY", method: "LINK" };
    h.prisma.payment.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([previous]);
    h.prisma.payment.findFirst.mockResolvedValue(previous);
    h.prisma.payment.create.mockResolvedValue({ ...previous, id: "pay-new", installment: null, amountCents: 7900 });
    const out = await PayphoneSubscriptionLinkService.handleNotification({ transactionId: 9002 });
    expect(out).toMatchObject({ status: "approved", renewal: true, paymentId: "pay-new" });
    expect(h.billing.applySubscriptionPayment).toHaveBeenCalledWith({ tenantId: "tenant-1", planId: "PRO", billingInterval: "MONTHLY" });
  });
});

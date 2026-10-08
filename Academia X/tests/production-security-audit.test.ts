import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nextConfig from "@/../next.config";
import { validateProductionEnv } from "@/lib/env";
import { verifySessionToken, createSessionToken } from "@/lib/auth";
import { checkRateLimit, resetRateLimitStore } from "@/lib/rate-limit";
import { getAIAdapter, MockAIAdapter } from "@/modules/ai/ai.adapter";
import { GET as cronHandler } from "@/app/api/cron/ai-credit-reset/route";
import { POST as payphoneNotificationHandler } from "@/app/api/payphone/NotificacionPago/route";
import { BillingService, SAAS_PLANS } from "@/modules/billing/billing.service";
import { AICreditEngine, AICreditError } from "@/modules/ai/ai.credit-engine";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";

describe("Production Security, Legal & Hostinger Readiness Suite — Step 6.8", () => {
  const originalEnv = { ...process.env };
  const testCronSecret = "cron_secret_step_6_8_hostinger_test_token_998877";

  const tenantAId = "tenant_sec_audit_a";
  const tenantBId = "tenant_sec_audit_b";
  const userAId = "user_sec_audit_a";
  const userBId = "user_sec_audit_b";

  beforeEach(async () => {
    process.env = { ...originalEnv };
    resetRateLimitStore();

    process.env.CRON_SECRET = testCronSecret;

    // Limpieza de BD
    await prisma.aICreditPurchase.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    // Sembrar tenants de prueba
    await prisma.tenant.create({ data: { id: tenantAId, name: "Sec Tenant A", slug: "sec-tenant-a" } });
    await prisma.tenant.create({ data: { id: tenantBId, name: "Sec Tenant B", slug: "sec-tenant-b" } });
    await prisma.user.create({ data: { id: userAId, email: "usera@sec.com", name: "User A" } });
    await prisma.user.create({ data: { id: userBId, email: "userb@sec.com", name: "User B" } });
    await prisma.membership.create({ data: { tenantId: tenantAId, userId: userAId, role: "OWNER" } });
    await prisma.membership.create({ data: { tenantId: tenantBId, userId: userBId, role: "STUDENT" } });

    await AICreditEngine.getTenantWalletSummary(tenantAId);
    await AICreditEngine.getTenantWalletSummary(tenantBId);
  }, 30000);

  afterEach(async () => {
    process.env = { ...originalEnv };
    resetRateLimitStore();

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

  // 1. Cabeceras de Seguridad Web en next.config.ts
  it("1. next.config.ts incluye todas las cabeceras de seguridad requeridas (CSP, X-Frame, HSTS, etc.)", async () => {
    if (typeof nextConfig.headers !== "function") {
      throw new Error("nextConfig.headers should be a function");
    }

    const headersConfig = await nextConfig.headers();
    const globalRule = headersConfig.find((h) => h.source === "/:path*");
    expect(globalRule).toBeDefined();

    const headerKeys = (globalRule?.headers || []).map((h) => h.key);
    expect(headerKeys).toContain("Content-Security-Policy");
    expect(headerKeys).toContain("X-Frame-Options");
    expect(headerKeys).toContain("X-Content-Type-Options");
    expect(headerKeys).toContain("Referrer-Policy");
    expect(headerKeys).toContain("Permissions-Policy");
    expect(headerKeys).toContain("Strict-Transport-Security");

    const hsts = globalRule?.headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts?.value).toContain("max-age=31536000");
  });

  // 2. Fail-Fast en Producción para Secretos Críticos
  it("2. validateProductionEnv aplica Fail-Fast si faltan secretos en producción", () => {
    (process.env as any).NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;

    expect(() => validateProductionEnv()).toThrow(/PRODUCTION CONFIGURATION ERROR/);
  });

  // 3. Inexistencia de secretos en variables NEXT_PUBLIC_*
  it("3. Ningún secreto del backend está expuesto a través de NEXT_PUBLIC_*", () => {
    const publicEnvVars = Object.entries(process.env).filter(([k]) => k.startsWith("NEXT_PUBLIC_"));

    for (const [key, value] of publicEnvVars) {
      expect(key).not.toMatch(/SECRET/i);
      expect(key).not.toMatch(/PRIVATE/i);
      expect(key).not.toMatch(/DATABASE/i);
      expect(key).not.toMatch(/OPENAI_API_KEY/i);
      if (typeof value === "string") {
        expect(value).not.toMatch(/^sk_live/);
        expect(value).not.toMatch(/^sk_test/);
        expect(value).not.toMatch(/^whsec_/);
      }
    }
  });

  // 4. Autenticación y Verificación de JWT
  it("4. JWT Session Tokens: Generación y verificación segura con expiración y roles", async () => {
    const token = await createSessionToken({
      userId: userAId,
      email: "usera@sec.com",
      globalRole: "USER",
      tenantId: tenantAId,
      academyRole: "OWNER",
    });

    const payload = await verifySessionToken(token);
    expect(payload).toBeDefined();
    expect(payload?.userId).toBe(userAId);
    expect(payload?.tenantId).toBe(tenantAId);
    expect(payload?.academyRole).toBe("OWNER");

    // Token inválido/corrupto devuelve null sin lanzar errores no capturados
    const invalidPayload = await verifySessionToken("invalid_jwt_string_123");
    expect(invalidPayload).toBeNull();
  });

  // 5. Rate Limiting en Endpoints Críticos
  it("5. checkRateLimit limita peticiones tras exceder el límite establecido", async () => {
    const key = "rate_limit_test_key_1";
    for (let i = 0; i < 5; i++) {
      const res = await checkRateLimit({ key, limit: 5, windowMs: 60000 });
      expect(res.success).toBe(true);
    }

    // 6ta petición debe ser bloqueada
    const blockedRes = await checkRateLimit({ key, limit: 5, windowMs: 60000 });
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.remaining).toBe(0);
  });

  // 6. Cron Job Security (/api/cron/ai-credit-reset)
  it("6. /api/cron/ai-credit-reset requiere autorización estricta mediante CRON_SECRET", async () => {
    (process.env as any).NODE_ENV = "production";
    process.env.CRON_SECRET = testCronSecret;

    // Petición no autorizada -> HTTP 401
    const unauthReq = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset", {
      method: "GET",
    });
    const unauthRes = await cronHandler(unauthReq);
    expect(unauthRes.status).toBe(401);

    // Petición con secreto incorrecto -> HTTP 401
    const badSecretReq = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset", {
      method: "GET",
      headers: { "x-cron-secret": "wrong_cron_token" },
    });
    const badSecretRes = await cronHandler(badSecretReq);
    expect(badSecretRes.status).toBe(401);

    // Petición con X-CRON-SECRET válido -> HTTP 200
    const validReq = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset", {
      method: "GET",
      headers: { "x-cron-secret": testCronSecret },
    });
    const validRes = await cronHandler(validReq);
    expect(validRes.status).toBe(200);
  });

  // 7. Notificación de Payphone: datos inválidos se rechazan y nada se aplica sin confirmar
  it("7. /api/payphone/NotificacionPago rechaza datos inválidos y no aplica pagos desconocidos", async () => {
    const bad = await payphoneNotificationHandler(
      new NextRequest("http://localhost:3000/api/payphone/NotificacionPago", { method: "POST", body: "no es json" })
    );
    expect(await bad.json()).toEqual({ Response: false, ErrorCode: "111" });

    const missing = await payphoneNotificationHandler(
      new NextRequest("http://localhost:3000/api/payphone/NotificacionPago", { method: "POST", body: JSON.stringify({ Amount: 100 }) })
    );
    expect(await missing.json()).toEqual({ Response: false, ErrorCode: "444" });

    // Un pago que no es nuestro se reconoce (para que Payphone no reintente) pero no activa nada
    const unknown = await payphoneNotificationHandler(
      new NextRequest("http://localhost:3000/api/payphone/NotificacionPago", {
        method: "POST",
        body: JSON.stringify({ TransactionId: 999, ClientTransactionId: "SDESCONOCIDO000", StatusCode: 3, Amount: 7900 }),
      })
    );
    expect(await unknown.json()).toEqual({ Response: true, ErrorCode: "000" });
    expect(await BillingService.getActiveSubscription(tenantAId).then((a) => a?.externalId ?? null)).not.toBe(`pp_${tenantAId}`);
  });

  // 8. Multi-Tenant AI Credit Isolation
  it("8. Aislamiento Multi-Tenant: Tenant A no puede consumir ni alterar créditos de Tenant B", async () => {
    const walletA = await AICreditEngine.getTenantWalletSummary(tenantAId);
    const walletB = await AICreditEngine.getTenantWalletSummary(tenantBId);

    expect(walletA.tenantId).toBe(tenantAId);
    expect(walletB.tenantId).toBe(tenantBId);

    // Intentar que un usuario de Tenant A consuma créditos de Tenant B
    await expect(
      AICreditEngine.consumeCredits({
        tenantId: tenantBId,
        userId: userAId, // Pertenece a Tenant A, no a B
        operation: "COURSE_GENERATION" as any,
      })
    ).rejects.toThrow(AICreditError.USER_NOT_IN_TENANT);
  });

  // 9. Preservación Económica y Precios Inalterados
  it("9. Precios SaaS oficiales y descuentos del 20% anuales permanecen intactos", () => {
    expect(SAAS_PLANS.STARTER.pricing.MONTHLY.price).toBe(29);
    expect(SAAS_PLANS.STARTER.pricing.YEARLY.price).toBe(278.4);
    expect(SAAS_PLANS.STARTER.pricing.YEARLY.annualSavings).toBe(69.6);

    expect(SAAS_PLANS.PRO.pricing.MONTHLY.price).toBe(79);
    expect(SAAS_PLANS.PRO.pricing.YEARLY.price).toBe(758.4);
    expect(SAAS_PLANS.PRO.pricing.YEARLY.annualSavings).toBe(189.6);

    expect(SAAS_PLANS.ACADEMY.pricing.MONTHLY.price).toBe(199);
    expect(SAAS_PLANS.ACADEMY.pricing.YEARLY.price).toBe(1910.4);
    expect(SAAS_PLANS.ACADEMY.pricing.YEARLY.annualSavings).toBe(477.6);
  });

  // 10. AI Adapter Fail-Fast y Provider Safety
  it("10. AI Adapter en modo OpenAI requiere OPENAI_API_KEY en producción (Fail-Fast)", () => {
    (process.env as any).NODE_ENV = "production";
    delete process.env.OPENAI_API_KEY;
    process.env.AI_PROVIDER = "openai";

    expect(() => getAIAdapter("openai")).toThrow(/OPENAI_API_KEY/);
  });
});

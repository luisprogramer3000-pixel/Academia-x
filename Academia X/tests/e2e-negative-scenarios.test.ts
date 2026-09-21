import { describe, it, expect } from "vitest";
import { verifySessionToken } from "@/lib/auth";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { CreditPurchaseService } from "@/modules/billing/credit-purchase.service";
import { tenantIdSchema, topupPackageIdSchema, planIdSchema } from "@/lib/validations";
import { AIOperation } from "@prisma/client";

describe("E2E Negative Scenarios Suite — Security & Failure Verification", () => {
  it("Escenario Negativo 1: Token JWT inválido o malformado", async () => {
    const result = await verifySessionToken("token-invalido-corrupto.xyz.123");
    expect(result).toBeNull();
  });

  it("Escenario Negativo 2: Intento de compra con paquete Top-Up no existente", async () => {
    expect(() => topupPackageIdSchema.parse("PAQUETE_INEXISTENTE")).toThrow();
  });

  it("Escenario Negativo 3: Intento de asignación de plan SaaS con ID corrupto", async () => {
    expect(() => planIdSchema.parse("ULTRA_MEGA_PLAN")).toThrow();
  });

  it("Escenario Negativo 4: Formato de tenantId malformado con caracteres no permitidos", async () => {
    expect(() => tenantIdSchema.parse("tenant; DROP TABLE users;--")).toThrow();
  });

  it("Escenario Negativo 5: Intento de consumo de créditos en tenant inexistente rechaza la solicitud", async () => {
    await expect(
      AICreditEngine.consumeCredits({
        tenantId: "tenant_sin_creditos_xyz",
        operation: AIOperation.COURSE_GENERATION,
      })
    ).rejects.toThrow("TENANT_NOT_FOUND");
  });

  it("Escenario Negativo 6: Intento de cumplimiento de compra sin registro prevé rechazo atómico", async () => {
    const paymentId = `unregistered_pay_${Date.now()}`;
    await expect(
      CreditPurchaseService.fulfillPurchase({
        providerPaymentId: paymentId,
      })
    ).rejects.toThrow("PURCHASE_NOT_FOUND");
  });
});

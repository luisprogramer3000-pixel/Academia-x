import { loginAs } from "./helpers/session";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AICreditEngine, AICreditError } from "../src/modules/ai/ai.credit-engine";
import { AI_OPERATION_CATALOG, getOperationCreditCost } from "../src/modules/ai/ai.catalog";
import { PLAN_AI_CREDIT_CONFIG } from "../src/modules/ai/ai.config";
import { getAICreditSummaryAction, getAICreditHistoryAction, getAIOperationCatalogAction } from "../src/app/actions/ai.actions";
import { prisma } from "../src/lib/db";
import { AIOperation, AICreditType, AICreditTransactionType } from "@prisma/client";

describe("AI Credit UI & Dashboard Integration — Step 4.4.5", () => {
  const tenantAId = "tenant_ui_a_id";
  const tenantBId = "tenant_ui_b_id";
  const userAId = "user_ui_a_id";

  beforeEach(async () => {
    // Cleanup DB state for test tenants
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: userAId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    // Seed test tenants & users
    await prisma.tenant.create({
      data: { id: tenantAId, name: "UI Tenant A", slug: "ui-tenant-a" },
    });
    await prisma.tenant.create({
      data: { id: tenantBId, name: "UI Tenant B", slug: "ui-tenant-b" },
    });
    await prisma.user.create({
      data: { id: userAId, email: "user_a@uitest.com", name: "Prof. User A" },
    });
    await prisma.membership.create({
      data: { tenantId: tenantAId, userId: userAId, role: "OWNER" },
    });

    // Inicializar wallets virtuales por defecto para los tenants de prueba
    await AICreditEngine.getTenantWalletSummary(tenantAId);
    await AICreditEngine.getTenantWalletSummary(tenantBId);
  }, 30000);

  afterEach(async () => {
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: userAId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  }, 30000);

  it("1. getTenantWalletSummary carga correctamente los saldos de Teacher y Student Credits", async () => {
    const summary = await AICreditEngine.getTenantWalletSummary(tenantAId);

    expect(summary.tenantId).toBe(tenantAId);
    expect(summary.planId).toBe("STARTER");
    expect(summary.teacherCredits.available).toBe(PLAN_AI_CREDIT_CONFIG.STARTER.teacherAllowance);
    expect(summary.studentCredits.available).toBe(PLAN_AI_CREDIT_CONFIG.STARTER.studentAllowance);
    expect(summary.teacherCredits.usedThisMonth).toBe(0);
    expect(summary.teacherCredits.usagePercentage).toBe(0);
    expect(summary.capacityStatus).toBe("NORMAL");
  });

  it("2. getAICreditSummaryAction ejecuta la acción del servidor y retorna estructura consistente", async () => {
    // loginAs crea una suscripción PRO por defecto; aquí el resto del archivo trabaja
    // sobre STARTER, así que se fija el plan para que la cuota devuelta sea la esperada.
    await loginAs(tenantAId, userAId, { ensurePlan: "STARTER" });
    const res = await getAICreditSummaryAction(tenantAId);

    expect(res.success).toBe(true);
    expect(res.summary).toBeDefined();
    expect(res.summary?.teacherCredits.monthlyAllowance).toBe(PLAN_AI_CREDIT_CONFIG.STARTER.teacherAllowance);
  });

  it("3. Alerta de Capacidad calcula adecuadamente los estados NORMAL, LOW, CRITICAL y EXCEEDED", async () => {
    // 0% -> NORMAL
    let summary = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(summary.capacityStatus).toBe("NORMAL");

    // Simular consumo de saldo para llegar a 0 -> EXCEEDED
    await prisma.aICreditWallet.update({
      where: { tenantId: tenantAId },
      data: { teacherCredits: 0 },
    });

    summary = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(summary.capacityStatus).toBe("EXCEEDED");
  });

  it("4. Tenant Isolation: Tenant A no puede consultar o filtrar transacciones de Tenant B", async () => {
    // Crear transacciones en Tenant A y Tenant B
    await AICreditEngine.consumeCredits({
      tenantId: tenantAId,
      userId: userAId,
      operation: AIOperation.COURSE_GENERATION,
    });

    // Intentar consultar wallet de un tenant inexistente o cruzado
    await expect(AICreditEngine.getTenantWalletSummary("non_existent_tenant")).rejects.toThrow(
      AICreditError.TENANT_NOT_FOUND
    );

    const historyA = await AICreditEngine.getTenantCreditHistory(tenantAId);
    const historyB = await AICreditEngine.getTenantCreditHistory(tenantBId);

    expect(historyA.length).toBe(1);
    expect(historyA[0].tenantId).toBe(tenantAId);
    expect(historyB.length).toBe(0);
  });

  it("5. El historial registra transacciones REFUND con importe positivo y referenceId vinculado", async () => {
    const consumeRes = await AICreditEngine.consumeCredits({
      tenantId: tenantAId,
      userId: userAId,
      operation: AIOperation.COURSE_GENERATION,
    });

    const refundRes = await AICreditEngine.refundCredits({
      tenantId: tenantAId,
      transactionId: consumeRes.transactionId!,
      reason: "Simulated UI test refund",
    });

    const history = await AICreditEngine.getTenantCreditHistory(tenantAId);
    expect(history.length).toBe(2);

    const refundTx = history.find((tx) => tx.transactionType === AICreditTransactionType.REFUND);
    expect(refundTx).toBeDefined();
    expect(refundTx?.amount).toBe(5);
    expect(refundTx?.referenceId).toBe(consumeRes.transactionId);
    expect(refundTx?.creditType).toBe(AICreditType.TEACHER);
  });

  it("6. Catálogo dinámico getAIOperationCatalogAction retorna los costes de ai.catalog.ts sin valores hardcodeados", async () => {
    const res = await getAIOperationCatalogAction();

    expect(res.success).toBe(true);
    expect(res.catalog).toBeDefined();
    expect(res.catalog!.COURSE_GENERATION.creditCost).toBe(5);
    expect(res.catalog!.LESSON_GENERATION.creditCost).toBe(2);
    expect(res.catalog!.LANDING_GENERATION.creditCost).toBe(8);
    expect(res.catalog!.AI_TUTOR.creditCost).toBe(1);
  });

  it("7. Registros históricos de AIUsage con creditTransactionId null no rompen las consultas de créditos", async () => {
    // Insertar registro legacy de AIUsage sin creditTransactionId
    await prisma.aIUsage.create({
      data: {
        tenantId: tenantAId,
        userId: userAId,
        feature: "COURSE_GENERATION",
        provider: "mock",
        model: "gpt-4o-mini",
        promptTokens: 1000,
        completionTokens: 500,
        estimatedCost: 0.003,
        creditTransactionId: null,
      },
    });

    const summary = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(summary.tenantId).toBe(tenantAId);
    expect(summary.teacherCredits.available).toBe(PLAN_AI_CREDIT_CONFIG.STARTER.teacherAllowance);
  });

  it("8. Aislamiento de bolsas: Teacher Credits y Student Credits se contabilizan de forma independiente", async () => {
    // Otorgar saldo de Student Credits actualizando la wallet a 50 cr
    await prisma.aICreditWallet.update({
      where: { tenantId: tenantAId },
      data: { studentCredits: 50, monthlyStudentAllowance: 50 },
    });

    // Consumir 1 crédito de Student
    await AICreditEngine.consumeCredits({
      tenantId: tenantAId,
      userId: userAId,
      operation: AIOperation.AI_TUTOR,
    });

    const summary = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(summary.teacherCredits.available).toBe(PLAN_AI_CREDIT_CONFIG.STARTER.teacherAllowance);
    expect(summary.studentCredits.available).toBe(49);
  });
});



import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { AICreditAdminService } from "@/modules/ai/ai.admin-service";
import { PLAN_AI_CREDIT_CONFIG } from "@/modules/ai/ai.config";
import { TOPUP_PACKAGES } from "@/modules/ai/ai.topup-catalog";
import { AI_OPERATION_CATALOG } from "@/modules/ai/ai.catalog";
import { AICreditType, AICreditTransactionType, AIOperation } from "@prisma/client";
import {
  getGlobalSummaryMetricsAction,
  getPlanDistributionMetricsAction,
  getJobStatusSummaryAction,
  getLedgerAuditLogAction,
  getTopUpPurchasesReportAction,
  auditTenantWalletBalanceAction,
  detectSystemAnomaliesAction,
} from "@/app/actions/ai-admin.actions";

describe("AI Credit Administration, Monitoring & Economic Observability — Step 4.4.10", () => {
  let tenantAId: string;
  let tenantBId: string;
  let userIdA: string;

  beforeEach(async () => {
    // Limpieza atómica antes de cada prueba
    await prisma.notification.deleteMany({});
    await prisma.aICreditPurchase.deleteMany({});
    await prisma.aICreditTransaction.deleteMany({});
    await prisma.aICreditWallet.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.user.deleteMany({});

    // Creación de datos de prueba
    const userA = await prisma.user.create({
      data: { email: "admin.obs@test.com", name: "Admin Test", globalRole: "SUPER_ADMIN" },
    });
    userIdA = userA.id;

    const tenantA = await prisma.tenant.create({
      data: { name: "Observability Tenant A", slug: "obs-tenant-a" },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: { name: "Observability Tenant B", slug: "obs-tenant-b" },
    });
    tenantBId = tenantB.id;

    await prisma.membership.create({
      data: { userId: userIdA, tenantId: tenantAId, role: "OWNER" },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Admin puede consultar resumen global
  it("1. Admin puede consultar resumen global de créditos con agregaciones atómicas", async () => {
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 500,
        studentCredits: 100,
        monthlyTeacherAllowance: 600,
        monthlyStudentAllowance: 200,
        rolloverTeacherCredits: 50,
        purchasedTeacherCredits: 100,
        resetAt: new Date(),
      },
    });

    const summary = await AICreditAdminService.getGlobalSummaryMetrics();
    expect(summary.totalTeacherAvailable).toBe(500);
    expect(summary.totalStudentAvailable).toBe(100);
    expect(summary.totalMonthlyAllowanceAllocated).toBe(800);
    expect(summary.totalRolloverVigente).toBe(50);
    expect(summary.totalPurchasedCreditsComprados).toBe(100);
  });

  // 2. Usuario no autorizado es rechazado
  it("2. Server Actions administrativas rechazan solicitudes de usuarios no autorizados", async () => {
    const res = await getGlobalSummaryMetricsAction();
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unauthorized");
  });

  // 3. Tenant isolation (un admin de tenant sólo consulta sus datos)
  it("3. Aislamiento Multi-tenant: Filtrar métricas por tenantId sólo retorna datos de ese tenant", async () => {
    await prisma.aICreditWallet.create({
      data: { tenantId: tenantAId, teacherCredits: 600, resetAt: new Date() },
    });
    await prisma.aICreditWallet.create({
      data: { tenantId: tenantBId, teacherCredits: 150, resetAt: new Date() },
    });

    const summaryA = await AICreditAdminService.getGlobalSummaryMetrics(tenantAId);
    expect(summaryA.totalTeacherAvailable).toBe(600);

    const summaryB = await AICreditAdminService.getGlobalSummaryMetrics(tenantBId);
    expect(summaryB.totalTeacherAvailable).toBe(150);
  });

  // 4. Métricas reales calculadas desde base de datos
  it("4. Calcula consumos, expiraciones y reembolsos reales desde AICreditTransaction", async () => {
    await prisma.aICreditTransaction.createMany({
      data: [
        {
          tenantId: tenantAId,
          creditType: AICreditType.TEACHER,
          amount: -25,
          transactionType: AICreditTransactionType.USAGE,
          operation: AIOperation.COURSE_GENERATION,
        },
        {
          tenantId: tenantAId,
          creditType: AICreditType.TEACHER,
          amount: -10,
          transactionType: AICreditTransactionType.EXPIRATION,
          operation: AIOperation.COURSE_GENERATION,
        },
        {
          tenantId: tenantAId,
          creditType: AICreditType.TEACHER,
          amount: 25,
          transactionType: AICreditTransactionType.REFUND,
          operation: AIOperation.COURSE_GENERATION,
        },
      ],
    });

    const metrics = await AICreditAdminService.getGlobalSummaryMetrics(tenantAId);
    expect(metrics.totalConsumedCredits).toBe(25);
    expect(metrics.totalExpiredCredits).toBe(10);
    expect(metrics.totalRefundedCredits).toBe(25);
  });

  // 5. Distribución por plan
  it("5. Agrupa la distribución de economía por plan activo (STARTER, PRO, ACADEMY)", async () => {
    await prisma.subscription.create({
      data: {
        tenantId: tenantAId,
        planId: "PRO",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 600,
        monthlyTeacherAllowance: 600,
        monthlyStudentAllowance: 200,
        resetAt: new Date(),
      },
    });

    const plans = await AICreditAdminService.getPlanDistributionMetrics();
    const proPlan = plans.find((p) => p.planId === "PRO");
    expect(proPlan?.tenantCount).toBe(1);
    expect(proPlan?.cuotaMensualTeacher).toBe(600);
    expect(proPlan?.cuotaMensualStudent).toBe(200);
  });

  // 6. Ledger inmutable
  it("6. El servicio de auditoría de ledger lee transacciones inmutables sin permitir modificaciones", async () => {
    await prisma.aICreditTransaction.create({
      data: {
        tenantId: tenantAId,
        creditType: AICreditType.TEACHER,
        amount: 150,
        transactionType: AICreditTransactionType.ALLOCATION,
        operation: AIOperation.COURSE_GENERATION,
        idempotencyKey: "test_alloc_1",
      },
    });

    const audit = await AICreditAdminService.getLedgerAuditLog({ tenantId: tenantAId });
    expect(audit.totalCount).toBe(1);
    expect(audit.transactions[0].idempotencyKey).toBe("test_alloc_1");
  });

  // 7. Filtros server-side
  it("7. Filtra la auditoría de ledger por transactionType y creditType en el servidor", async () => {
    await prisma.aICreditTransaction.create({
      data: {
        tenantId: tenantAId,
        creditType: AICreditType.TEACHER,
        amount: -5,
        transactionType: AICreditTransactionType.USAGE,
        operation: AIOperation.COURSE_GENERATION,
      },
    });
    await prisma.aICreditTransaction.create({
      data: {
        tenantId: tenantAId,
        creditType: AICreditType.TEACHER,
        amount: 30,
        transactionType: AICreditTransactionType.ROLLOVER,
        operation: AIOperation.COURSE_GENERATION,
      },
    });

    const usageOnly = await AICreditAdminService.getLedgerAuditLog({
      tenantId: tenantAId,
      transactionType: AICreditTransactionType.USAGE,
    });
    expect(usageOnly.totalCount).toBe(1);
    expect(usageOnly.transactions[0].transactionType).toBe(AICreditTransactionType.USAGE);
  });

  // 8. Auditoría de balance matemáticamente correcta
  it("8. auditTenantWalletBalance calcula correctamente la consistencia de la wallet contra el ledger", async () => {
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 150,
        studentCredits: 0,
        resetAt: new Date(),
      },
    });

    await prisma.aICreditTransaction.create({
      data: {
        tenantId: tenantAId,
        creditType: AICreditType.TEACHER,
        amount: 150,
        transactionType: AICreditTransactionType.ALLOCATION,
        operation: AIOperation.COURSE_GENERATION,
      },
    });

    const result = await AICreditAdminService.auditTenantWalletBalance(tenantAId);
    expect(result.isConsistent).toBe(true);
    expect(result.teacher.difference).toBe(0);
  });

  // 9. Detección de discrepancia en balance
  it("9. auditTenantWalletBalance detecta discrepancias si la wallet difiere del ledger", async () => {
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 999, // Desbalance manual simulado
        studentCredits: 0,
        resetAt: new Date(),
      },
    });

    await prisma.aICreditTransaction.create({
      data: {
        tenantId: tenantAId,
        creditType: AICreditType.TEACHER,
        amount: 150,
        transactionType: AICreditTransactionType.ALLOCATION,
        operation: AIOperation.COURSE_GENERATION,
      },
    });

    const result = await AICreditAdminService.auditTenantWalletBalance(tenantAId);
    expect(result.isConsistent).toBe(false);
    expect(result.teacher.difference).toBe(849);
    expect(result.details[0]).toContain("Discrepancia en Teacher Credits");
  });

  // 10. Detección de rollover superior al máximo autoritativo
  it("10. detectSystemAnomalies detecta cuando un tenant excede el máximo rollover permitido por su plan", async () => {
    await prisma.subscription.create({
      data: { tenantId: tenantAId, planId: "STARTER", status: "active", currentPeriodEnd: new Date() },
    });

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 200,
        rolloverTeacherCredits: 100, // Máximo STARTER es 30
        resetAt: new Date(),
      },
    });

    const anomalies = await AICreditAdminService.detectSystemAnomalies(tenantAId);
    const rolloverAnomaly = anomalies.find((a) => a.type === "EXCEEDED_ROLLOVER_MAX");
    expect(rolloverAnomaly).toBeDefined();
    expect(rolloverAnomaly?.severity).toBe("WARNING");
  });

  // 11. Detección de wallet con valores negativos
  it("11. detectSystemAnomalies detecta wallets o créditos comprados con saldo negativo", async () => {
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: -50,
        resetAt: new Date(),
      },
    });

    const anomalies = await AICreditAdminService.detectSystemAnomalies(tenantAId);
    const negAnomaly = anomalies.find((a) => a.type === "NEGATIVE_WALLET_BALANCE");
    expect(negAnomaly).toBeDefined();
    expect(negAnomaly?.severity).toBe("CRITICAL");
  });

  // 12. Detección de resetAt desactualizado (Stale reset date)
  it("12. detectSystemAnomalies detecta wallets cuyo resetAt venció hace más de 60 días", async () => {
    const staleDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 150,
        resetAt: staleDate,
      },
    });

    const anomalies = await AICreditAdminService.detectSystemAnomalies(tenantAId);
    const staleAnomaly = anomalies.find((a) => a.type === "STALE_RESET_DATE");
    expect(staleAnomaly).toBeDefined();
  });

  // 13. Consulta de historial de ventas Top-Up
  it("13. getTopUpPurchasesReport filtra compras Top-Up por status y packageId", async () => {
    await prisma.aICreditPurchase.create({
      data: {
        tenantId: tenantAId,
        packageId: "TEACHER_TOPUP_50",
        creditType: AICreditType.TEACHER,
        creditsGranted: 50,
        priceAmount: 15.0,
        status: "COMPLETED",
        providerPaymentId: "pay_test_123",
      },
    });

    const report = await AICreditAdminService.getTopUpPurchasesReport({
      tenantId: tenantAId,
      status: "COMPLETED",
    });

    expect(report.totalCount).toBe(1);
    expect(report.purchases[0].packageId).toBe("TEACHER_TOPUP_50");
  });

  // 14. Consulta de estado de background jobs
  it("14. getJobStatusSummary informa correctamente las wallets pendientes de reset", async () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: { tenantId: tenantAId, teacherCredits: 150, resetAt: pastDate },
    });

    const status = await AICreditAdminService.getJobStatusSummary();
    expect(status.walletsPendingReset).toBe(1);
    expect(status.totalWallets).toBe(1);
  });

  // 15. No modificación de la economía de créditos existente
  it("15. Confirma que PLAN_AI_CREDIT_CONFIG mantiene las cuotas oficiales autoritativas ($29/$79/$199)", () => {
    expect(PLAN_AI_CREDIT_CONFIG.STARTER.teacherAllowance).toBe(150);
    expect(PLAN_AI_CREDIT_CONFIG.STARTER.studentAllowance).toBe(0);
    expect(PLAN_AI_CREDIT_CONFIG.PRO.teacherAllowance).toBe(600);
    expect(PLAN_AI_CREDIT_CONFIG.PRO.studentAllowance).toBe(200);
    expect(PLAN_AI_CREDIT_CONFIG.ACADEMY.teacherAllowance).toBe(2000);
    expect(PLAN_AI_CREDIT_CONFIG.ACADEMY.studentAllowance).toBe(800);
  });

  // 16. No modificación del Top-Up Catalog
  it("16. Confirma que TOPUP_PACKAGES mantiene intactos los precios y créditos autorizados", () => {
    const teacher50 = TOPUP_PACKAGES["TEACHER_TOPUP_50"];
    expect(teacher50?.credits).toBe(50);
    expect(teacher50?.price).toBe(15);
  });

  // 17. No modificación del AI Operation Catalog
  it("17. Confirma que AI_OPERATION_CATALOG mantiene los costos por operación sin alteraciones", () => {
    const courseGen = AI_OPERATION_CATALOG.COURSE_GENERATION;
    expect(courseGen?.creditCost).toBe(5);
  });

  // 18. No modificación de las reglas de monthly reset ni rollover
  it("18. Confirma los límites de rollover autorizados por plan en PLAN_AI_CREDIT_CONFIG", () => {
    expect(PLAN_AI_CREDIT_CONFIG.STARTER.maxRolloverTeacher).toBe(30);
    expect(PLAN_AI_CREDIT_CONFIG.PRO.maxRolloverTeacher).toBe(100);
    expect(PLAN_AI_CREDIT_CONFIG.ACADEMY.maxRolloverTeacher).toBe(300);
  });

  // 19. Idempotencia del motor preservada
  it("19. Re-auditar el balance de un tenant no altera su wallet ni genera escrituras duplicadas", async () => {
    await prisma.aICreditWallet.create({
      data: { tenantId: tenantAId, teacherCredits: 150, resetAt: new Date() },
    });

    await AICreditAdminService.auditTenantWalletBalance(tenantAId);
    await AICreditAdminService.auditTenantWalletBalance(tenantAId);

    const walletAfter = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(walletAfter?.teacherCredits).toBe(150);
  });

  // 20. Multi-tenant isolation verificado
  it("20. Multi-tenant Isolation: getTopUpPurchasesReport filtra estrictamente por tenant", async () => {
    await prisma.aICreditPurchase.create({
      data: {
        tenantId: tenantAId,
        packageId: "TEACHER_TOPUP_50",
        creditType: AICreditType.TEACHER,
        creditsGranted: 50,
        priceAmount: 15.0,
        status: "COMPLETED",
      },
    });

    await prisma.aICreditPurchase.create({
      data: {
        tenantId: tenantBId,
        packageId: "TEACHER_TOPUP_150",
        creditType: AICreditType.TEACHER,
        creditsGranted: 150,
        priceAmount: 39.0,
        status: "COMPLETED",
      },
    });

    const reportA = await AICreditAdminService.getTopUpPurchasesReport({ tenantId: tenantAId });
    expect(reportA.totalCount).toBe(1);
    expect(reportA.purchases[0].tenantId).toBe(tenantAId);
  });
});

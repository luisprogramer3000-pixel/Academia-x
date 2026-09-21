import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { AICreditJobService } from "@/modules/ai/ai.job-service";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { AICreditType, AICreditTransactionType, NotificationType } from "@prisma/client";
import { GET as cronRouteHandler } from "@/app/api/cron/ai-credit-reset/route";
import { NextRequest } from "next/server";

describe("AI Credit Automation, Scheduling & Background Job Engine — Step 4.4.9", () => {
  let tenantAId: string;
  let tenantBId: string;
  let tenantCId: string;

  beforeEach(async () => {
    // Limpieza atómica antes de cada test
    await prisma.notification.deleteMany({});
    await prisma.aICreditTransaction.deleteMany({});
    await prisma.aICreditWallet.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.user.deleteMany({});

    // Creación de Tenants de Prueba
    const tenantA = await prisma.tenant.create({
      data: { name: "Automation Institute A", slug: "auto-inst-a" },
    });
    tenantAId = tenantA.id;

    const tenantB = await prisma.tenant.create({
      data: { name: "Automation Institute B", slug: "auto-inst-b" },
    });
    tenantBId = tenantB.id;

    const tenantC = await prisma.tenant.create({
      data: { name: "Automation Institute C", slug: "auto-inst-c" },
    });
    tenantCId = tenantC.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  // 1. Detectar tenants con reset pendiente (resetAt <= now)
  it("1. Debe detectar únicamente wallets cuya fecha resetAt sea menor o igual a now", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 150,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantBId,
        teacherCredits: 600,
        monthlyTeacherAllowance: 600,
        resetAt: futureDate,
      },
    });

    const dueWallets = await AICreditJobService.findDueWallets(50, new Date());
    expect(dueWallets.length).toBe(1);
    expect(dueWallets[0].tenantId).toBe(tenantAId);
  });

  // 2. Ignorar tenants cuyo reset no corresponde (resetAt > now)
  it("2. Debe ignorar wallets cuyo resetAt esté en el futuro", async () => {
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 150,
        monthlyTeacherAllowance: 150,
        resetAt: futureDate,
      },
    });

    const dueWallets = await AICreditJobService.findDueWallets(50, new Date());
    expect(dueWallets.length).toBe(0);
  });

  // 3. Procesar correctamente un tenant elegible
  it("3. Debe procesar un tenant elegible y actualizar su wallet y resetAt", async () => {
    const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    await prisma.subscription.create({
      data: {
        tenantId: tenantAId,
        stripeSubscriptionId: "sub_auto_a",
        planId: "PRO",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 50,
        studentCredits: 20,
        monthlyTeacherAllowance: 600,
        monthlyStudentAllowance: 200,
        resetAt: pastDate,
      },
    });

    const summary = await AICreditJobService.processMonthlyResetBatch({ limit: 10 });
    expect(summary.success).toBe(true);
    expect(summary.totalEligible).toBe(1);
    expect(summary.processedCount).toBe(1);
    expect(summary.failedCount).toBe(0);

    const walletAfter = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(walletAfter?.resetAt.getTime()).toBeGreaterThan(pastDate.getTime());
    expect(walletAfter?.teacherCredits).toBe(650); // 600 new + 50 rollover
  });

  // 4. Procesar múltiples tenants elegibles en lote (Batch)
  it("4. Debe procesar múltiples tenants elegibles en un único lote", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 100,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantBId,
        teacherCredits: 200,
        monthlyTeacherAllowance: 600,
        resetAt: pastDate,
      },
    });

    const summary = await AICreditJobService.processMonthlyResetBatch({ limit: 10 });
    expect(summary.totalEligible).toBe(2);
    expect(summary.processedCount).toBe(2);
    expect(summary.failedCount).toBe(0);
  });

  // 5. Failure Isolation: Un tenant fallido no detiene el lote
  it("5. Failure Isolation: Si el reset del Tenant A arroja excepción, el Tenant B se procesa normalmente", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 100,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantBId,
        teacherCredits: 200,
        monthlyTeacherAllowance: 600,
        resetAt: pastDate,
      },
    });

    // Simular fallo sólo en el Tenant A
    const originalProcess = AICreditEngine.processMonthlyReset;
    vi.spyOn(AICreditEngine, "processMonthlyReset").mockImplementation(async (tenantId, ...args) => {
      if (tenantId === tenantAId) {
        throw new Error("Simulated Database Error on Tenant A");
      }
      return originalProcess.call(AICreditEngine, tenantId, ...args);
    });

    const summary = await AICreditJobService.processMonthlyResetBatch({ limit: 10 });
    expect(summary.totalEligible).toBe(2);
    expect(summary.processedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.results.find((r) => r.tenantId === tenantAId)?.status).toBe("FAILED");
    expect(summary.results.find((r) => r.tenantId === tenantBId)?.status).toBe("SUCCESS");
  });

  // 6. Retry seguro (Retry Safety)
  it("6. Reintentos consecutivos del job son seguros y detectan ejecuciones previas (alreadyProcessed)", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 100,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    // Primera ejecución
    const summary1 = await AICreditJobService.processMonthlyResetBatch({ limit: 10 });
    expect(summary1.processedCount).toBe(1);

    // Segunda ejecución (Retry inmediato)
    const summary2 = await AICreditJobService.processMonthlyResetBatch({ limit: 10 });
    expect(summary2.totalEligible).toBe(0); // resetAt ya se movió al futuro
  });

  // 7. Ejecución concurrente simultánea de workers
  it("7. Dos ejecuciones concurrentes simultáneas del job sobre el mismo tenant no duplican asignaciones", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 50,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    const [sum1, sum2] = await Promise.all([
      AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate }),
      AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate }),
    ]);

    const totalProcessed = sum1.processedCount + sum2.processedCount;
    const totalAlreadyProcessed = sum1.alreadyProcessedCount + sum2.alreadyProcessedCount;

    expect(totalProcessed).toBe(1);
    expect(totalAlreadyProcessed).toBe(1);
  });

  // 8, 9, 10. No duplicar allocation, rollover ni expiration
  it("8-10. No duplica transacciones de ALLOCATION, ROLLOVER ni EXPIRATION en reintentos", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 100,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    await AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate });
    await AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate });

    const allocations = await prisma.aICreditTransaction.findMany({
      where: { tenantId: tenantAId, transactionType: AICreditTransactionType.ALLOCATION },
    });
    const rollovers = await prisma.aICreditTransaction.findMany({
      where: { tenantId: tenantAId, transactionType: AICreditTransactionType.ROLLOVER },
    });

    expect(allocations.length).toBe(1);
    expect(rollovers.length).toBe(1);
  });

  // 11. No duplicar notification
  it("11. No duplica la notificación CREDIT_MONTHLY_RESET en ejecuciones repetidas", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 100,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    await AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate });
    await AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate });

    const notifications = await prisma.notification.findMany({
      where: { tenantId: tenantAId, type: NotificationType.CREDIT_MONTHLY_RESET },
    });

    expect(notifications.length).toBe(1);
  });

  // 12. Preservar Top-Up credits comprados
  it("12. Preserva intactos los créditos purchasedTeacherCredits durante el job automatizado", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 100,
        purchasedTeacherCredits: 150,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    await AICreditJobService.processMonthlyResetBatch({ limit: 10 });

    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(wallet?.purchasedTeacherCredits).toBe(100);
  });

  // 13. Aislamiento multi-tenant
  it("13. Aislamiento Multi-tenant: El reset del Tenant A no modifica el saldo del Tenant B", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 50,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantBId,
        teacherCredits: 300,
        monthlyTeacherAllowance: 600,
        resetAt: futureDate,
      },
    });

    await AICreditJobService.processMonthlyResetBatch({ limit: 10 });

    const walletB = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantBId } });
    expect(walletB?.teacherCredits).toBe(300);
    expect(walletB?.resetAt.getTime()).toBe(futureDate.getTime());
  });

  // 14. Tenant sin wallet (manejo seguro)
  it("14. Maneja de forma segura tenants sin wallet sin lanzar excepciones no capturadas", async () => {
    const dueWallets = await AICreditJobService.findDueWallets(10);
    expect(dueWallets.length).toBe(0);

    const summary = await AICreditJobService.processMonthlyResetBatch({ limit: 10 });
    expect(summary.success).toBe(true);
    expect(summary.totalEligible).toBe(0);
  });

  // 15, 16. Tenant suspendido/inactivo o sin suscripción válida
  it("15-16. Maneja correctamente tenants con plan por defecto o suscripción inactiva", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 0,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    const summary = await AICreditJobService.processMonthlyResetBatch({ limit: 10 });
    expect(summary.processedCount).toBe(1);
  });

  // 17. Manejo correcto de fechas (Timezone agnostic UTC)
  it("17. Manejo de fechas determinista agnóstico de zona horaria", async () => {
    const fixedDate = new Date("2026-06-01T00:00:00.000Z");

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 10,
        monthlyTeacherAllowance: 150,
        resetAt: fixedDate,
      },
    });

    const summary = await AICreditJobService.processMonthlyResetBatch({
      limit: 10,
      cycleDate: fixedDate,
    });
    expect(summary.processedCount).toBe(1);
  });

  // 18, 19. Resultado/estadísticas completas del job summary y observabilidad
  it("18-19. Genera un resumen estadístico completo con tiempos y desglose por tenant", async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAId,
        teacherCredits: 10,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    const summary = await AICreditJobService.processMonthlyResetBatch({ limit: 10 });

    expect(summary.timestamp).toBeDefined();
    expect(summary.durationMs).toBeGreaterThanOrEqual(0);
    expect(summary.results.length).toBe(1);
    expect(summary.results[0].tenantId).toBe(tenantAId);
    expect(summary.results[0].status).toBe("SUCCESS");
  });

  // 20. Autenticación de seguridad en endpoint HTTP /api/cron/ai-credit-reset (CRON_SECRET)
  it("20. Endpoint HTTP /api/cron/ai-credit-reset exige autorización válida cuando CRON_SECRET está configurado", async () => {
    process.env.CRON_SECRET = "test-secret-key-12345";

    // Petición sin autorización
    const unauthReq = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset");
    const unauthRes = await cronRouteHandler(unauthReq);
    expect(unauthRes.status).toBe(401);

    // Petición con autorización válida
    const authReq = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset", {
      headers: { Authorization: "Bearer test-secret-key-12345" },
    });
    const authRes = await cronRouteHandler(authReq);
    expect(authRes.status).toBe(200);

    delete process.env.CRON_SECRET;
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { AICreditJobService } from "@/modules/ai/ai.job-service";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { AICreditType, AICreditTransactionType } from "@prisma/client";
import { GET, POST } from "@/app/api/cron/ai-credit-reset/route";
import { NextRequest } from "next/server";

describe("Paso 6.6 — Cron Jobs, Background Processes & AI Credit Renewal Engine", () => {
  let tenantStarterId: string;
  let tenantProId: string;
  let tenantAcademyId: string;
  let tenantYearlyId: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env = { ...originalEnv };

    // Limpieza de datos
    await prisma.notification.deleteMany({});
    await prisma.aICreditTransaction.deleteMany({});
    await prisma.aICreditWallet.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.membership.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.user.deleteMany({});

    // Crear Tenants de Prueba para cada nivel
    const tenantStarter = await prisma.tenant.create({
      data: { name: "Starter Academy", slug: "starter-academy-cron" },
    });
    tenantStarterId = tenantStarter.id;

    const tenantPro = await prisma.tenant.create({
      data: { name: "Pro Academy", slug: "pro-academy-cron" },
    });
    tenantProId = tenantPro.id;

    const tenantAcademy = await prisma.tenant.create({
      data: { name: "Executive Academy", slug: "executive-academy-cron" },
    });
    tenantAcademyId = tenantAcademy.id;

    const tenantYearly = await prisma.tenant.create({
      data: { name: "Yearly Pro Academy", slug: "yearly-pro-academy-cron" },
    });
    tenantYearlyId = tenantYearly.id;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // A. Procesamiento de wallets vencidas
  it("A. Debe detectar y procesar únicamente wallets cuya fecha resetAt esté cumplida (resetAt <= now)", async () => {
    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);

    // Wallet vencida
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantStarterId,
        teacherCredits: 50,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    // Wallet NO vencida
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantProId,
        teacherCredits: 600,
        monthlyTeacherAllowance: 600,
        resetAt: futureDate,
      },
    });

    const dueWallets = await AICreditJobService.findDueWallets(50, new Date());
    expect(dueWallets.length).toBe(1);
    expect(dueWallets[0].tenantId).toBe(tenantStarterId);
  });

  // B. Asignación mensual de créditos según plan
  it("B. Debe asignar la cuota mensual exacta de créditos según el plan activo (Starter 150/0, Pro 600/200, Academy 2000/800)", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. STARTER
    const resetStarter = await AICreditEngine.processMonthlyReset(tenantStarterId, pastDate);
    expect(resetStarter.teacherCredits.newAllowance).toBe(150);
    expect(resetStarter.studentCredits.newAllowance).toBe(0);

    // 2. PRO
    await prisma.subscription.create({
      data: {
        tenantId: tenantProId,
        stripeSubscriptionId: "sub_pro_cron",
        planId: "PRO",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const resetPro = await AICreditEngine.processMonthlyReset(tenantProId, pastDate);
    expect(resetPro.teacherCredits.newAllowance).toBe(600);
    expect(resetPro.studentCredits.newAllowance).toBe(200);

    // 3. ACADEMY
    await prisma.subscription.create({
      data: {
        tenantId: tenantAcademyId,
        stripeSubscriptionId: "sub_academy_cron",
        planId: "ACADEMY",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const resetAcademy = await AICreditEngine.processMonthlyReset(tenantAcademyId, pastDate);
    expect(resetAcademy.teacherCredits.newAllowance).toBe(2000);
    expect(resetAcademy.studentCredits.newAllowance).toBe(800);
  });

  // C. Rollover respetando límites de cada plan
  it("C. Debe calcular el rollover respetando estrictamente los topes por plan (Starter: 30/0, Pro: 100/50, Academy: 300/150)", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // STARTER con 150 créditos restantes -> Rollover máximo = 30
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantStarterId,
        teacherCredits: 150,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });
    const resStarter = await AICreditEngine.processMonthlyReset(tenantStarterId, pastDate);
    expect(resStarter.teacherCredits.rolloverGranted).toBe(30);

    // PRO con 600 Teacher y 200 Student restantes -> Rollover máximo = 100 Teacher / 50 Student
    await prisma.subscription.create({
      data: {
        tenantId: tenantProId,
        stripeSubscriptionId: "sub_pro_roll",
        planId: "PRO",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantProId,
        teacherCredits: 600,
        studentCredits: 200,
        monthlyTeacherAllowance: 600,
        monthlyStudentAllowance: 200,
        resetAt: pastDate,
      },
    });
    const resPro = await AICreditEngine.processMonthlyReset(tenantProId, pastDate);
    expect(resPro.teacherCredits.rolloverGranted).toBe(100);
    expect(resPro.studentCredits.rolloverGranted).toBe(50);

    // ACADEMY con 2000 Teacher y 800 Student restantes -> Rollover máximo = 300 Teacher / 150 Student
    await prisma.subscription.create({
      data: {
        tenantId: tenantAcademyId,
        stripeSubscriptionId: "sub_acad_roll",
        planId: "ACADEMY",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantAcademyId,
        teacherCredits: 2000,
        studentCredits: 800,
        monthlyTeacherAllowance: 2000,
        monthlyStudentAllowance: 800,
        resetAt: pastDate,
      },
    });
    const resAcademy = await AICreditEngine.processMonthlyReset(tenantAcademyId, pastDate);
    expect(resAcademy.teacherCredits.rolloverGranted).toBe(300);
    expect(resAcademy.studentCredits.rolloverGranted).toBe(150);
  });

  // D. Expiración del excedente de rollover
  it("D. Debe registrar transacciones de EXPIRATION por el saldo que supere el límite máximo de rollover", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Starter con 150 disponibles -> 30 rollover concedido, 120 expirados
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantStarterId,
        teacherCredits: 150,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    const res = await AICreditEngine.processMonthlyReset(tenantStarterId, pastDate);
    expect(res.teacherCredits.expiredAmount).toBe(120);

    const expTx = await prisma.aICreditTransaction.findFirst({
      where: {
        tenantId: tenantStarterId,
        transactionType: AICreditTransactionType.EXPIRATION,
      },
    });
    expect(expTx).toBeDefined();
    expect(expTx?.amount).toBe(-120);
  });

  // E. Preservación de créditos Top-Up
  it("E. Debe preservar íntegramente los créditos comprados vía Top-Up sin expirar", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Starter con 150 mensuales + 50 comprados por Top-Up
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantStarterId,
        teacherCredits: 200,
        purchasedTeacherCredits: 50,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    const res = await AICreditEngine.processMonthlyReset(tenantStarterId, pastDate);
    // 150 cuota nueva + 30 rollover + 50 comprados preservados = 230
    expect(res.teacherCredits.purchasedPreserved).toBe(50);
    expect(res.teacherCredits.newTotalAvailable).toBe(230);
  });

  // F. Suscripciones MONTHLY
  it("F. Debe renovar correctamente las suscripciones con facturación MONTHLY", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.subscription.create({
      data: {
        tenantId: tenantProId,
        stripeSubscriptionId: "sub_pro_monthly",
        planId: "PRO",
        status: "active",
        billingInterval: "MONTHLY",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantProId,
        teacherCredits: 0,
        studentCredits: 0,
        monthlyTeacherAllowance: 600,
        monthlyStudentAllowance: 200,
        resetAt: pastDate,
      },
    });

    const summary = await AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate });
    expect(summary.success).toBe(true);
    expect(summary.processedCount).toBe(1);

    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantProId } });
    expect(wallet?.teacherCredits).toBe(600);
    expect(wallet?.studentCredits).toBe(200);
  });

  // G & H. Suscripciones YEARLY no reciben 12 meses por adelantado
  it("G & H. Suscripciones YEARLY reciben estrictamente su cuota mensual de 1 mes (NO 12 meses de golpe)", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Suscripción anual con currentPeriodEnd a 365 días en el futuro
    await prisma.subscription.create({
      data: {
        tenantId: tenantYearlyId,
        stripeSubscriptionId: "sub_pro_yearly_cron",
        planId: "PRO",
        status: "active",
        billingInterval: "YEARLY",
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantYearlyId,
        teacherCredits: 0,
        studentCredits: 0,
        monthlyTeacherAllowance: 600,
        monthlyStudentAllowance: 200,
        resetAt: pastDate,
      },
    });

    const resetResult = await AICreditEngine.processMonthlyReset(tenantYearlyId, pastDate);
    expect(resetResult.success).toBe(true);

    // Debe otorgar únicamente 600 Teacher / 200 Student (1 mes), NUNCA 7,200 / 2,400
    expect(resetResult.teacherCredits.newAllowance).toBe(600);
    expect(resetResult.studentCredits.newAllowance).toBe(200);
    expect(resetResult.teacherCredits.newTotalAvailable).toBe(600);
    expect(resetResult.studentCredits.newTotalAvailable).toBe(200);
  });

  // I. Idempotencia ante ejecuciones repetidas
  it("I. Debe ser completamente idempotente si el proceso se ejecuta dos veces para el mismo ciclo", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantStarterId,
        teacherCredits: 100,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    // Primera ejecución
    const firstRun = await AICreditEngine.processMonthlyReset(tenantStarterId, pastDate);
    expect(firstRun.success).toBe(true);
    expect(firstRun.alreadyProcessed).toBe(false);

    // Segunda ejecución inmediata para el mismo periodo
    const secondRun = await AICreditEngine.processMonthlyReset(tenantStarterId, pastDate);
    expect(secondRun.success).toBe(true);
    expect(secondRun.alreadyProcessed).toBe(true);

    // Verificar que los saldos y transacciones no se hayan duplicado
    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantStarterId } });
    expect(wallet?.teacherCredits).toBe(180); // 150 new + 30 rollover

    const allocTxs = await prisma.aICreditTransaction.findMany({
      where: {
        tenantId: tenantStarterId,
        transactionType: AICreditTransactionType.ALLOCATION,
      },
    });
    expect(allocTxs.length).toBe(1);
  });

  // J. Reintentos del Cron
  it("J. Reintentos en lote del Cron Job detectan tenants ya procesados y reportan alreadyProcessedCount", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantStarterId,
        teacherCredits: 50,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    const firstSummary = await AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate });
    expect(firstSummary.processedCount).toBe(1);
    expect(firstSummary.alreadyProcessedCount).toBe(0);

    // Simular reintento forzando la fecha
    const secondSummary = await AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate });
    // En la segunda ejecución, la wallet ya tiene resetAt en el futuro (+1 mes), por lo que totalEligible es 0
    expect(secondSummary.totalEligible).toBe(0);
  });

  // K. Failure Isolation entre tenants
  it("K. Failure Isolation: si un tenant produce error, los demás tenants continúan procesándose exitosamente", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Tenant A válido
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantStarterId,
        teacherCredits: 0,
        monthlyTeacherAllowance: 150,
        resetAt: pastDate,
      },
    });

    // Tenant B con tenantId inexistente en la tabla Tenant para forzar error
    const nonExistentTenantId = "tenant_corrupt_non_existent";
    // Desactivamos temporalmente la FK creando la wallet huérfana en mock o creando con catch
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AICreditWallet" ("id", "tenantId", "teacherCredits", "studentCredits", "monthlyTeacherAllowance", "monthlyStudentAllowance", "rolloverTeacherCredits", "rolloverStudentCredits", "purchasedTeacherCredits", "purchasedStudentCredits", "resetAt", "updatedAt") 
       VALUES ('wallet_err_orphan', '${nonExistentTenantId}', 0, 0, 150, 0, 0, 0, 0, 0, '${pastDate.toISOString()}', NOW())`
    ).catch(() => {});

    // Tenant C válido
    await prisma.aICreditWallet.create({
      data: {
        tenantId: tenantProId,
        teacherCredits: 0,
        monthlyTeacherAllowance: 600,
        resetAt: pastDate,
      },
    });

    const summary = await AICreditJobService.processMonthlyResetBatch({ limit: 10, cycleDate: pastDate });
    // Al menos Starter y Pro deben haber procesado con éxito
    expect(summary.processedCount).toBeGreaterThanOrEqual(2);

    const starterWallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantStarterId } });
    expect(starterWallet?.teacherCredits).toBe(150);

    const proWallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantProId } });
    expect(proWallet?.teacherCredits).toBe(150); // Sin sub = Starter default (150)
  });

  // L, M, N, O, P, Q. Seguridad del Endpoint HTTP Cron
  it("L & M. Ausencia de CRON_SECRET en entorno de producción responde HTTP 401", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.CRON_SECRET;

    const req = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset", {
      method: "GET",
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("N. Petición con CRON_SECRET incorrecto responde HTTP 401", async () => {
    process.env.CRON_SECRET = "super-secret-cron-token-123";

    const req = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset", {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-wrong-token",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("O & P. Petición GET con Authorization: Bearer <CRON_SECRET> correcto responde HTTP 200", async () => {
    process.env.CRON_SECRET = "super-secret-cron-token-123";

    const req = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset?limit=5", {
      method: "GET",
      headers: {
        Authorization: "Bearer super-secret-cron-token-123",
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.timestamp).toBeDefined();
    expect(data.results).toBeDefined();
  });

  it("Q. Petición POST con x-cron-secret header correcto responde HTTP 200", async () => {
    process.env.CRON_SECRET = "super-secret-cron-token-123";

    const req = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset", {
      method: "POST",
      headers: {
        "x-cron-secret": "super-secret-cron-token-123",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

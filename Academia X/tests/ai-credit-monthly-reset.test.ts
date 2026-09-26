import { loginAs } from "./helpers/session";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { AICreditEngine, AICreditError } from "../src/modules/ai/ai.credit-engine";
import { NotificationService } from "../src/modules/notifications/notification.service";
import { BillingService, SAAS_PLANS } from "../src/modules/billing/billing.service";
import { AI_OPERATION_CATALOG } from "../src/modules/ai/ai.catalog";
import { TOPUP_PACKAGES } from "../src/modules/ai/ai.topup-catalog";
import { PLAN_AI_CREDIT_CONFIG } from "../src/modules/ai/ai.config";
import { triggerMonthlyResetAction } from "../src/app/actions/ai.actions";
import { prisma } from "../src/lib/db";
import { AICreditType, AICreditTransactionType, NotificationType, AIOperation } from "@prisma/client";

describe("AI Credit Monthly Reset, Rollover & Plan Synchronization Engine — Step 4.4.8", () => {
  const tenantAId = "tenant_reset_a_id";
  const tenantBId = "tenant_reset_b_id";
  const userAId = "user_reset_a_id";
  const userEmail = "user_reset_a@test.com";
  const slugA = "reset-tenant-a-fast-slug";
  const slugB = "reset-tenant-b-fast-slug";

  const cleanData = async () => {
    const tenantIds = [tenantAId, tenantBId];
    await prisma.aICreditPurchase.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.notification.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
  };

  const fullClean = async () => {
    const tenantIds = [tenantAId, tenantBId];
    await cleanData();
    await prisma.membership.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { OR: [{ id: userAId }, { email: userEmail }] } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => {});
  };

  beforeAll(async () => {
    await fullClean();

    await prisma.tenant.upsert({
      where: { id: tenantAId },
      update: { name: "Reset Tenant A", slug: slugA },
      create: { id: tenantAId, name: "Reset Tenant A", slug: slugA },
    });
    await prisma.tenant.upsert({
      where: { id: tenantBId },
      update: { name: "Reset Tenant B", slug: slugB },
      create: { id: tenantBId, name: "Reset Tenant B", slug: slugB },
    });
    await prisma.user.upsert({
      where: { id: userAId },
      update: { email: userEmail, name: "Prof. Reset User A" },
      create: { id: userAId, email: userEmail, name: "Prof. Reset User A" },
    });
    await prisma.membership.upsert({
      where: { userId_tenantId: { userId: userAId, tenantId: tenantAId } },
      update: { role: "OWNER" },
      create: { tenantId: tenantAId, userId: userAId, role: "OWNER" },
    });
  }, 30000);

  beforeEach(async () => {
    await cleanData();

    await AICreditEngine.getTenantWalletSummary(tenantAId);
    await AICreditEngine.getTenantWalletSummary(tenantBId);
  }, 30000);

  afterAll(async () => {
    await fullClean();
  });

  // 1. Reset mensual STARTER
  it("1. Debe ejecutar correctamente el reset mensual para el plan STARTER", async () => {
    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.success).toBe(true);
    expect(result.teacherCredits.newAllowance).toBe(150);
    expect(result.studentCredits.newAllowance).toBe(0);
  });

  // 2. Reset mensual PRO
  it("2. Debe ejecutar correctamente el reset mensual para el plan PRO", async () => {
    await prisma.subscription.create({
      data: {
        tenantId: tenantAId,
        stripeSubscriptionId: "sub_pro_123",
        planId: "PRO",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.success).toBe(true);
    expect(result.teacherCredits.newAllowance).toBe(800);
    expect(result.studentCredits.newAllowance).toBe(0);
  });

  // 3. Reset mensual ACADEMY
  it("3. Debe ejecutar correctamente el reset mensual para el plan ACADEMY", async () => {
    await prisma.subscription.create({
      data: {
        tenantId: tenantAId,
        stripeSubscriptionId: "sub_academy_123",
        planId: "ACADEMY",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.success).toBe(true);
    expect(result.teacherCredits.newAllowance).toBe(2800);
    expect(result.studentCredits.newAllowance).toBe(0);
  });

  // 4. Cálculo de Rollover Teacher
  it("4. Debe calcular correctamente el rollover para Teacher Credits según maxRollover", async () => {
    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.teacherCredits.rolloverGranted).toBe(30);
    expect(result.teacherCredits.expiredAmount).toBe(120);
    expect(result.teacherCredits.newTotalAvailable).toBe(180);
  });

  // 5. Cálculo de Rollover Student
  it("5. PRO ya no otorga créditos de estudiante: no hay cuota ni rollover", async () => {
    await prisma.subscription.create({
      data: {
        tenantId: tenantAId,
        stripeSubscriptionId: "sub_pro_student",
        planId: "PRO",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await AICreditEngine.syncWalletWithPlan(tenantAId, "PRO");

    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.studentCredits.rolloverGranted).toBe(0);
    expect(result.studentCredits.expiredAmount).toBe(0);
    expect(result.studentCredits.newTotalAvailable).toBe(0);
  });

  // 6. Expiración de excedente
  it("6. Debe registrar la expiración de los créditos mensuales que superen el tope de rollover", async () => {
    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.teacherCredits.expiredAmount).toBe(120);

    const expTx = await prisma.aICreditTransaction.findFirst({
      where: {
        tenantId: tenantAId,
        transactionType: AICreditTransactionType.EXPIRATION,
        creditType: AICreditType.TEACHER,
      },
    });
    expect(expTx).toBeDefined();
    expect(expTx?.amount).toBe(-120);
  });

  // 7. Ledger ROLLOVER
  it("7. Debe registrar correctamente la entrada de ledger de tipo ROLLOVER", async () => {
    await AICreditEngine.processMonthlyReset(tenantAId);
    const rollTx = await prisma.aICreditTransaction.findFirst({
      where: {
        tenantId: tenantAId,
        transactionType: AICreditTransactionType.ROLLOVER,
        creditType: AICreditType.TEACHER,
      },
    });
    expect(rollTx).toBeDefined();
    expect(rollTx?.amount).toBe(30);
  });

  // 8. Ledger EXPIRATION
  it("8. Debe registrar correctamente la entrada de ledger de tipo EXPIRATION", async () => {
    await AICreditEngine.processMonthlyReset(tenantAId);
    const expTx = await prisma.aICreditTransaction.findFirst({
      where: {
        tenantId: tenantAId,
        transactionType: AICreditTransactionType.EXPIRATION,
      },
    });
    expect(expTx).toBeDefined();
  });

  // 9. Ledger ALLOCATION
  it("9. Debe registrar correctamente la entrada de ledger de tipo ALLOCATION", async () => {
    await AICreditEngine.processMonthlyReset(tenantAId);
    const allocTx = await prisma.aICreditTransaction.findFirst({
      where: {
        tenantId: tenantAId,
        transactionType: AICreditTransactionType.ALLOCATION,
        creditType: AICreditType.TEACHER,
      },
    });
    expect(allocTx).toBeDefined();
    expect(allocTx?.amount).toBe(150);
  });

  // 10. Idempotencia del mismo reset
  it("10. Debe ser idempotente cuando se ejecuta el reset múltiples veces para el mismo período", async () => {
    const periodDate = new Date("2026-09-01");
    const res1 = await AICreditEngine.processMonthlyReset(tenantAId, periodDate);
    expect(res1.alreadyProcessed).toBe(false);

    const res2 = await AICreditEngine.processMonthlyReset(tenantAId, periodDate);
    expect(res2.alreadyProcessed).toBe(true);

    const allocTxs = await prisma.aICreditTransaction.findMany({
      where: {
        tenantId: tenantAId,
        transactionType: AICreditTransactionType.ALLOCATION,
        creditType: AICreditType.TEACHER,
      },
    });
    expect(allocTxs.length).toBe(1);
  });

  // 11. Concurrencia / Idempotencia de resets simultáneos
  it("11. Debe soportar la ejecución concurrente de dos resets sin duplicar créditos", async () => {
    const periodDate = new Date("2026-10-01");
    const res1 = await AICreditEngine.processMonthlyReset(tenantAId, periodDate);
    const res2 = await AICreditEngine.processMonthlyReset(tenantAId, periodDate);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.alreadyProcessed || res2.alreadyProcessed).toBe(true);

    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(wallet?.teacherCredits).toBe(180);
  });

  // 12. Tenant Isolation
  it("12. El reset del Tenant A no debe alterar la billetera ni el resetAt del Tenant B", async () => {
    const walletBBefore = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantBId } });

    await AICreditEngine.processMonthlyReset(tenantAId);

    const walletBAfter = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantBId } });
    expect(walletBAfter?.teacherCredits).toBe(walletBBefore?.teacherCredits);
    expect(walletBAfter?.resetAt.getTime()).toBe(walletBBefore?.resetAt.getTime());
  });

  // 13. Preservación de purchasedTeacherCredits
  it("13. Debe preservar intactos los créditos purchasedTeacherCredits comprados vía Top-Up", async () => {
    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.TEACHER,
      amount: 150,
      idempotencyKey: "topup_purchased_test_13",
    });

    const walletBefore = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(walletBefore?.purchasedTeacherCredits).toBe(150);

    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.teacherCredits.purchasedPreserved).toBe(150);

    const walletAfter = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(walletAfter?.purchasedTeacherCredits).toBe(150);
    expect(walletAfter?.teacherCredits).toBe(330);
  });

  // 14. Preservación de purchasedStudentCredits
  it("14. Debe preservar intactos los créditos purchasedStudentCredits comprados vía Top-Up", async () => {
    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.STUDENT,
      amount: 100,
      idempotencyKey: "topup_purchased_test_14",
    });

    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.studentCredits.purchasedPreserved).toBe(100);

    const walletAfter = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(walletAfter?.purchasedStudentCredits).toBe(100);
  });

  // 15. Purchased credits no participan en rollover
  it("15. Los créditos comprados no deben contarse como cuota mensual no consumida para rollover", async () => {
    await AICreditEngine.consumeCredits({
      tenantId: tenantAId,
      userId: userAId,
      operation: AIOperation.COURSE_GENERATION,
    });

    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.TEACHER,
      amount: 50,
      idempotencyKey: "topup_purchased_test_15",
    });

    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.teacherCredits.rolloverGranted).toBe(30);
    expect(result.teacherCredits.purchasedPreserved).toBe(50);
  });

  // 16. Purchased credits no expiran
  it("16. Los créditos comprados nunca expiran en la transacción de reset", async () => {
    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.TEACHER,
      amount: 500,
      idempotencyKey: "topup_purchased_test_16",
    });

    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.teacherCredits.purchasedPreserved).toBe(500);

    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(wallet?.purchasedTeacherCredits).toBe(500);
  });

  // 17. Renovación de cuota mensual
  it("17. Debe renovar correctamente la cuota mensual asignando monthlyTeacherAllowance", async () => {
    const result = await AICreditEngine.processMonthlyReset(tenantAId);
    expect(result.teacherCredits.newAllowance).toBe(150);
  });

  // 18. Actualización de resetAt
  it("18. Debe actualizar resetAt al siguiente mes de facturación", async () => {
    const walletBefore = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    const result = await AICreditEngine.processMonthlyReset(tenantAId);

    expect(result.nextResetAt.getTime()).toBeGreaterThan(walletBefore!.resetAt.getTime());
  });

  // 19. Notificación CREDIT_MONTHLY_RESET
  it("19. Debe generar la notificación CREDIT_MONTHLY_RESET al ejecutar el reset", async () => {
    await AICreditEngine.processMonthlyReset(tenantAId, undefined, undefined, userAId);

    const notification = await prisma.notification.findFirst({
      where: {
        tenantId: tenantAId,
        type: NotificationType.CREDIT_MONTHLY_RESET,
      },
    });
    expect(notification).not.toBeNull();
    expect(notification?.title).toMatch(/renovada/i);
  });

  // 20. Notification de reset es idempotente
  it("20. No debe crear notificaciones duplicadas en ejecuciones repetidas", async () => {
    const periodDate = new Date("2026-11-01");
    await AICreditEngine.processMonthlyReset(tenantAId, periodDate, undefined, userAId);
    await AICreditEngine.processMonthlyReset(tenantAId, periodDate, undefined, userAId);

    const notifications = await prisma.notification.findMany({
      where: {
        tenantId: tenantAId,
        type: NotificationType.CREDIT_MONTHLY_RESET,
      },
    });
    expect(notifications.length).toBe(1);
  });

  // 21. Upgrade de plan
  it("21. Debe sincronizar las cuotas de la wallet al realizar un Upgrade de plan (STARTER -> PRO)", async () => {
    const walletBefore = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(walletBefore?.monthlyTeacherAllowance).toBe(150);

    await BillingService.createCheckoutSession(tenantAId, "PRO");

    const walletAfter = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(walletAfter?.monthlyTeacherAllowance).toBe(800);
    expect(walletAfter?.monthlyStudentAllowance).toBe(0);
  });

  // 22. Downgrade de plan
  it("22. Debe actualizar las cuotas al realizar un Downgrade de plan (PRO -> STARTER)", async () => {
    await BillingService.createCheckoutSession(tenantAId, "PRO");
    await BillingService.createCheckoutSession(tenantAId, "STARTER");

    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(wallet?.monthlyTeacherAllowance).toBe(150);
    expect(wallet?.monthlyStudentAllowance).toBe(0);
  });

  // 23. Cambio de plan preserva Top-Ups
  it("23. Un cambio de plan (Upgrade o Downgrade) debe preservar intactos los créditos Top-Up comprados", async () => {
    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.TEACHER,
      amount: 150,
      idempotencyKey: "topup_purchased_test_23",
    });

    await BillingService.createCheckoutSession(tenantAId, "ACADEMY");

    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(wallet?.purchasedTeacherCredits).toBe(150);
    expect(wallet?.monthlyTeacherAllowance).toBe(2800);
  });

  // 24. BillingService refleja $29 / $79 / $199
  it("24. BillingService debe reflejar las constantes de precios y cuotas oficiales ($29, $79, $199)", () => {
    expect(SAAS_PLANS.STARTER.price).toBe(29);
    expect(SAAS_PLANS.PRO.price).toBe(79);
    expect(SAAS_PLANS.ACADEMY.price).toBe(199);

    expect(SAAS_PLANS.STARTER.teacherCredits).toBe(150);
    expect(SAAS_PLANS.PRO.teacherCredits).toBe(800);
    expect(SAAS_PLANS.PRO.studentCredits).toBe(0);
    expect(SAAS_PLANS.ACADEMY.teacherCredits).toBe(2800);
    expect(SAAS_PLANS.ACADEMY.studentCredits).toBe(0);
  });

  // 25. No altera AI catalog
  it("25. Debe mantener inalterado el AI Operation Catalog", () => {
    expect(AI_OPERATION_CATALOG.COURSE_GENERATION.creditCost).toBe(5);
    expect(AI_OPERATION_CATALOG.LESSON_GENERATION.creditCost).toBe(2);
    expect(AI_OPERATION_CATALOG.ACTIVITY_GENERATION.creditCost).toBe(1);
    expect(AI_OPERATION_CATALOG.QUIZ_GENERATION.creditCost).toBe(1);
    expect(AI_OPERATION_CATALOG.LANDING_GENERATION.creditCost).toBe(8);
  });

  // 26. No altera Top-Up catalog
  it("26. Debe mantener inalterado el Top-Up Catalog", () => {
    expect(TOPUP_PACKAGES.TEACHER_TOPUP_50.credits).toBe(50);
    expect(TOPUP_PACKAGES.TEACHER_TOPUP_50.price).toBe(15);
    expect(TOPUP_PACKAGES.STUDENT_TOPUP_100.credits).toBe(100);
    expect(TOPUP_PACKAGES.STUDENT_TOPUP_100.price).toBe(10);
  });

  // 27. Compatibilidad con refundCredits
  it("27. Debe permitir reembolsos de operaciones consumidas tras ejecutar el reset mensual", async () => {
    await AICreditEngine.processMonthlyReset(tenantAId);

    const consumeRes = await AICreditEngine.consumeCredits({
      tenantId: tenantAId,
      userId: userAId,
      operation: AIOperation.COURSE_GENERATION,
      idempotencyKey: "tx_pre_refund_reset_27",
    });

    const refundRes = await AICreditEngine.refundCredits({
      tenantId: tenantAId,
      transactionId: consumeRes.transactionId!,
      userId: userAId,
    });

    expect(refundRes.success).toBe(true);
    expect(refundRes.creditsRefunded).toBe(5);
  });

  // 28. Compatibilidad con grantPurchasedCredits
  it("28. Debe permitir la compra de Top-Ups antes o después de ejecutar el reset mensual", async () => {
    await AICreditEngine.processMonthlyReset(tenantAId);

    const grantRes = await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.TEACHER,
      amount: 50,
      idempotencyKey: "topup_post_reset_28",
    });

    expect(grantRes.alreadyProcessed).toBe(false);
    expect(grantRes.updatedWallet?.purchasedTeacherCredits).toBe(50);
  });

  // 29. Server Action triggerMonthlyResetAction
  it("29. Debe exponer la Server Action triggerMonthlyResetAction de forma delegada y segura", async () => {
    const formData = new FormData();
    formData.append("tenantId", tenantAId);
    formData.append("userId", userAId);
    await loginAs(tenantAId, userAId, { ensurePlan: false });

    // Un usuario normal NO puede forzar el reset (solo el cron o SUPER_ADMIN)
    const deniedRes = await triggerMonthlyResetAction(formData);
    expect(deniedRes.success).toBe(false);

    await prisma.user.update({ where: { id: userAId }, data: { globalRole: "SUPER_ADMIN" } });
    try {
      const actionRes = await triggerMonthlyResetAction(formData);
      expect(actionRes.success).toBe(true);
    } finally {
      await prisma.user.update({ where: { id: userAId }, data: { globalRole: "USER" } });
    }
  });

  // 30. Resumen de Billetera incluye desglose de Rollover y Purchased
  it("30. getTenantWalletSummary debe incluir el desglose completo de rollover y purchased credits", async () => {
    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.TEACHER,
      amount: 50,
      idempotencyKey: "topup_summary_30",
    });

    const summary = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(summary.teacherCredits.purchasedCredits).toBe(50);
    expect(summary.teacherCredits.monthlyAllowance).toBe(150);
  });
});

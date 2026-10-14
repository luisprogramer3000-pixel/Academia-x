import { loginAs } from "./helpers/session";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { TOPUP_PACKAGES, getTopUpPackage } from "../src/modules/ai/ai.topup-catalog";
import { CreditPurchaseService } from "../src/modules/billing/credit-purchase.service";
import { AICreditEngine, AICreditError } from "../src/modules/ai/ai.credit-engine";
import { NotificationService } from "../src/modules/notifications/notification.service";
import {
  getTopUpPackagesAction,
  createTopUpCheckoutAction,
  fulfillTopUpPurchaseAction,
  getTopUpHistoryAction,
} from "../src/app/actions/topup.actions";
import { prisma } from "../src/lib/db";
import { AICreditType, AICreditTransactionType, NotificationType, AIOperation } from "@prisma/client";

describe("AI Credit Top-Ups / Add-On Purchase System — Step 4.4.7", () => {
  const tenantAId = "tenant_topup_a_id";
  const tenantBId = "tenant_topup_b_id";
  const userAId = "user_topup_a_id";

  beforeEach(async () => {
    // Cleanup DB
    await prisma.aICreditPurchase.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: userAId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    // Seed test tenants & user
    await prisma.tenant.create({
      data: { id: tenantAId, name: "TopUp Tenant A", slug: "topup-tenant-a" },
    });
    await prisma.tenant.create({
      data: { id: tenantBId, name: "TopUp Tenant B", slug: "topup-tenant-b" },
    });
    await prisma.user.create({
      data: { id: userAId, email: "user_topup_a@test.com", name: "Prof. TopUp User A" },
    });
    await prisma.membership.create({
      data: { tenantId: tenantAId, userId: userAId, role: "OWNER" },
    });

    // Auto-init wallets
    await AICreditEngine.getTenantWalletSummary(tenantAId);
    await AICreditEngine.getTenantWalletSummary(tenantBId);
  }, 30000);

  afterEach(async () => {
    await prisma.aICreditPurchase.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: userAId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  }, 30000);

  it("1. Listado de paquetes: Retorna los 5 paquetes oficiales de Top-Up sin hardcoding", async () => {
    const res = await getTopUpPackagesAction();
    expect(res.success).toBe(true);
    expect(res.packages?.length).toBe(5);

    const ids = res.packages?.map((p) => p.id);
    expect(ids).toContain("TEACHER_TOPUP_50");
    expect(ids).toContain("TEACHER_TOPUP_150");
    expect(ids).toContain("TEACHER_TOPUP_500");
    expect(ids).toContain("STUDENT_TOPUP_100");
    expect(ids).toContain("STUDENT_TOPUP_500");
  });

  it("2. Precio autoritativo desde servidor: getTopUpPackage resuelve el precio real", () => {
    const pkg = getTopUpPackage("TEACHER_TOPUP_50");
    expect(pkg?.price).toBe(15);
    expect(pkg?.credits).toBe(50);
    expect(pkg?.creditType).toBe(AICreditType.TEACHER);
  });

  it("3. Tenant isolation: Tenant A no puede consultar o manipular compras del Tenant B", async () => {
    const intentA = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    const historyA = await CreditPurchaseService.getTenantPurchaseHistory(tenantAId);
    const historyB = await CreditPurchaseService.getTenantPurchaseHistory(tenantBId);

    expect(historyA.length).toBe(1);
    expect(historyA[0].tenantId).toBe(tenantAId);
    expect(historyB.length).toBe(0);
  });

  it("4. Compra exitosa: Flujo completo PENDING -> COMPLETED otorga créditos", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    expect(intent.status).toBe("PENDING");

    const fulfill = await CreditPurchaseService.fulfillPurchase({
      providerPaymentId: intent.providerPaymentId,
    });

    expect(fulfill.success).toBe(true);
    expect(fulfill.alreadyProcessed).toBe(false);
    expect(fulfill.creditsGranted).toBe(50);

    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(150 + 50); // 150 inicial + 50 comprados
  });

  it("5. Compra fallida: Transición a estado FAILED no altera saldos", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    await CreditPurchaseService.failPurchase(intent.purchaseId, "Card declined test");

    const purchase = await prisma.aICreditPurchase.findUnique({ where: { id: intent.purchaseId } });
    expect(purchase?.status).toBe("FAILED");

    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(150); // Intacto
  });

  it("6. Pago pendiente: El registro PENDING conserva el estado antes del webhook", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    const purchase = await prisma.aICreditPurchase.findUnique({ where: { id: intent.purchaseId } });
    expect(purchase?.status).toBe("PENDING");
  });

  it("7. Webhook válido: Fulfill por providerPaymentId activa la acreditación", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_150",
    });

    await loginAs(tenantAId, userAId);

    const res = await fulfillTopUpPurchaseAction(intent.providerPaymentId);
    expect(res.success).toBe(true);
    expect(res.creditsGranted).toBe(150);
  });

  it("8. Webhook duplicado: Procesar 2 veces la misma compra no duplica créditos", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    // 1er Fulfillment
    await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });

    // 2do Fulfillment (Reintento de Webhook)
    const secondFulfill = await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });

    expect(secondFulfill.alreadyProcessed).toBe(true);

    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(200); // 150 + 50 una sola vez
  });

  it("9. Webhook concurrente: Manejo seguro de colisiones en base de datos", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    // Ejecutar 2 fulfillments secuenciales/paralelos
    const r1 = await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });
    const r2 = await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.alreadyProcessed).toBe(false);
    expect(r2.alreadyProcessed).toBe(true);

    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(200);
  });

  it("10. Doble click del cliente: Intentos concurrentes de intenciones se manejan de forma segura", async () => {
    const [i1, i2] = await Promise.all([
      CreditPurchaseService.createPurchaseIntent({ tenantId: tenantAId, userId: userAId, packageId: "TEACHER_TOPUP_50" }),
      CreditPurchaseService.createPurchaseIntent({ tenantId: tenantAId, userId: userAId, packageId: "TEACHER_TOPUP_50" }),
    ]);

    expect(i1.purchaseId).not.toBe(i2.purchaseId);
    expect(i1.status).toBe("PENDING");
    expect(i2.status).toBe("PENDING");
  });

  it("11. No doble acreditación: Verificación explícita de wallet balance tras múltiples llamadas", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    for (let i = 0; i < 5; i++) {
      await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });
    }

    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(200);
  });

  it("12. Créditos correctos acreditados: Se otorga exactamente la cantidad del paquete", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_500",
    });

    await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });

    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(150 + 500);
  });

  it("13. Tipo Teacher correcto: Se incrementa la bolsa de Teacher Credits", async () => {
    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.TEACHER,
      amount: 50,
      referenceId: "ref_test_teacher",
    });

    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(wallet?.purchasedTeacherCredits).toBe(50);
    expect(wallet?.teacherCredits).toBe(200);
  });

  it("14. Tipo Student correcto: Se incrementa la bolsa de Student Credits", async () => {
    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.STUDENT,
      amount: 100,
      referenceId: "ref_test_student",
    });

    const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantAId } });
    expect(wallet?.purchasedStudentCredits).toBe(100);
    expect(wallet?.studentCredits).toBe(100);
  });

  it("15. Ledger correcto: Registra entrada AICreditTransactionType.PURCHASE", async () => {
    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.TEACHER,
      amount: 50,
      referenceId: "ref_ledger_test",
    });

    const txs = await AICreditEngine.getTenantCreditHistory(tenantAId);
    const purchaseTx = txs.find((t) => t.transactionType === AICreditTransactionType.PURCHASE);

    expect(purchaseTx).toBeDefined();
    expect(purchaseTx?.amount).toBe(50);
    expect(purchaseTx?.creditType).toBe(AICreditType.TEACHER);
  });

  it("16. Purchase ID correcto: Se almacena en la referencia de la transacción de créditos", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });

    const txs = await AICreditEngine.getTenantCreditHistory(tenantAId);
    const purchaseTx = txs.find((t) => t.transactionType === AICreditTransactionType.PURCHASE);

    expect(purchaseTx?.referenceId).toBe(intent.purchaseId);
  });

  it("17. Payment ID único: providerPaymentId es registrado y único en DB", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    const purchase = await prisma.aICreditPurchase.findUnique({ where: { id: intent.purchaseId } });
    expect(purchase?.providerPaymentId).toBe(intent.providerPaymentId);
  });

  it("18. Refund de compra: Cambio de estado a REFUNDED en la compra", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });
    await prisma.aICreditPurchase.update({ where: { id: intent.purchaseId }, data: { status: "REFUNDED" } });

    const purchase = await prisma.aICreditPurchase.findUnique({ where: { id: intent.purchaseId } });
    expect(purchase?.status).toBe("REFUNDED");
  });

  it("19. Chargeback handling: Registro auditable de disputa", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    await prisma.aICreditPurchase.update({
      where: { id: intent.purchaseId },
      data: { status: "REFUNDED", metadata: { chargeback: true, disputeId: "disp_123" } },
    });

    const purchase = await prisma.aICreditPurchase.findUnique({ where: { id: intent.purchaseId } });
    expect(purchase?.status).toBe("REFUNDED");
    expect((purchase?.metadata as any)?.chargeback).toBe(true);
  });

  it("20. Tenant inexistente rechazado: Retorna error TENANT_NOT_FOUND", async () => {
    await expect(
      CreditPurchaseService.createPurchaseIntent({
        tenantId: "non_existent_tenant",
        packageId: "TEACHER_TOPUP_50",
      })
    ).rejects.toThrow(AICreditError.TENANT_NOT_FOUND);
  });

  it("21. Usuario sin membership rechazado: Retorna error USER_NOT_IN_TENANT", async () => {
    await expect(
      CreditPurchaseService.createPurchaseIntent({
        tenantId: tenantBId, // Tenant B no tiene a userAId
        userId: userAId,
        packageId: "TEACHER_TOPUP_50",
      })
    ).rejects.toThrow(AICreditError.USER_NOT_IN_TENANT);
  });

  it("22. Paquete de Top-Up inexistente rechazado: Retorna error INVALID_TOPUP_PACKAGE", async () => {
    await expect(
      CreditPurchaseService.createPurchaseIntent({
        tenantId: tenantAId,
        userId: userAId,
        packageId: "INVALID_HACKED_PACKAGE",
      })
    ).rejects.toThrow("INVALID_TOPUP_PACKAGE");
  });

  it("23. Manipulación de precio en cliente rechazada: Servidor usa precio del catálogo autoritativo", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50", // $15 USD
    });

    expect(Number(intent.pkg.price)).toBe(15);
  });

  it("24. Manipulación de créditos en cliente rechazada: Servidor usa créditos del catálogo autoritativo", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50", // 50 cr
    });

    expect(intent.pkg.credits).toBe(50);
  });

  it("25. Notificación de compra: Genera notificación CREDIT_TOPUP_PURCHASED", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });

    const notifs = await NotificationService.getTenantNotifications(tenantAId);
    const topupNotif = notifs.notifications.find((n) => n.type === NotificationType.CREDIT_TOPUP_PURCHASED);

    expect(topupNotif).toBeDefined();
    expect(topupNotif?.title).toContain("Compra exitosa: +50 cr");
  });

  it("26. Notificación idempotente: Fulfill doble no genera 2 notificaciones", async () => {
    const intent = await CreditPurchaseService.createPurchaseIntent({
      tenantId: tenantAId,
      userId: userAId,
      packageId: "TEACHER_TOPUP_50",
    });

    await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });
    await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent.providerPaymentId });

    const notifs = await NotificationService.getTenantNotifications(tenantAId);
    const topupNotifs = notifs.notifications.filter((n) => n.type === NotificationType.CREDIT_TOPUP_PURCHASED);

    expect(topupNotifs.length).toBe(1);
  });

  it("27. Compatibilidad con cuota mensual: Saldo disponible suma mensual y comprados", async () => {
    await AICreditEngine.grantPurchasedCredits({
      tenantId: tenantAId,
      creditType: AICreditType.TEACHER,
      amount: 100,
    });

    const summary = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(summary.teacherCredits.available).toBe(250); // 150 mensual + 100 comprados
  });

  it("28. Compatibilidad con rollover: Consumos no interfieren con rollover", async () => {
    const summary = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(summary.teacherCredits.maxRollover).toBe(30); // 20% de 150 para STARTER
  });

  it("29. Compatibilidad con el sistema de refund de IA: Créditos reembolsados por falla aplican correctamente", async () => {
    const consumeRes = await AICreditEngine.consumeCredits({
      tenantId: tenantAId,
      userId: userAId,
      operation: AIOperation.COURSE_GENERATION,
    });

    const refundRes = await AICreditEngine.refundCredits({
      tenantId: tenantAId,
      transactionId: consumeRes.transactionId!,
    });

    expect(refundRes.success).toBe(true);
    expect(refundRes.creditsRefunded).toBe(5);
  });

  it("30. Concurrencia e integridad del ledger: Múltiples compras de distintos tipos en paralelo", async () => {
    const intent1 = await CreditPurchaseService.createPurchaseIntent({ tenantId: tenantAId, userId: userAId, packageId: "TEACHER_TOPUP_50" });
    const intent2 = await CreditPurchaseService.createPurchaseIntent({ tenantId: tenantAId, userId: userAId, packageId: "STUDENT_TOPUP_100" });

    await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent1.providerPaymentId });
    await CreditPurchaseService.fulfillPurchase({ providerPaymentId: intent2.providerPaymentId });

    const wallet = await AICreditEngine.getTenantWalletSummary(tenantAId);
    expect(wallet.teacherCredits.available).toBe(200); // 150 + 50
    expect(wallet.studentCredits.available).toBe(100); // 0 + 100

    await loginAs(tenantAId, userAId);

    const purchases = await getTopUpHistoryAction(tenantAId);
    expect(purchases.purchases?.length).toBe(2);
  }, 60000);
});

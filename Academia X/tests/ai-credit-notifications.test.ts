import { loginAs } from "./helpers/session";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NotificationService } from "../src/modules/notifications/notification.service";
import { AICreditEngine } from "../src/modules/ai/ai.credit-engine";
import {
  getTenantNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "../src/app/actions/notification.actions";
import { prisma } from "../src/lib/db";
import { AIOperation, AICreditType, NotificationType } from "@prisma/client";

describe("AI Credit Consumption Notifications & Alerts — Step 4.4.6", () => {
  const tenantAId = "tenant_notif_a_id";
  const tenantBId = "tenant_notif_b_id";
  const userAId = "user_notif_a_id";

  beforeEach(async () => {
    // Clean DB
    await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: userAId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });

    // Seed test tenants & users
    await prisma.tenant.create({
      data: { id: tenantAId, name: "Notif Tenant A", slug: "notif-tenant-a" },
    });
    await prisma.tenant.create({
      data: { id: tenantBId, name: "Notif Tenant B", slug: "notif-tenant-b" },
    });
    await prisma.user.create({
      data: { id: userAId, email: "user_notif_a@test.com", name: "Prof. Notif User A" },
    });
    await prisma.membership.create({
      data: { tenantId: tenantAId, userId: userAId, role: "OWNER" },
    });

    // Auto-init wallets
    await AICreditEngine.getTenantWalletSummary(tenantAId);
    await AICreditEngine.getTenantWalletSummary(tenantBId);
  }, 30000);

  afterEach(async () => {
    await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aIUsage.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.aICreditWallet.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId] } } });
    await prisma.user.deleteMany({ where: { id: userAId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
  }, 30000);

  it("1. Genera notificación CREDIT_WARNING al alcanzar el 50% de consumo", async () => {
    // Allowance es 150 cr. Disponible = 75 cr (50% consumido)
    const res = await NotificationService.evaluateCreditAlerts(
      tenantAId,
      AICreditType.TEACHER,
      75,
      150,
      userAId
    );

    expect(res.created).toBe(true);
    expect(res.type).toBe(NotificationType.CREDIT_WARNING);

    const data = await NotificationService.getTenantNotifications(tenantAId);
    expect(data.notifications.length).toBe(1);
    expect(data.unreadCount).toBe(1);
    expect(data.notifications[0].title).toContain("Aviso de consumo");
  });

  it("2. Idempotencia de Umbral: Múltiples consumos dentro del mismo umbral NO generan notificaciones duplicadas", async () => {
    // 1er consumo a 75 cr (50%)
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 75, 150);

    // 2do consumo a 74 cr (50.6%) -> mismo umbral CREDIT_WARNING
    const res2 = await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 74, 150);

    expect(res2.created).toBe(false);
    expect(res2.alreadyProcessed).toBe(true);

    const data = await NotificationService.getTenantNotifications(tenantAId);
    expect(data.notifications.length).toBe(1);
  });

  it("3. Transición de umbrales: 50% (WARNING) -> 70% (LOW) -> 90% (CRITICAL) -> 100% (EXHAUSTED)", async () => {
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 75, 150); // 50%
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 45, 150); // 70%
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 15, 150); // 90%
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 0, 150);  // 100%

    const data = await NotificationService.getTenantNotifications(tenantAId);
    expect(data.notifications.length).toBe(4);
    expect(data.unreadCount).toBe(4);

    const types = data.notifications.map((n) => n.type);
    expect(types).toContain(NotificationType.CREDIT_WARNING);
    expect(types).toContain(NotificationType.CREDIT_LOW);
    expect(types).toContain(NotificationType.CREDIT_CRITICAL);
    expect(types).toContain(NotificationType.CREDIT_EXHAUSTED);
  });

  it("4. Transacción de refund crea la notificación CREDIT_REFUNDED vinculada", async () => {
    const consumeRes = await AICreditEngine.consumeCredits({
      tenantId: tenantAId,
      userId: userAId,
      operation: AIOperation.COURSE_GENERATION,
    });

    await AICreditEngine.refundCredits({
      tenantId: tenantAId,
      transactionId: consumeRes.transactionId!,
      reason: "Execution failure refund test",
    });

    // Esperar a que la promesa asíncrona de NotificationService.notifyRefund termine de persistir en Supabase
    let data = await NotificationService.getTenantNotifications(tenantAId);
    let refundNotif = data.notifications.find((n) => n.type === NotificationType.CREDIT_REFUNDED);
    if (!refundNotif) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      data = await NotificationService.getTenantNotifications(tenantAId);
      refundNotif = data.notifications.find((n) => n.type === NotificationType.CREDIT_REFUNDED);
    }

    expect(refundNotif).toBeDefined();
    expect(refundNotif?.title).toContain("Reembolso de 5 cr efectuado");
  });

  it("5. Separación absoluta entre Teacher Credits y Student Credits", async () => {
    // Alerta de Teacher
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 15, 150);
    // Alerta de Student
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.STUDENT, 5, 50);

    const data = await NotificationService.getTenantNotifications(tenantAId);
    expect(data.notifications.length).toBe(2);

    const teacherNotif = data.notifications.find((n) => n.creditType === AICreditType.TEACHER);
    const studentNotif = data.notifications.find((n) => n.creditType === AICreditType.STUDENT);

    expect(teacherNotif?.title).toContain("Créditos de Profesor IA");
    expect(studentNotif?.title).toContain("Créditos para Estudiantes IA");
  });

  it("6. Tenant Isolation: Tenant A no puede acceder ni marcar como leídas las notificaciones del Tenant B", async () => {
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 75, 150);
    await NotificationService.evaluateCreditAlerts(tenantBId, AICreditType.TEACHER, 75, 150);

    const dataA = await NotificationService.getTenantNotifications(tenantAId);
    const dataB = await NotificationService.getTenantNotifications(tenantBId);

    expect(dataA.notifications.length).toBe(1);
    expect(dataA.notifications[0].tenantId).toBe(tenantAId);
    expect(dataB.notifications.length).toBe(1);
    expect(dataB.notifications[0].tenantId).toBe(tenantBId);

    // Un usuario con sesión en el Tenant B intenta marcar como leída la notificación de Tenant A
    await prisma.membership.create({ data: { tenantId: tenantBId, userId: userAId, role: "OWNER" } });
    await loginAs(tenantBId, userAId);
    await markNotificationReadAction(tenantBId, dataA.notifications[0].id);

    // La notificación de Tenant A sigue sin leer
    const checkA = await NotificationService.getTenantNotifications(tenantAId);
    expect(checkA.unreadCount).toBe(1);
  });

  it("7. Marcado de lectura individual y masivo (markAsRead / markAllAsRead)", async () => {
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 75, 150);
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 45, 150);

    let data = await NotificationService.getTenantNotifications(tenantAId);
    expect(data.unreadCount).toBe(2);

    // Marcar 1 individual
    const notifId = data.notifications[0].id;
    await loginAs(tenantAId, userAId);
    await markNotificationReadAction(tenantAId, notifId);

    data = await NotificationService.getTenantNotifications(tenantAId);
    expect(data.unreadCount).toBe(1);

    // Marcar todas
    await loginAs(tenantAId, userAId);
    await markAllNotificationsReadAction(tenantAId);

    data = await NotificationService.getTenantNotifications(tenantAId);
    expect(data.unreadCount).toBe(0);
    expect(data.notifications.every((n) => n.read)).toBe(true);
  });

  it("8. Server Action getTenantNotificationsAction responde exitosamente con formato cliente", async () => {
    await NotificationService.evaluateCreditAlerts(tenantAId, AICreditType.TEACHER, 75, 150);

    await loginAs(tenantAId, userAId);

    const res = await getTenantNotificationsAction(tenantAId);
    expect(res.success).toBe(true);
    expect(res.notifications?.length).toBe(1);
    expect(res.unreadCount).toBe(1);
  });
});

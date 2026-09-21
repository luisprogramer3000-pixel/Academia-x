import { prisma } from "@/lib/db";
import { AICreditType, NotificationType } from "@prisma/client";

export interface CreditAlertEvaluationOutput {
  created: boolean;
  alreadyProcessed: boolean;
  notificationId?: string;
  type?: NotificationType;
  idempotencyKey?: string;
}

export class NotificationService {
  /**
   * Evalúa el consumo de créditos de un tenant y genera la alerta correspondiente de forma atómica e idempotente.
   * Evita duplicaciones por ciclo mensual y umbral.
   */
  static async evaluateCreditAlerts(
    tenantId: string,
    creditType: AICreditType,
    availableCredits: number,
    monthlyAllowance: number,
    userId?: string
  ): Promise<CreditAlertEvaluationOutput> {
    if (monthlyAllowance <= 0) {
      return { created: false, alreadyProcessed: false };
    }

    const usedCredits = Math.max(0, monthlyAllowance - availableCredits);
    const usagePercentage = Math.min(Math.round((usedCredits / monthlyAllowance) * 100), 100);

    let alertType: NotificationType | null = null;
    let thresholdLabel = "";

    if (availableCredits <= 0) {
      alertType = NotificationType.CREDIT_EXHAUSTED;
      thresholdLabel = "100";
    } else if (usagePercentage >= 90) {
      alertType = NotificationType.CREDIT_CRITICAL;
      thresholdLabel = "90";
    } else if (usagePercentage >= 70) {
      alertType = NotificationType.CREDIT_LOW;
      thresholdLabel = "70";
    } else if (usagePercentage >= 50) {
      alertType = NotificationType.CREDIT_WARNING;
      thresholdLabel = "50";
    }

    if (!alertType) {
      return { created: false, alreadyProcessed: false };
    }

    const now = new Date();
    const cycleYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const idempotencyKey = `notify:${tenantId}:${creditType}:${cycleYearMonth}:${alertType}`;

    // 1. Verificación previa de idempotencia en DB
    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return {
        created: false,
        alreadyProcessed: true,
        notificationId: existing.id,
        type: existing.type,
        idempotencyKey,
      };
    }

    // 2. Construir textos amigables orientados al usuario sin datos internos de LLM
    const isTeacher = creditType === AICreditType.TEACHER;
    const bagName = isTeacher ? "Créditos de Profesor IA" : "Créditos para Estudiantes IA";

    let title = "";
    let message = "";

    switch (alertType) {
      case NotificationType.CREDIT_EXHAUSTED:
        title = `Tus ${bagName} se han agotado`;
        message = `Has utilizado el 100% de tus ${bagName} para este periodo. Por favor, actualiza tu plan para continuar generando contenido.`;
        break;
      case NotificationType.CREDIT_CRITICAL:
        title = `Nivel crítico en ${bagName} (90% usado)`;
        message = `Tus ${bagName} han alcanzado el 90% de su capacidad mensual. Te quedan ${availableCredits} créditos disponibles.`;
        break;
      case NotificationType.CREDIT_LOW:
        title = `Saldo bajo en ${bagName} (70% usado)`;
        message = `Has consumido el 70% de tus ${bagName}. Quedan ${availableCredits} créditos de ${monthlyAllowance} cr.`;
        break;
      case NotificationType.CREDIT_WARNING:
        title = `Aviso de consumo en ${bagName} (50% usado)`;
        message = `Has alcanzado el 50% de tu cuota mensual de ${bagName}. Mantenes ${availableCredits} cr disponibles.`;
        break;
    }

    try {
      const notification = await prisma.notification.create({
        data: {
          tenantId,
          userId: userId || null,
          type: alertType,
          creditType,
          title,
          message,
          idempotencyKey,
          metadata: {
            availableCredits,
            monthlyAllowance,
            usagePercentage,
            cycleYearMonth,
          },
        },
      });

      // Log estructurado (Simulación de envío por Email / Adapter)
      console.log(`[NOTIFICATION_EVENT] Created alert ${alertType} for tenant ${tenantId} (${bagName})`);

      return {
        created: true,
        alreadyProcessed: false,
        notificationId: notification.id,
        type: notification.type,
        idempotencyKey,
      };
    } catch (err: any) {
      if (err.code === "P2002") {
        const existingTx = await prisma.notification.findUnique({
          where: { idempotencyKey },
        });
        return {
          created: false,
          alreadyProcessed: true,
          notificationId: existingTx?.id,
          type: existingTx?.type,
          idempotencyKey,
        };
      }
      throw err;
    }
  }

  /**
   * Crea una notificación atómica cuando una operación fallida realiza una transacción de refund.
   */
  static async notifyRefund(
    tenantId: string,
    userId: string | undefined,
    creditType: AICreditType,
    amount: number,
    originalTxId: string
  ) {
    const idempotencyKey = `notify:${tenantId}:${creditType}:refund:${originalTxId}`;

    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    const bagName = creditType === AICreditType.TEACHER ? "Créditos de Profesor IA" : "Créditos para Estudiantes IA";
    const title = `Reembolso de ${amount} cr efectuado`;
    const message = `Se han restituido ${amount} créditos en tus ${bagName} debido a que la operación de IA no pudo completarse.`;

    try {
      return await prisma.notification.create({
        data: {
          tenantId,
          userId: userId || null,
          type: NotificationType.CREDIT_REFUNDED,
          creditType,
          title,
          message,
          idempotencyKey,
          metadata: {
            amount,
            originalTransactionId: originalTxId,
          },
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        return prisma.notification.findUnique({ where: { idempotencyKey } });
      }
      throw err;
    }
  }

  /**
   * Notificación atómica e idempotente de compra de paquete de créditos Top-Up.
   */
  static async notifyTopUpPurchased(
    tenantId: string,
    userId: string | undefined,
    creditType: AICreditType,
    creditsGranted: number,
    purchaseId: string
  ) {
    const idempotencyKey = `notify:${tenantId}:${creditType}:topup:${purchaseId}`;

    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    const bagName = creditType === AICreditType.TEACHER ? "Créditos de Profesor IA" : "Créditos para Estudiantes IA";
    const title = `Compra exitosa: +${creditsGranted} cr`;
    const message = `Se han acreditado +${creditsGranted} créditos adicionales en tus ${bagName}.`;

    try {
      return await prisma.notification.create({
        data: {
          tenantId,
          userId: userId || null,
          type: NotificationType.CREDIT_TOPUP_PURCHASED,
          creditType,
          title,
          message,
          idempotencyKey,
          metadata: {
            creditsGranted,
            purchaseId,
          },
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        return prisma.notification.findUnique({ where: { idempotencyKey } });
      }
      throw err;
    }
  }

  /**
   * Notificación atómica e idempotente de renovación mensual de créditos de IA.
   */
  static async notifyMonthlyReset(
    tenantId: string,
    userId: string | undefined,
    teacherGranted: number,
    teacherRollover: number,
    studentGranted: number,
    studentRollover: number,
    cycleDate: string
  ) {
    const tenantExists = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenantExists) return null;

    let validUserId: string | null = null;
    if (userId) {
      const uExists = await prisma.user.findUnique({ where: { id: userId } });
      if (uExists) validUserId = userId;
    }

    const idempotencyKey = `notify:${tenantId}:monthly_reset:${cycleDate}`;

    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return existing;
    }

    const title = "Cuota mensual de AI Credits renovada";
    const message = `Tus créditos de IA han sido renovados: +${teacherGranted} cr Profesor (+${teacherRollover} cr acumulados por rollover) y +${studentGranted} cr Estudiante (+${studentRollover} cr acumulados).`;

    try {
      return await prisma.notification.create({
        data: {
          tenantId,
          userId: validUserId,
          type: NotificationType.CREDIT_MONTHLY_RESET,
          creditType: AICreditType.TEACHER,
          title,
          message,
          idempotencyKey,
          metadata: {
            teacherGranted,
            teacherRollover,
            studentGranted,
            studentRollover,
            cycleDate,
          },
        },
      });
    } catch (err: any) {
      if (err.code === "P2002") {
        return prisma.notification.findUnique({ where: { idempotencyKey } });
      }
      if (err.code === "P2003") {
        return null;
      }
      throw err;
    }
  }

  /**
   * Obtiene las notificaciones de un tenant con filtro multi-tenant estricto y conteo no leído.
   */
  static async getTenantNotifications(tenantId: string, limit = 20) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error("TENANT_NOT_FOUND");
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { tenantId, read: false },
      }),
    ]);

    return {
      notifications,
      unreadCount,
    };
  }

  /**
   * Marca una notificación individual como leída.
   */
  static async markAsRead(tenantId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: {
        id: notificationId,
        tenantId,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Marca todas las notificaciones no leídas de un tenant como leídas.
   */
  static async markAllAsRead(tenantId: string) {
    return prisma.notification.updateMany({
      where: {
        tenantId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  }
}

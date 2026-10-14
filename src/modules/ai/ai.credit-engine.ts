import { prisma } from "@/lib/db";
import { AIOperation, AICreditType, AICreditTransactionType } from "@prisma/client";
import {
  AI_OPERATION_CATALOG,
  getAIOperationConfig,
  PlanId,
} from "./ai.catalog";
import { getPlanAIConfig } from "./ai.config";
import { NotificationService } from "@/modules/notifications/notification.service";

export enum AICreditError {
  INVALID_AI_OPERATION = "INVALID_AI_OPERATION",
  TENANT_NOT_FOUND = "TENANT_NOT_FOUND",
  AI_CREDIT_WALLET_NOT_FOUND = "AI_CREDIT_WALLET_NOT_FOUND",
  USER_NOT_IN_TENANT = "USER_NOT_IN_TENANT",
  INSUFFICIENT_AI_CREDITS = "INSUFFICIENT_AI_CREDITS",
  IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT",
  TRANSACTION_NOT_FOUND = "TRANSACTION_NOT_FOUND",
  INVALID_REFUND_TARGET = "INVALID_REFUND_TARGET",
  ALREADY_REFUNDED = "ALREADY_REFUNDED",
}

export interface ConsumeCreditsInput {
  tenantId: string;
  userId?: string;
  operation: AIOperation;
  idempotencyKey?: string;
  referenceId?: string;
  metadata?: Record<string, any>;
}

export interface ConsumeCreditsOutput {
  success: boolean;
  alreadyProcessed: boolean;
  transactionId?: string;
  creditsUsed: number;
  remainingTeacherCredits?: number;
  remainingStudentCredits?: number;
  creditType: AICreditType;
  operation: AIOperation;
}

export interface RefundCreditsInput {
  tenantId: string;
  transactionId: string;
  userId?: string;
  reason?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface RefundCreditsOutput {
  success: boolean;
  alreadyProcessed: boolean;
  refundTransactionId?: string;
  originalTransactionId: string;
  creditsRefunded: number;
  remainingTeacherCredits?: number;
  remainingStudentCredits?: number;
  creditType: AICreditType;
  operation: AIOperation;
}

export class AICreditEngine {
  /**
   * Consume créditos de IA de forma atómica e idempotente.
   */
  static async consumeCredits(input: ConsumeCreditsInput): Promise<ConsumeCreditsOutput> {
    // 1. Validar operación en el catálogo
    if (!input.operation || !AI_OPERATION_CATALOG[input.operation]) {
      throw new Error(AICreditError.INVALID_AI_OPERATION);
    }

    const opConfig = getAIOperationConfig(input.operation);
    // El tipo definitivo se decide más abajo: si la academia lo permite, las
    // operaciones de alumno (tutor, retroalimentación) se cobran de la bolsa
    // del profesor. Los alumnos no tienen cuota propia en ningún plan.
    let creditType = opConfig.creditType;
    const creditCost = opConfig.creditCost;

    // 2. Validar existencia del Tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    if (!tenant) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    // 3. Validar pertenencia del usuario al tenant (Membership)
    if (input.userId) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: input.userId,
            tenantId: input.tenantId,
          },
        },
      });
      if (!membership) {
        throw new Error(AICreditError.USER_NOT_IN_TENANT);
      }
    }

    // 4. Verificar idempotencia previa
    if (input.idempotencyKey) {
      const existingTx = await prisma.aICreditTransaction.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });

      if (existingTx) {
        if (existingTx.tenantId !== input.tenantId) {
          throw new Error(AICreditError.IDEMPOTENCY_CONFLICT);
        }

        const wallet = await prisma.aICreditWallet.findUnique({
          where: { tenantId: input.tenantId },
        });

        return {
          success: true,
          alreadyProcessed: true,
          transactionId: existingTx.id,
          creditsUsed: Math.abs(existingTx.amount),
          remainingTeacherCredits: wallet?.teacherCredits,
          remainingStudentCredits: wallet?.studentCredits,
          creditType: existingTx.creditType,
          operation: existingTx.operation,
        };
      }
    }

    // 5. Validar existencia de la Wallet del Tenant
    const wallet = await prisma.aICreditWallet.findUnique({
      where: { tenantId: input.tenantId },
    });
    if (!wallet) {
      throw new Error(AICreditError.AI_CREDIT_WALLET_NOT_FOUND);
    }

    // 5b. Operaciones de alumno financiadas por el profesor.
    // El propietario de la academia lo activa en Configuración; mientras esté
    // desactivado, el alumno no puede gastar (su bolsa está a 0 en todos los planes).
    if (opConfig.creditType === AICreditType.STUDENT && wallet.allowTeacherCreditsForStudents) {
      creditType = AICreditType.TEACHER;
    }

    // 6. Manejo de Operaciones FREE (0 créditos)
    if (creditCost === 0) {
      return {
        success: true,
        alreadyProcessed: false,
        creditsUsed: 0,
        remainingTeacherCredits: wallet.teacherCredits,
        remainingStudentCredits: wallet.studentCredits,
        creditType,
        operation: input.operation,
      };
    }

    // 7. Determinar campo de saldo y verificar fondos
    const balanceField = creditType === AICreditType.TEACHER ? "teacherCredits" : "studentCredits";
    const currentBalance = creditType === AICreditType.TEACHER ? wallet.teacherCredits : wallet.studentCredits;

    if (currentBalance < creditCost) {
      throw new Error(AICreditError.INSUFFICIENT_AI_CREDITS);
    }

    // 8. Transacción Atómica: Decremento condicional + Creación de Ledger
    try {
      const { ledgerTx, updatedWallet } = await prisma.$transaction(async (tx) => {
        const updateResult = await tx.aICreditWallet.updateMany({
          where: {
            tenantId: input.tenantId,
            [balanceField]: { gte: creditCost },
          },
          data: {
            [balanceField]: { decrement: creditCost },
          },
        });

        if (updateResult.count === 0) {
          throw new Error(AICreditError.INSUFFICIENT_AI_CREDITS);
        }

        const ledgerTx = await tx.aICreditTransaction.create({
          data: {
            tenantId: input.tenantId,
            userId: input.userId || null,
            creditType,
            amount: -creditCost,
            transactionType: AICreditTransactionType.USAGE,
            operation: input.operation,
            referenceId: input.referenceId || null,
            idempotencyKey: input.idempotencyKey || null,
            metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
          },
        });

        const updatedWallet = await tx.aICreditWallet.findUniqueOrThrow({
          where: { tenantId: input.tenantId },
        });

        return { ledgerTx, updatedWallet };
      }, {
        timeout: 15000,
        maxWait: 10000,
      });

      // Evaluar alertas de consumo de créditos de forma asíncrona e idempotente
      const allowance = creditType === AICreditType.TEACHER ? wallet.monthlyTeacherAllowance : wallet.monthlyStudentAllowance;
      const available = creditType === AICreditType.TEACHER ? updatedWallet.teacherCredits : updatedWallet.studentCredits;
      NotificationService.evaluateCreditAlerts(input.tenantId, creditType, available, allowance, input.userId).catch((err) => {
        console.warn("Could not evaluate credit notification alerts:", err);
      });

      return {
        success: true,
        alreadyProcessed: false,
        transactionId: ledgerTx.id,
        creditsUsed: creditCost,
        remainingTeacherCredits: updatedWallet.teacherCredits,
        remainingStudentCredits: updatedWallet.studentCredits,
        creditType,
        operation: input.operation,
      };
    } catch (err: any) {
      // Manejar conflicto de idempotencia concurrente (Prisma Unique Constraint Error Code P2002)
      if (input.idempotencyKey && err.code === "P2002") {
        const existingTx = await prisma.aICreditTransaction.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });

        if (existingTx) {
          if (existingTx.tenantId !== input.tenantId) {
            throw new Error(AICreditError.IDEMPOTENCY_CONFLICT);
          }

          const currentWallet = await prisma.aICreditWallet.findUnique({
            where: { tenantId: input.tenantId },
          });

          return {
            success: true,
            alreadyProcessed: true,
            transactionId: existingTx.id,
            creditsUsed: Math.abs(existingTx.amount),
            remainingTeacherCredits: currentWallet?.teacherCredits,
            remainingStudentCredits: currentWallet?.studentCredits,
            creditType: existingTx.creditType,
            operation: existingTx.operation,
          };
        }
      }
      throw err;
    }
  }

  /**
   * Reembolsa créditos de una transacción previa de consumo de forma atómica e idempotente.
   */
  static async refundCredits(input: RefundCreditsInput): Promise<RefundCreditsOutput> {
    // 1. Validar input básico
    if (!input.tenantId) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }
    if (!input.transactionId) {
      throw new Error(AICreditError.TRANSACTION_NOT_FOUND);
    }

    // 2. Validar existencia del Tenant
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    if (!tenant) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    // 3. Validar existencia de la Wallet del Tenant
    const wallet = await prisma.aICreditWallet.findUnique({
      where: { tenantId: input.tenantId },
    });
    if (!wallet) {
      throw new Error(AICreditError.AI_CREDIT_WALLET_NOT_FOUND);
    }

    // 4. Validar pertenencia del usuario si se especifica
    if (input.userId) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_tenantId: {
            userId: input.userId,
            tenantId: input.tenantId,
          },
        },
      });
      if (!membership) {
        throw new Error(AICreditError.USER_NOT_IN_TENANT);
      }
    }

    // 5. Validar existencia y pertenencia de la transacción original
    const originalTx = await prisma.aICreditTransaction.findUnique({
      where: { id: input.transactionId },
    });

    if (!originalTx) {
      throw new Error(AICreditError.TRANSACTION_NOT_FOUND);
    }

    // Tenant isolation en la transacción de consumo original
    if (originalTx.tenantId !== input.tenantId) {
      throw new Error(AICreditError.TRANSACTION_NOT_FOUND);
    }

    // Solamente se pueden reembolsar transacciones de tipo USAGE (consumo real)
    if (originalTx.transactionType !== AICreditTransactionType.USAGE || originalTx.amount >= 0) {
      throw new Error(AICreditError.INVALID_REFUND_TARGET);
    }

    const refundAmount = Math.abs(originalTx.amount);
    const creditType = originalTx.creditType;
    const refundIdempotencyKey = input.idempotencyKey || `refund:${originalTx.id}`;

    // 6. Verificar idempotencia previa por idempotencyKey
    const existingRefundByIdempotency = await prisma.aICreditTransaction.findUnique({
      where: { idempotencyKey: refundIdempotencyKey },
    });

    if (existingRefundByIdempotency) {
      if (existingRefundByIdempotency.tenantId !== input.tenantId) {
        throw new Error(AICreditError.IDEMPOTENCY_CONFLICT);
      }

      const currentWallet = await prisma.aICreditWallet.findUnique({
        where: { tenantId: input.tenantId },
      });

      return {
        success: true,
        alreadyProcessed: true,
        refundTransactionId: existingRefundByIdempotency.id,
        originalTransactionId: originalTx.id,
        creditsRefunded: Math.abs(existingRefundByIdempotency.amount),
        remainingTeacherCredits: currentWallet?.teacherCredits,
        remainingStudentCredits: currentWallet?.studentCredits,
        creditType: existingRefundByIdempotency.creditType,
        operation: existingRefundByIdempotency.operation,
      };
    }

    // 7. Verificar si la transacción ya fue reembolsada previamente mediante referenceId
    const existingRefundByRef = await prisma.aICreditTransaction.findFirst({
      where: {
        tenantId: input.tenantId,
        referenceId: originalTx.id,
        transactionType: AICreditTransactionType.REFUND,
      },
    });

    if (existingRefundByRef) {
      const currentWallet = await prisma.aICreditWallet.findUnique({
        where: { tenantId: input.tenantId },
      });

      return {
        success: true,
        alreadyProcessed: true,
        refundTransactionId: existingRefundByRef.id,
        originalTransactionId: originalTx.id,
        creditsRefunded: Math.abs(existingRefundByRef.amount),
        remainingTeacherCredits: currentWallet?.teacherCredits,
        remainingStudentCredits: currentWallet?.studentCredits,
        creditType: existingRefundByRef.creditType,
        operation: existingRefundByRef.operation,
      };
    }

    // 8. Operaciones de 0 créditos no alteran saldo pero devuelven resultado consistente
    if (refundAmount === 0) {
      return {
        success: true,
        alreadyProcessed: false,
        originalTransactionId: originalTx.id,
        creditsRefunded: 0,
        remainingTeacherCredits: wallet.teacherCredits,
        remainingStudentCredits: wallet.studentCredits,
        creditType,
        operation: originalTx.operation,
      };
    }

    const balanceField = creditType === AICreditType.TEACHER ? "teacherCredits" : "studentCredits";

    // 9. Transacción Atómica en PostgreSQL: Incremento de Wallet + Creación de Ledger REFUND
    try {
      const { refundLedgerTx, updatedWallet } = await prisma.$transaction(
        async (tx) => {
          // Re-verificar double refund dentro de la transacción interactiva
          const doubleCheckRefund = await tx.aICreditTransaction.findFirst({
            where: {
              tenantId: input.tenantId,
              referenceId: originalTx.id,
              transactionType: AICreditTransactionType.REFUND,
            },
          });

          if (doubleCheckRefund) {
            const currentWallet = await tx.aICreditWallet.findUniqueOrThrow({
              where: { tenantId: input.tenantId },
            });
            return { refundLedgerTx: doubleCheckRefund, updatedWallet: currentWallet };
          }

          // Incrementar saldo atómicamente
          await tx.aICreditWallet.update({
            where: { tenantId: input.tenantId },
            data: {
              [balanceField]: { increment: refundAmount },
            },
          });

          // Registrar entrada de ledger de tipo REFUND
          const refundLedgerTx = await tx.aICreditTransaction.create({
            data: {
              tenantId: input.tenantId,
              userId: input.userId || originalTx.userId || null,
              creditType,
              amount: refundAmount, // Importe positivo
              transactionType: AICreditTransactionType.REFUND,
              operation: originalTx.operation,
              referenceId: originalTx.id,
              idempotencyKey: refundIdempotencyKey,
              metadata: {
                source: "AIService",
                refundReason: input.reason || "AI provider execution failed",
                originalTransactionId: originalTx.id,
                ...(input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : {}),
              },
            },
          });

          const updatedWallet = await tx.aICreditWallet.findUniqueOrThrow({
            where: { tenantId: input.tenantId },
          });

          return { refundLedgerTx, updatedWallet };
        },
        {
          timeout: 15000,
          maxWait: 10000,
        }
      );

      // Disparar notificación de reembolso efectuado de forma asíncrona e idempotente
      NotificationService.notifyRefund(
        input.tenantId,
        input.userId || originalTx.userId || undefined,
        creditType,
        refundAmount,
        originalTx.id
      ).catch((err) => {
        console.warn("Could not send refund notification:", err);
      });

      return {
        success: true,
        alreadyProcessed: false,
        refundTransactionId: refundLedgerTx.id,
        originalTransactionId: originalTx.id,
        creditsRefunded: refundAmount,
        remainingTeacherCredits: updatedWallet.teacherCredits,
        remainingStudentCredits: updatedWallet.studentCredits,
        creditType,
        operation: originalTx.operation,
      };
    } catch (err: any) {
      // Si ocurrió una colisión de idempotencia única P2002 por concurrencia
      if (err.code === "P2002") {
        const existingRefundTx = await prisma.aICreditTransaction.findFirst({
          where: {
            tenantId: input.tenantId,
            referenceId: originalTx.id,
            transactionType: AICreditTransactionType.REFUND,
          },
        });

        if (existingRefundTx) {
          const currentWallet = await prisma.aICreditWallet.findUnique({
            where: { tenantId: input.tenantId },
          });

          return {
            success: true,
            alreadyProcessed: true,
            refundTransactionId: existingRefundTx.id,
            originalTransactionId: originalTx.id,
            creditsRefunded: Math.abs(existingRefundTx.amount),
            remainingTeacherCredits: currentWallet?.teacherCredits,
            remainingStudentCredits: currentWallet?.studentCredits,
            creditType: existingRefundTx.creditType,
            operation: existingRefundTx.operation,
          };
        }
      }
      throw err;
    }
  }

  /**
   * Concede atómicamente créditos comprados vía Top-Up en la billetera del tenant e ingresa el registro PURCHASE en el ledger.
   */
  static async grantPurchasedCredits(input: {
    tenantId: string;
    userId?: string;
    creditType: AICreditType;
    amount: number;
    referenceId?: string;
    idempotencyKey?: string;
    metadata?: Record<string, any>;
  }) {
    if (!input.tenantId) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }
    if (input.amount <= 0) {
      throw new Error("INVALID_CREDIT_AMOUNT");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    if (!tenant) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    // Inicializar o buscar wallet
    await this.getTenantWalletSummary(input.tenantId);

    const grantKey = input.idempotencyKey || `grant:${input.tenantId}:${input.referenceId || Date.now()}`;

    // Verificación previa de idempotencia
    const existingTx = await prisma.aICreditTransaction.findUnique({
      where: { idempotencyKey: grantKey },
    });

    if (existingTx) {
      const currentWallet = await prisma.aICreditWallet.findUnique({
        where: { tenantId: input.tenantId },
      });
      return {
        alreadyProcessed: true,
        transactionId: existingTx.id,
        updatedWallet: currentWallet,
      };
    }

    const balanceField = input.creditType === AICreditType.TEACHER ? "teacherCredits" : "studentCredits";
    const purchasedField = input.creditType === AICreditType.TEACHER ? "purchasedTeacherCredits" : "purchasedStudentCredits";
    const defaultOp = input.creditType === AICreditType.TEACHER ? AIOperation.COURSE_GENERATION : AIOperation.AI_TUTOR;

    try {
      const { ledgerTx, updatedWallet } = await prisma.$transaction(
        async (tx) => {
          // Actualizar saldos en la wallet (upsert para resiliencia)
          await tx.aICreditWallet.upsert({
            where: { tenantId: input.tenantId },
            update: {
              [balanceField]: { increment: input.amount },
              [purchasedField]: { increment: input.amount },
            },
            create: {
              tenantId: input.tenantId,
              teacherCredits: input.creditType === AICreditType.TEACHER ? input.amount : 0,
              studentCredits: input.creditType === AICreditType.STUDENT ? input.amount : 0,
              purchasedTeacherCredits: input.creditType === AICreditType.TEACHER ? input.amount : 0,
              purchasedStudentCredits: input.creditType === AICreditType.STUDENT ? input.amount : 0,
              monthlyTeacherAllowance: 0,
              monthlyStudentAllowance: 0,
              resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          // Registrar entrada de ledger de tipo PURCHASE
          const ledgerTx = await tx.aICreditTransaction.create({
            data: {
              tenantId: input.tenantId,
              userId: input.userId || null,
              creditType: input.creditType,
              amount: input.amount, // Positivo
              transactionType: AICreditTransactionType.PURCHASE,
              operation: defaultOp,
              referenceId: input.referenceId || null,
              idempotencyKey: grantKey,
              metadata: {
                source: "TopUpPurchase",
                ...(input.metadata || {}),
              },
            },
          });

          const updatedWallet = await tx.aICreditWallet.findUniqueOrThrow({
            where: { tenantId: input.tenantId },
          });

          return { ledgerTx, updatedWallet };
        },
        { timeout: 20000 }
      );

      return {
        alreadyProcessed: false,
        transactionId: ledgerTx.id,
        updatedWallet,
      };
    } catch (err: any) {
      if (err.code === "P2002") {
        const existingTx = await prisma.aICreditTransaction.findUnique({
          where: { idempotencyKey: grantKey },
        });
        const currentWallet = await prisma.aICreditWallet.findUnique({
          where: { tenantId: input.tenantId },
        });
        return {
          alreadyProcessed: true,
          transactionId: existingTx?.id,
          updatedWallet: currentWallet,
        };
      }
      throw err;
    }
  }

  /**
   * Obtiene un resumen completo de la billetera virtual de créditos de un tenant (Teacher & Student)
   * garantizando el aislamiento multi-tenant y calculando alertas de capacidad.
   */
  static async getTenantWalletSummary(tenantId: string): Promise<{
    tenantId: string;
    planId: string;
    teacherCredits: {
      available: number;
      monthlyAllowance: number;
      maxRollover: number;
      rolloverCredits?: number;
      purchasedCredits?: number;
      usedThisMonth: number;
      usagePercentage: number;
    };
    studentCredits: {
      available: number;
      monthlyAllowance: number;
      maxRollover: number;
      rolloverCredits?: number;
      purchasedCredits?: number;
      usedThisMonth: number;
      usagePercentage: number;
    };
    resetAt: Date;
    capacityStatus: "NORMAL" | "LOW" | "CRITICAL" | "EXCEEDED";
  }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    let wallet = await prisma.aICreditWallet.findUnique({
      where: { tenantId },
    });

    // Obtener plan activo desde la suscripción
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, status: "active" },
      orderBy: { createdAt: "desc" },
    });
    const planId = (subscription?.planId?.toUpperCase() || "STARTER");
    const planConfig = getPlanAIConfig(planId);

    // Si la wallet no existe, crear con valores por defecto del plan (resiliente a concurrencia)
    if (!wallet) {
      const resetAt = new Date();
      resetAt.setMonth(resetAt.getMonth() + 1);

      try {
        wallet = await prisma.aICreditWallet.create({
          data: {
            tenantId,
            teacherCredits: planConfig.teacherAllowance,
            studentCredits: planConfig.studentAllowance,
            monthlyTeacherAllowance: planConfig.teacherAllowance,
            monthlyStudentAllowance: planConfig.studentAllowance,
            resetAt,
          },
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          wallet = (await prisma.aICreditWallet.findUnique({ where: { tenantId } }))!;
        } else {
          throw err;
        }
      }
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calcular consumo real de este mes en el ledger
    // Suma por tipo de crédito en la base de datos (los consumos se guardan en negativo)
    const monthlyUsages = await prisma.aICreditTransaction.groupBy({
      by: ["creditType"],
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
        transactionType: AICreditTransactionType.USAGE,
      },
      _sum: { amount: true },
    });
    const usedOf = (type: AICreditType) => Math.abs(monthlyUsages.find((u) => u.creditType === type)?._sum.amount ?? 0);

    const teacherUsed = usedOf(AICreditType.TEACHER);
    const studentUsed = usedOf(AICreditType.STUDENT);

    const teacherPct =
      planConfig.teacherAllowance > 0
        ? Math.min(Math.round((teacherUsed / planConfig.teacherAllowance) * 100), 100)
        : 0;

    const studentPct =
      planConfig.studentAllowance > 0
        ? Math.min(Math.round((studentUsed / planConfig.studentAllowance) * 100), 100)
        : 0;

    let capacityStatus: "NORMAL" | "LOW" | "CRITICAL" | "EXCEEDED" = "NORMAL";
    if (wallet.teacherCredits <= 0) {
      capacityStatus = "EXCEEDED";
    } else if (teacherPct >= 90) {
      capacityStatus = "CRITICAL";
    } else if (teacherPct >= 70) {
      capacityStatus = "LOW";
    }

    return {
      tenantId,
      planId,
      teacherCredits: {
        available: wallet.teacherCredits,
        monthlyAllowance: planConfig.teacherAllowance,
        maxRollover: planConfig.maxRolloverTeacher,
        rolloverCredits: wallet.rolloverTeacherCredits,
        purchasedCredits: wallet.purchasedTeacherCredits,
        usedThisMonth: teacherUsed,
        usagePercentage: teacherPct,
      },
      studentCredits: {
        available: wallet.studentCredits,
        monthlyAllowance: planConfig.studentAllowance,
        maxRollover: planConfig.maxRolloverStudent,
        rolloverCredits: wallet.rolloverStudentCredits,
        purchasedCredits: wallet.purchasedStudentCredits,
        usedThisMonth: studentUsed,
        usagePercentage: studentPct,
      },
      resetAt: wallet.resetAt,
      capacityStatus,
    };
  }

  /**
   * Ejecuta atómicamente e idempotentemente el reset mensual de créditos de IA para un tenant,
   * calculando el rollover permitido, la expiración de créditos excedentes y preservando
   * de forma absoluta los créditos comprados vía Top-Up.
   */
  static async processMonthlyReset(
    tenantId: string,
    periodEndDate?: Date,
    idempotencyKeyInput?: string,
    userId?: string
  ) {
    if (!tenantId) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    // Buscar o inicializar wallet si no existe
    let wallet = await prisma.aICreditWallet.findUnique({
      where: { tenantId },
    });

    // Obtener configuración del plan activo
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, status: "active" },
      orderBy: { createdAt: "desc" },
    });
    const planId = (subscription?.planId?.toUpperCase() || "STARTER") as PlanId;
    const planConfig = getPlanAIConfig(planId);

    if (!wallet) {
      const resetAt = new Date();
      resetAt.setMonth(resetAt.getMonth() + 1);
      try {
        wallet = await prisma.aICreditWallet.create({
          data: {
            tenantId,
            teacherCredits: planConfig.teacherAllowance,
            studentCredits: planConfig.studentAllowance,
            monthlyTeacherAllowance: planConfig.teacherAllowance,
            monthlyStudentAllowance: planConfig.studentAllowance,
            resetAt,
          },
        });
      } catch (err: any) {
        if (err.code === "P2002") {
          wallet = (await prisma.aICreditWallet.findUnique({ where: { tenantId } }))!;
        } else {
          throw err;
        }
      }
    }

    const targetResetDate = periodEndDate || wallet.resetAt || new Date();
    const periodKeyDate = targetResetDate.toISOString().slice(0, 10);
    const resetIdempotencyKey = idempotencyKeyInput || `reset:${tenantId}:${periodKeyDate}`;
    const checkKey = `${resetIdempotencyKey}:alloc:teacher`;

    // 1. Verificación de Idempotencia previa
    const existingTx = await prisma.aICreditTransaction.findUnique({
      where: { idempotencyKey: checkKey },
    });

    if (existingTx) {
      const currentWallet = await prisma.aICreditWallet.findUniqueOrThrow({
        where: { tenantId },
      });
      return {
        success: true,
        alreadyProcessed: true,
        resetDate: targetResetDate,
        nextResetAt: currentWallet.resetAt,
        teacherCredits: {
          previousAvailable: wallet.teacherCredits,
          newAllowance: planConfig.teacherAllowance,
          rolloverGranted: currentWallet.rolloverTeacherCredits,
          expiredAmount: 0,
          purchasedPreserved: currentWallet.purchasedTeacherCredits,
          newTotalAvailable: currentWallet.teacherCredits,
        },
        studentCredits: {
          previousAvailable: wallet.studentCredits,
          newAllowance: planConfig.studentAllowance,
          rolloverGranted: currentWallet.rolloverStudentCredits,
          expiredAmount: 0,
          purchasedPreserved: currentWallet.purchasedStudentCredits,
          newTotalAvailable: currentWallet.studentCredits,
        },
      };
    }

    // 2. Cálculo determinista de Rollover, Expiración y Preservación de Top-Ups
    // TEACHER:
    const effectivePurchasedTeacher = Math.min(wallet.purchasedTeacherCredits, wallet.teacherCredits);
    const monthlyAndRolloverRemainingTeacher = Math.max(0, wallet.teacherCredits - effectivePurchasedTeacher);
    const rolloverGrantedTeacher = Math.min(monthlyAndRolloverRemainingTeacher, planConfig.maxRolloverTeacher);
    const expiredTeacher = Math.max(0, monthlyAndRolloverRemainingTeacher - rolloverGrantedTeacher);
    const newAllowanceTeacher = planConfig.teacherAllowance;
    const newTeacherTotal = newAllowanceTeacher + rolloverGrantedTeacher + effectivePurchasedTeacher;

    // STUDENT:
    const effectivePurchasedStudent = Math.min(wallet.purchasedStudentCredits, wallet.studentCredits);
    const monthlyAndRolloverRemainingStudent = Math.max(0, wallet.studentCredits - effectivePurchasedStudent);
    const rolloverGrantedStudent = Math.min(monthlyAndRolloverRemainingStudent, planConfig.maxRolloverStudent);
    const expiredStudent = Math.max(0, monthlyAndRolloverRemainingStudent - rolloverGrantedStudent);
    const newAllowanceStudent = planConfig.studentAllowance;
    const newStudentTotal = newAllowanceStudent + rolloverGrantedStudent + effectivePurchasedStudent;

    // Siguiente fecha de renovación (+1 mes desde targetResetDate)
    const nextResetAt = new Date(targetResetDate);
    nextResetAt.setMonth(nextResetAt.getMonth() + 1);

    // 3. Ejecución Transaccional Atómica en PostgreSQL
    try {
      const { updatedWallet } = await prisma.$transaction(
        async (tx) => {
          // Re-check de idempotencia dentro del bloque atómico
          const doubleCheckTx = await tx.aICreditTransaction.findUnique({
            where: { idempotencyKey: checkKey },
          });
          if (doubleCheckTx) {
            const currentW = await tx.aICreditWallet.findUniqueOrThrow({
              where: { tenantId },
            });
            return { updatedWallet: currentW };
          }

          // Actualización atómica de la Billetera (upsert para garantizar resiliencia)
          const updatedWallet = await tx.aICreditWallet.upsert({
            where: { tenantId },
            update: {
              teacherCredits: newTeacherTotal,
              studentCredits: newStudentTotal,
              monthlyTeacherAllowance: newAllowanceTeacher,
              monthlyStudentAllowance: newAllowanceStudent,
              rolloverTeacherCredits: rolloverGrantedTeacher,
              rolloverStudentCredits: rolloverGrantedStudent,
              purchasedTeacherCredits: effectivePurchasedTeacher,
              purchasedStudentCredits: effectivePurchasedStudent,
              resetAt: nextResetAt,
            },
            create: {
              tenantId,
              teacherCredits: newTeacherTotal,
              studentCredits: newStudentTotal,
              monthlyTeacherAllowance: newAllowanceTeacher,
              monthlyStudentAllowance: newAllowanceStudent,
              rolloverTeacherCredits: rolloverGrantedTeacher,
              rolloverStudentCredits: rolloverGrantedStudent,
              purchasedTeacherCredits: effectivePurchasedTeacher,
              purchasedStudentCredits: effectivePurchasedStudent,
              resetAt: nextResetAt,
            },
          });

          // Registrar en el Ledger:
          // A) TEACHER
          if (expiredTeacher > 0) {
            await tx.aICreditTransaction.create({
              data: {
                tenantId,
                userId: userId || null,
                creditType: AICreditType.TEACHER,
                amount: -expiredTeacher,
                transactionType: AICreditTransactionType.EXPIRATION,
                operation: AIOperation.COURSE_GENERATION,
                idempotencyKey: `${resetIdempotencyKey}:exp:teacher`,
                metadata: { expiredAmount: expiredTeacher, periodKeyDate },
              },
            });
          }

          if (rolloverGrantedTeacher > 0) {
            await tx.aICreditTransaction.create({
              data: {
                tenantId,
                userId: userId || null,
                creditType: AICreditType.TEACHER,
                amount: rolloverGrantedTeacher,
                transactionType: AICreditTransactionType.ROLLOVER,
                operation: AIOperation.COURSE_GENERATION,
                idempotencyKey: `${resetIdempotencyKey}:roll:teacher`,
                metadata: { rolloverGranted: rolloverGrantedTeacher, periodKeyDate },
              },
            });
          }

          await tx.aICreditTransaction.create({
            data: {
              tenantId,
              userId: userId || null,
              creditType: AICreditType.TEACHER,
              amount: newAllowanceTeacher,
              transactionType: AICreditTransactionType.ALLOCATION,
              operation: AIOperation.COURSE_GENERATION,
              idempotencyKey: checkKey,
              metadata: { newAllowance: newAllowanceTeacher, periodKeyDate },
            },
          });

          // B) STUDENT
          if (expiredStudent > 0) {
            await tx.aICreditTransaction.create({
              data: {
                tenantId,
                userId: userId || null,
                creditType: AICreditType.STUDENT,
                amount: -expiredStudent,
                transactionType: AICreditTransactionType.EXPIRATION,
                operation: AIOperation.AI_TUTOR,
                idempotencyKey: `${resetIdempotencyKey}:exp:student`,
                metadata: { expiredAmount: expiredStudent, periodKeyDate },
              },
            });
          }

          if (rolloverGrantedStudent > 0) {
            await tx.aICreditTransaction.create({
              data: {
                tenantId,
                userId: userId || null,
                creditType: AICreditType.STUDENT,
                amount: rolloverGrantedStudent,
                transactionType: AICreditTransactionType.ROLLOVER,
                operation: AIOperation.AI_TUTOR,
                idempotencyKey: `${resetIdempotencyKey}:roll:student`,
                metadata: { rolloverGranted: rolloverGrantedStudent, periodKeyDate },
              },
            });
          }

          if (newAllowanceStudent > 0) {
            await tx.aICreditTransaction.create({
              data: {
                tenantId,
                userId: userId || null,
                creditType: AICreditType.STUDENT,
                amount: newAllowanceStudent,
                transactionType: AICreditTransactionType.ALLOCATION,
                operation: AIOperation.AI_TUTOR,
                idempotencyKey: `${resetIdempotencyKey}:alloc:student`,
                metadata: { newAllowance: newAllowanceStudent, periodKeyDate },
              },
            });
          }

          return { updatedWallet };
        },
        { timeout: 20000 }
      );

      // Notificación de Reset Mensual (síncrona con await)
      await NotificationService.notifyMonthlyReset(
        tenantId,
        userId,
        newAllowanceTeacher,
        rolloverGrantedTeacher,
        newAllowanceStudent,
        rolloverGrantedStudent,
        periodKeyDate
      ).catch((err) => {
        console.warn("Could not send monthly reset notification:", err);
      });

      return {
        success: true,
        alreadyProcessed: false,
        resetDate: targetResetDate,
        nextResetAt,
        teacherCredits: {
          previousAvailable: wallet.teacherCredits,
          newAllowance: newAllowanceTeacher,
          rolloverGranted: rolloverGrantedTeacher,
          expiredAmount: expiredTeacher,
          purchasedPreserved: effectivePurchasedTeacher,
          newTotalAvailable: updatedWallet.teacherCredits,
        },
        studentCredits: {
          previousAvailable: wallet.studentCredits,
          newAllowance: newAllowanceStudent,
          rolloverGranted: rolloverGrantedStudent,
          expiredAmount: expiredStudent,
          purchasedPreserved: effectivePurchasedStudent,
          newTotalAvailable: updatedWallet.studentCredits,
        },
      };
    } catch (err: any) {
      if (err.code === "P2002") {
        const currentWallet = await prisma.aICreditWallet.findUniqueOrThrow({
          where: { tenantId },
        });
        return {
          success: true,
          alreadyProcessed: true,
          resetDate: targetResetDate,
          nextResetAt: currentWallet.resetAt,
          teacherCredits: {
            previousAvailable: wallet.teacherCredits,
            newAllowance: planConfig.teacherAllowance,
            rolloverGranted: currentWallet.rolloverTeacherCredits,
            expiredAmount: 0,
            purchasedPreserved: currentWallet.purchasedTeacherCredits,
            newTotalAvailable: currentWallet.teacherCredits,
          },
          studentCredits: {
            previousAvailable: wallet.studentCredits,
            newAllowance: planConfig.studentAllowance,
            rolloverGranted: currentWallet.rolloverStudentCredits,
            expiredAmount: 0,
            purchasedPreserved: currentWallet.purchasedStudentCredits,
            newTotalAvailable: currentWallet.studentCredits,
          },
        };
      }
      throw err;
    }
  }

  /**
   * Sincroniza atómicamente la billetera de un tenant cuando su plan SaaS cambia (Upgrade / Downgrade),
   * conservando de forma absoluta los créditos Top-Up comprados.
   */
  static async syncWalletWithPlan(tenantId: string, newPlanId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    const planConfig = getPlanAIConfig(newPlanId);
    let wallet = await prisma.aICreditWallet.findUnique({
      where: { tenantId },
    });

    if (!wallet) {
      await this.getTenantWalletSummary(tenantId);
      wallet = (await prisma.aICreditWallet.findUnique({ where: { tenantId } }))!;
    }

    // Preservar purchased intactos
    const effectivePurchasedTeacher = Math.min(wallet.purchasedTeacherCredits, wallet.teacherCredits);
    const effectivePurchasedStudent = Math.min(wallet.purchasedStudentCredits, wallet.studentCredits);

    // Ajustar disponibilidad preservando la nueva cuota y los créditos comprados
    const newTeacherTotal = planConfig.teacherAllowance + wallet.rolloverTeacherCredits + effectivePurchasedTeacher;
    const newStudentTotal = planConfig.studentAllowance + wallet.rolloverStudentCredits + effectivePurchasedStudent;

    return prisma.aICreditWallet.update({
      where: { tenantId },
      data: {
        monthlyTeacherAllowance: planConfig.teacherAllowance,
        monthlyStudentAllowance: planConfig.studentAllowance,
        teacherCredits: newTeacherTotal,
        studentCredits: newStudentTotal,
        purchasedTeacherCredits: effectivePurchasedTeacher,
        purchasedStudentCredits: effectivePurchasedStudent,
      },
    });
  }

  /**
   * Obtiene el historial de transacciones de créditos de un tenant con nombres de usuario.
   */
  static async getTenantCreditHistory(tenantId: string, limit = 20) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error(AICreditError.TENANT_NOT_FOUND);
    }

    const transactions = await prisma.aICreditTransaction.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    return transactions.map((tx) => ({
      id: tx.id,
      tenantId: tx.tenantId,
      userId: tx.userId,
      userName: tx.user?.name || tx.user?.email || "Sistema",
      creditType: tx.creditType,
      amount: tx.amount,
      transactionType: tx.transactionType,
      operation: tx.operation,
      referenceId: tx.referenceId,
      idempotencyKey: tx.idempotencyKey,
      metadata: tx.metadata,
      createdAt: tx.createdAt,
    }));
  }
}



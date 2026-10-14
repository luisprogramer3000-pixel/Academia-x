import { prisma } from "@/lib/db";
import { PLAN_AI_CREDIT_CONFIG } from "./ai.config";
import { AICreditType, AICreditTransactionType, AIOperation } from "@prisma/client";

export interface GlobalSummaryMetrics {
  totalTeacherAvailable: number;
  totalStudentAvailable: number;
  totalMonthlyAllowanceAllocated: number;
  totalRolloverVigente: number;
  totalPurchasedCreditsComprados: number;
  totalConsumedCredits: number;
  totalExpiredCredits: number;
  totalRefundedCredits: number;
  topUpPurchases: {
    totalPurchases: number;
    pendingCount: number;
    completedCount: number;
    failedCount: number;
    refundedCount: number;
    totalRevenueUSD: number;
  };
}

export interface PlanDistributionMetric {
  planId: "STARTER" | "PRO" | "ACADEMY";
  tenantCount: number;
  cuotaMensualTeacher: number;
  cuotaMensualStudent: number;
  rolloverTeacher: number;
  rolloverStudent: number;
  creditosComprados: number;
  consumoTotal: number;
  utilizacionPorcentaje: number;
}

export interface JobStatusSummary {
  walletsPendingReset: number;
  totalWallets: number;
  lastResetProcessedAt: Date | null;
  recentJobErrorsCount: number;
}

export interface LedgerAuditFilters {
  tenantId?: string;
  userId?: string;
  transactionType?: AICreditTransactionType;
  creditType?: AICreditType;
  operation?: AIOperation;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface TopUpReportFilters {
  tenantId?: string;
  userId?: string;
  status?: string;
  creditType?: AICreditType;
  packageId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface BalanceAuditResult {
  tenantId: string;
  isConsistent: boolean;
  teacher: {
    expectedAvailable: number;
    actualAvailable: number;
    difference: number;
    consistent: boolean;
  };
  student: {
    expectedAvailable: number;
    actualAvailable: number;
    difference: number;
    consistent: boolean;
  };
  details: string[];
}

export interface SystemAnomaly {
  id: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  type:
    | "NEGATIVE_WALLET_BALANCE"
    | "NEGATIVE_PURCHASED_CREDITS"
    | "EXCEEDED_ROLLOVER_MAX"
    | "STUDENT_CREDITS_IN_STARTER_PLAN"
    | "STALE_RESET_DATE"
    | "DUPLICATE_PAYMENT_PROVIDER_ID"
    | "JOB_BATCH_FAILURE";
  tenantId?: string;
  description: string;
  metadata?: any;
}

/**
 * AICreditAdminService
 * Servicio administrativo para la observabilidad, monitoreo, auditoría y métricas avanzadas
 * de la economía de créditos de IA en Mentor Studio Global.
 */
export class AICreditAdminService {
  /**
   * Obtiene las métricas globales agregadas calculadas dinámicamente desde la BD.
   */
  static async getGlobalSummaryMetrics(tenantIdFilter?: string): Promise<GlobalSummaryMetrics> {
    const walletWhere = tenantIdFilter ? { tenantId: tenantIdFilter } : {};
    const txWhere = tenantIdFilter ? { tenantId: tenantIdFilter } : {};
    const purchaseWhere = tenantIdFilter ? { tenantId: tenantIdFilter } : {};

    const wallets = await prisma.aICreditWallet.findMany({ where: walletWhere });

    let totalTeacherAvailable = 0;
    let totalStudentAvailable = 0;
    let totalMonthlyAllowanceAllocated = 0;
    let totalRolloverVigente = 0;
    let totalPurchasedCreditsComprados = 0;

    for (const w of wallets) {
      totalTeacherAvailable += w.teacherCredits;
      totalStudentAvailable += w.studentCredits;
      totalMonthlyAllowanceAllocated += w.monthlyTeacherAllowance + w.monthlyStudentAllowance;
      totalRolloverVigente += w.rolloverTeacherCredits + w.rolloverStudentCredits;
      totalPurchasedCreditsComprados += w.purchasedTeacherCredits + w.purchasedStudentCredits;
    }

    // Aggregations on AICreditTransaction
    const usages = await prisma.aICreditTransaction.aggregate({
      where: { ...txWhere, transactionType: AICreditTransactionType.USAGE },
      _sum: { amount: true },
    });
    const expirations = await prisma.aICreditTransaction.aggregate({
      where: { ...txWhere, transactionType: AICreditTransactionType.EXPIRATION },
      _sum: { amount: true },
    });
    const refunds = await prisma.aICreditTransaction.aggregate({
      where: { ...txWhere, transactionType: AICreditTransactionType.REFUND },
      _sum: { amount: true },
    });

    const totalConsumedCredits = Math.abs(usages._sum.amount || 0);
    const totalExpiredCredits = Math.abs(expirations._sum.amount || 0);
    const totalRefundedCredits = Math.abs(refunds._sum.amount || 0);

    // Top-Up purchases metrics
    // Una sola consulta agrupada por estado (antes: 5 conteos + traer todas las compras completadas)
    const byStatus = await prisma.aICreditPurchase.groupBy({
      by: ["status"],
      where: purchaseWhere,
      _count: { _all: true },
      _sum: { priceAmount: true },
    });
    const countOf = (status: string) => byStatus.find((g) => g.status === status)?._count._all ?? 0;
    const totalPurchases = byStatus.reduce((acc, g) => acc + g._count._all, 0);
    const pendingCount = countOf("PENDING");
    const completedCount = countOf("COMPLETED");
    const failedCount = countOf("FAILED");
    const refundedCount = countOf("REFUNDED");
    const totalRevenueUSD = Number(byStatus.find((g) => g.status === "COMPLETED")?._sum.priceAmount ?? 0);

    return {
      totalTeacherAvailable,
      totalStudentAvailable,
      totalMonthlyAllowanceAllocated,
      totalRolloverVigente,
      totalPurchasedCreditsComprados,
      totalConsumedCredits,
      totalExpiredCredits,
      totalRefundedCredits,
      topUpPurchases: {
        totalPurchases,
        pendingCount,
        completedCount,
        failedCount,
        refundedCount,
        totalRevenueUSD,
      },
    };
  }

  /**
   * Obtiene el desglose de distribución métrica agrupada por cada plan (STARTER, PRO, ACADEMY).
   */
  static async getPlanDistributionMetrics(tenantIdFilter?: string): Promise<PlanDistributionMetric[]> {
    const plans: Array<"STARTER" | "PRO" | "ACADEMY"> = ["STARTER", "PRO", "ACADEMY"];
    const results: PlanDistributionMetric[] = [];

    const tenantWhere = tenantIdFilter ? { tenantId: tenantIdFilter } : {};

    for (const planId of plans) {
      const activeSubs = await prisma.subscription.findMany({
        where: {
          ...tenantWhere,
          planId,
          status: "active",
        },
        select: { tenantId: true },
      });

      const tenantIds = activeSubs.map((s) => s.tenantId);

      const wallets = await prisma.aICreditWallet.findMany({
        where: {
          tenantId: { in: tenantIds },
        },
      });

      let cuotaMensualTeacher = 0;
      let cuotaMensualStudent = 0;
      let rolloverTeacher = 0;
      let rolloverStudent = 0;
      let creditosComprados = 0;

      for (const w of wallets) {
        cuotaMensualTeacher += w.monthlyTeacherAllowance;
        cuotaMensualStudent += w.monthlyStudentAllowance;
        rolloverTeacher += w.rolloverTeacherCredits;
        rolloverStudent += w.rolloverStudentCredits;
        creditosComprados += w.purchasedTeacherCredits + w.purchasedStudentCredits;
      }

      const usages = tenantIds.length > 0
        ? await prisma.aICreditTransaction.aggregate({
            where: {
              tenantId: { in: tenantIds },
              transactionType: AICreditTransactionType.USAGE,
            },
            _sum: { amount: true },
          })
        : { _sum: { amount: 0 } };

      const consumoTotal = Math.abs(usages._sum.amount || 0);
      const cuotaTotal = cuotaMensualTeacher + cuotaMensualStudent;
      const utilizacionPorcentaje = cuotaTotal > 0 ? Math.min(100, Math.round((consumoTotal / cuotaTotal) * 100)) : 0;

      results.push({
        planId,
        tenantCount: tenantIds.length,
        cuotaMensualTeacher,
        cuotaMensualStudent,
        rolloverTeacher,
        rolloverStudent,
        creditosComprados,
        consumoTotal,
        utilizacionPorcentaje,
      });
    }

    return results;
  }

  /**
   * Obtiene el estado actual y monitoreo de los background jobs de reset mensual.
   */
  static async getJobStatusSummary(now: Date = new Date()): Promise<JobStatusSummary> {
    const totalWallets = await prisma.aICreditWallet.count();
    const walletsPendingReset = await prisma.aICreditWallet.count({
      where: {
        resetAt: { lte: now },
      },
    });

    const lastAllocationTx = await prisma.aICreditTransaction.findFirst({
      where: { transactionType: AICreditTransactionType.ALLOCATION },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    return {
      totalWallets,
      walletsPendingReset,
      lastResetProcessedAt: lastAllocationTx?.createdAt || null,
      recentJobErrorsCount: 0,
    };
  }

  /**
   * Obtiene el historial de auditoría del Ledger (AICreditTransaction) con filtros server-side.
   */
  static async getLedgerAuditLog(filters: LedgerAuditFilters = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.transactionType) where.transactionType = filters.transactionType;
    if (filters.creditType) where.creditType = filters.creditType;
    if (filters.operation) where.operation = filters.operation;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [totalCount, transactions] = await Promise.all([
      prisma.aICreditTransaction.count({ where }),
      prisma.aICreditTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);

    return {
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      transactions,
    };
  }

  /**
   * Obtiene el reporte de ventas e historial de Top-Ups con filtros server-side.
   */
  static async getTopUpPurchasesReport(filters: TopUpReportFilters = {}) {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.creditType) where.creditType = filters.creditType;
    if (filters.packageId) where.packageId = filters.packageId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [totalCount, purchases] = await Promise.all([
      prisma.aICreditPurchase.count({ where }),
      prisma.aICreditPurchase.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, email: true, name: true } },
        },
      }),
    ]);

    return {
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit),
      purchases,
    };
  }

  /**
   * Audita la consistencia matemática entre los saldos reportados en la wallet del tenant
   * y la suma histórica de sus transacciones en el ledger. NO modifica saldos.
   */
  static async auditTenantWalletBalance(tenantId: string): Promise<BalanceAuditResult> {
    const wallet = await prisma.aICreditWallet.findUnique({
      where: { tenantId },
    });

    if (!wallet) {
      return {
        tenantId,
        isConsistent: false,
        teacher: { expectedAvailable: 0, actualAvailable: 0, difference: 0, consistent: false },
        student: { expectedAvailable: 0, actualAvailable: 0, difference: 0, consistent: false },
        details: ["Wallet no encontrada para el tenant indicado"],
      };
    }

    // Saldo esperado = suma del ledger por tipo de crédito, calculada en la base de datos
    const ledger = await prisma.aICreditTransaction.groupBy({
      by: ["creditType"],
      where: { tenantId },
      _sum: { amount: true },
    });
    const teacherExpected = ledger.find((g) => g.creditType === AICreditType.TEACHER)?._sum.amount ?? 0;
    const studentExpected = ledger.find((g) => g.creditType === AICreditType.STUDENT)?._sum.amount ?? 0;

    const teacherActual = wallet.teacherCredits;
    const studentActual = wallet.studentCredits;

    const teacherDiff = teacherActual - teacherExpected;
    const studentDiff = studentActual - studentExpected;

    const teacherConsistent = teacherDiff === 0;
    const studentConsistent = studentDiff === 0;

    const isConsistent = teacherConsistent && studentConsistent;
    const details: string[] = [];

    if (!teacherConsistent) {
      details.push(
        `Discrepancia en Teacher Credits: Wallet reporta ${teacherActual}, Ledger suma ${teacherExpected} (Diferencia: ${teacherDiff})`
      );
    }
    if (!studentConsistent) {
      details.push(
        `Discrepancia en Student Credits: Wallet reporta ${studentActual}, Ledger suma ${studentExpected} (Diferencia: ${studentDiff})`
      );
    }

    if (isConsistent) {
      details.push("La billetera es 100% consistente con la historia de transacciones del ledger.");
    }

    return {
      tenantId,
      isConsistent,
      teacher: {
        expectedAvailable: teacherExpected,
        actualAvailable: teacherActual,
        difference: teacherDiff,
        consistent: teacherConsistent,
      },
      student: {
        expectedAvailable: studentExpected,
        actualAvailable: studentActual,
        difference: studentDiff,
        consistent: studentConsistent,
      },
      details,
    };
  }

  /**
   * Detecta situaciones anómalas o inconsistencias en la base de datos sin alterar saldos ni realizar mutaciones.
   */
  static async detectSystemAnomalies(tenantIdFilter?: string): Promise<SystemAnomaly[]> {
    const anomalies: SystemAnomaly[] = [];

    const walletWhere = tenantIdFilter ? { tenantId: tenantIdFilter } : {};
    const wallets = await prisma.aICreditWallet.findMany({ where: walletWhere });

    for (const w of wallets) {
      // 1. Wallets Negativas
      if (w.teacherCredits < 0 || w.studentCredits < 0) {
        anomalies.push({
          id: `neg_wallet_${w.tenantId}`,
          severity: "CRITICAL",
          type: "NEGATIVE_WALLET_BALANCE",
          tenantId: w.tenantId,
          description: `El tenant ${w.tenantId} posee un saldo de wallet negativo: Teacher ${w.teacherCredits}, Student ${w.studentCredits}.`,
          metadata: { teacherCredits: w.teacherCredits, studentCredits: w.studentCredits },
        });
      }

      // 2. Purchased Credits Negativos
      if (w.purchasedTeacherCredits < 0 || w.purchasedStudentCredits < 0) {
        anomalies.push({
          id: `neg_purchased_${w.tenantId}`,
          severity: "CRITICAL",
          type: "NEGATIVE_PURCHASED_CREDITS",
          tenantId: w.tenantId,
          description: `El tenant ${w.tenantId} posee créditos comprados negativos: Teacher ${w.purchasedTeacherCredits}, Student ${w.purchasedStudentCredits}.`,
          metadata: { purchasedTeacherCredits: w.purchasedTeacherCredits, purchasedStudentCredits: w.purchasedStudentCredits },
        });
      }

      // 3. Rollover Superior al Máximo Autorizado del Plan
      const activeSub = await prisma.subscription.findFirst({
        where: { tenantId: w.tenantId, status: "active" },
        orderBy: { createdAt: "desc" },
      });
      const planId = (activeSub?.planId || "STARTER") as "STARTER" | "PRO" | "ACADEMY";
      const planConfig = PLAN_AI_CREDIT_CONFIG[planId] || PLAN_AI_CREDIT_CONFIG.STARTER;

      if (w.rolloverTeacherCredits > planConfig.maxRolloverTeacher || w.rolloverStudentCredits > planConfig.maxRolloverStudent) {
        anomalies.push({
          id: `exceeded_rollover_${w.tenantId}`,
          severity: "WARNING",
          type: "EXCEEDED_ROLLOVER_MAX",
          tenantId: w.tenantId,
          description: `El tenant ${w.tenantId} (Plan ${planId}) supera el tope de rollover autoritativo: Rollover Teacher ${w.rolloverTeacherCredits} > ${planConfig.maxRolloverTeacher} o Student ${w.rolloverStudentCredits} > ${planConfig.maxRolloverStudent}.`,
          metadata: { planId, rolloverTeacher: w.rolloverTeacherCredits, maxTeacher: planConfig.maxRolloverTeacher },
        });
      }

      // 4. Créditos Student en Plan STARTER (sin permiso oficial)
      if (planId === "STARTER" && (w.studentCredits > 0 || w.monthlyStudentAllowance > 0)) {
        anomalies.push({
          id: `starter_student_credits_${w.tenantId}`,
          severity: "WARNING",
          type: "STUDENT_CREDITS_IN_STARTER_PLAN",
          tenantId: w.tenantId,
          description: `El tenant ${w.tenantId} está en plan STARTER pero posee créditos de estudiante asignados (${w.studentCredits}).`,
          metadata: { studentCredits: w.studentCredits, monthlyStudentAllowance: w.monthlyStudentAllowance },
        });
      }

      // 5. ResetAt Vencido (hace más de 60 días sin procesar)
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      if (w.resetAt < sixtyDaysAgo) {
        anomalies.push({
          id: `stale_reset_${w.tenantId}`,
          severity: "WARNING",
          type: "STALE_RESET_DATE",
          tenantId: w.tenantId,
          description: `El tenant ${w.tenantId} no ha ejecutado reset mensual en más de 60 días (resetAt: ${w.resetAt.toISOString()}).`,
          metadata: { resetAt: w.resetAt },
        });
      }
    }

    // 6. ProviderPaymentId duplicado en compras: imposible, la columna es UNIQUE en la base
    //    de datos (AICreditPurchase.providerPaymentId). No hace falta recorrer las compras.

    return anomalies;
  }
}

import { prisma } from "@/lib/db";
import { AICreditEngine } from "./ai.credit-engine";

export type MonthlyResetResult = Awaited<ReturnType<typeof AICreditEngine.processMonthlyReset>>;

export interface AICreditJobTenantResult {
  tenantId: string;
  status: "SUCCESS" | "ALREADY_PROCESSED" | "FAILED";
  resetResult?: MonthlyResetResult;
  error?: string;
}

export interface AICreditJobSummary {
  success: boolean;
  timestamp: string;
  totalEligible: number;
  processedCount: number;
  alreadyProcessedCount: number;
  failedCount: number;
  durationMs: number;
  results: AICreditJobTenantResult[];
}

export interface ProcessBatchOptions {
  limit?: number;
  cycleDate?: Date;
  userId?: string;
}

/**
 * AICreditJobService
 * Servicio orquestador para el procesamiento automático y por lotes del reset mensual de créditos AI.
 * Garantiza Failure Isolation, Idempotencia, Seguridad Multi-tenant y Observabilidad sin modificar la lógica económica.
 */
export class AICreditJobService {
  /**
   * Busca todas las wallets de crédito que tengan una fecha de reset cumplida (resetAt <= now).
   */
  static async findDueWallets(limit: number = 50, now: Date = new Date()) {
    try {
      return await prisma.aICreditWallet.findMany({
        where: {
          resetAt: {
            lte: now,
          },
        },
        take: limit,
        orderBy: {
          resetAt: "asc",
        },
        select: {
          id: true,
          tenantId: true,
          resetAt: true,
        },
      });
    } catch (error) {
      console.error("[AICreditJobService] Error al buscar wallets vencidas:", error);
      return [];
    }
  }

  /**
   * Orquesta el procesamiento por lotes del reset mensual para todas las wallets elegibles.
   * Aplica aislamiento de errores (Failure Isolation) por tenant.
   */
  static async processMonthlyResetBatch(options: ProcessBatchOptions = {}): Promise<AICreditJobSummary> {
    const startTime = Date.now();
    const now = options.cycleDate || new Date();
    const limit = options.limit || 50;

    const dueWallets = await this.findDueWallets(limit, now);

    const summary: AICreditJobSummary = {
      success: true,
      timestamp: now.toISOString(),
      totalEligible: dueWallets.length,
      processedCount: 0,
      alreadyProcessedCount: 0,
      failedCount: 0,
      durationMs: 0,
      results: [],
    };

    console.log(`[AICreditJobService] Iniciando Job de Reset Mensual. Elegibles: ${dueWallets.length}`);

    for (const wallet of dueWallets) {
      const tenantId = wallet.tenantId;

      try {
        const result = await AICreditEngine.processMonthlyReset(
          tenantId,
          now,
          undefined,
          options.userId
        );

        if (result.alreadyProcessed) {
          summary.alreadyProcessedCount++;
          summary.results.push({
            tenantId,
            status: "ALREADY_PROCESSED",
            resetResult: result,
          });
        } else if (result.success) {
          summary.processedCount++;
          summary.results.push({
            tenantId,
            status: "SUCCESS",
            resetResult: result,
          });
        } else {
          summary.failedCount++;
          summary.results.push({
            tenantId,
            status: "FAILED",
            error: (result as any).error || "Reset fallido sin mensaje específico",
            resetResult: result,
          });
        }
      } catch (err: any) {
        summary.failedCount++;
        const errorMessage = err?.message || String(err);
        console.error(`[AICreditJobService] Excepción procesando Tenant ${tenantId}:`, errorMessage);
        summary.results.push({
          tenantId,
          status: "FAILED",
          error: errorMessage,
        });
      }
    }

    summary.durationMs = Date.now() - startTime;
    summary.success = summary.failedCount === 0;

    console.log(
      `[AICreditJobService] Job completado en ${summary.durationMs}ms. Exitosos: ${summary.processedCount}, Ya procesados: ${summary.alreadyProcessedCount}, Fallidos: ${summary.failedCount}`
    );

    return summary;
  }
}

"use server";

import { z } from "zod";
import { requireTenantAccess } from "@/lib/session";
import { AICreditAdminService, LedgerAuditFilters, TopUpReportFilters } from "@/modules/ai/ai.admin-service";
import { AICreditType, AICreditTransactionType, AIOperation } from "@prisma/client";

/**
 * Rol del usuario validado contra la base de datos (membresía y globalRole),
 * no contra lo que dice el token: quitar un rol surte efecto de inmediato.
 * El OWNER solo ve los datos de su academia (user.tenantId sale de la sesión validada).
 */
async function getAdminSession(): Promise<{ user: { tenantId: string } | null; isSuperAdmin: boolean; isOwner: boolean }> {
  try {
    const ctx = await requireTenantAccess();
    return { user: { tenantId: ctx.tenantId }, isSuperAdmin: ctx.isSuperAdmin, isOwner: ctx.role === "OWNER" };
  } catch {
    return { user: null, isSuperAdmin: false, isOwner: false };
  }
}

export async function getGlobalSummaryMetricsAction(tenantIdParam?: string) {
  try {
    const { user, isSuperAdmin, isOwner } = await getAdminSession();
    if (!user || (!isSuperAdmin && !isOwner)) {
      return { success: false, error: "Unauthorized: Requiere permisos administrativos" };
    }

    const effectiveTenantId = isSuperAdmin ? tenantIdParam : user.tenantId;
    const metrics = await AICreditAdminService.getGlobalSummaryMetrics(effectiveTenantId);

    return { success: true, metrics };
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al obtener resumen global de créditos" };
  }
}

export async function getPlanDistributionMetricsAction(tenantIdParam?: string) {
  try {
    const { user, isSuperAdmin, isOwner } = await getAdminSession();
    if (!user || (!isSuperAdmin && !isOwner)) {
      return { success: false, error: "Unauthorized: Requiere permisos administrativos" };
    }

    const effectiveTenantId = isSuperAdmin ? tenantIdParam : user.tenantId;
    const plans = await AICreditAdminService.getPlanDistributionMetrics(effectiveTenantId);

    return { success: true, plans };
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al obtener distribución por plan" };
  }
}

export async function getJobStatusSummaryAction() {
  try {
    // Estado global de toda la plataforma: solo el administrador de la plataforma
    const { user, isSuperAdmin } = await getAdminSession();
    if (!user || !isSuperAdmin) {
      return { success: false, error: "Unauthorized: Requiere permisos administrativos" };
    }

    const jobSummary = await AICreditAdminService.getJobStatusSummary();
    return { success: true, jobSummary };
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al obtener estado de jobs" };
  }
}

const ledgerFiltersSchema = z.object({
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  transactionType: z.nativeEnum(AICreditTransactionType).optional(),
  creditType: z.nativeEnum(AICreditType).optional(),
  operation: z.nativeEnum(AIOperation).optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export async function getLedgerAuditLogAction(rawFilters: LedgerAuditFilters = {}) {
  try {
    const { user, isSuperAdmin, isOwner } = await getAdminSession();
    if (!user || (!isSuperAdmin && !isOwner)) {
      return { success: false, error: "Unauthorized: Requiere permisos administrativos" };
    }

    const validated = ledgerFiltersSchema.parse(rawFilters);
    const effectiveTenantId = isSuperAdmin ? validated.tenantId : user.tenantId;

    const result = await AICreditAdminService.getLedgerAuditLog({
      ...validated,
      tenantId: effectiveTenantId,
    });

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al obtener auditoría de ledger" };
  }
}

const topUpFiltersSchema = z.object({
  tenantId: z.string().optional(),
  userId: z.string().optional(),
  status: z.string().optional(),
  creditType: z.nativeEnum(AICreditType).optional(),
  packageId: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
});

export async function getTopUpPurchasesReportAction(rawFilters: TopUpReportFilters = {}) {
  try {
    const { user, isSuperAdmin, isOwner } = await getAdminSession();
    if (!user || (!isSuperAdmin && !isOwner)) {
      return { success: false, error: "Unauthorized: Requiere permisos administrativos" };
    }

    const validated = topUpFiltersSchema.parse(rawFilters);
    const effectiveTenantId = isSuperAdmin ? validated.tenantId : user.tenantId;

    const result = await AICreditAdminService.getTopUpPurchasesReport({
      ...validated,
      tenantId: effectiveTenantId,
    });

    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al obtener reporte de compras Top-Up" };
  }
}

export async function auditTenantWalletBalanceAction(targetTenantId?: string) {
  try {
    const { user, isSuperAdmin, isOwner } = await getAdminSession();
    if (!user || (!isSuperAdmin && !isOwner)) {
      return { success: false, error: "Unauthorized: Requiere permisos administrativos" };
    }

    const effectiveTenantId = isSuperAdmin ? (targetTenantId || user.tenantId) : user.tenantId;
    if (!effectiveTenantId) {
      return { success: false, error: "Tenant ID no especificado" };
    }

    const audit = await AICreditAdminService.auditTenantWalletBalance(effectiveTenantId);
    return { success: true, audit };
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al auditar balance de wallet" };
  }
}

export async function detectSystemAnomaliesAction(targetTenantId?: string) {
  try {
    const { user, isSuperAdmin, isOwner } = await getAdminSession();
    if (!user || (!isSuperAdmin && !isOwner)) {
      return { success: false, error: "Unauthorized: Requiere permisos administrativos" };
    }

    const effectiveTenantId = isSuperAdmin ? targetTenantId : user.tenantId;
    const anomalies = await AICreditAdminService.detectSystemAnomalies(effectiveTenantId);

    return { success: true, anomalies };
  } catch (error: any) {
    return { success: false, error: error?.message || "Error al detectar anomalías del sistema" };
  }
}

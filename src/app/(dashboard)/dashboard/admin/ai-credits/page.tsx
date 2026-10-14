import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { redirect } from "next/navigation";
import { AICreditAdminService } from "@/modules/ai/ai.admin-service";
import {
  ShieldAlert,
  BarChart3,
  Layers,
  Activity,
  ShoppingBag,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Cpu,
} from "lucide-react";

export default async function AdminAICreditsDashboardPage() {
  const ctx = await getDashboardContext(OWNER_ONLY, { requirePlan: false });
  if (!ctx.isSuperAdmin) redirect("/dashboard");
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  // Real DB Data Aggregations
  const globalSummary = await AICreditAdminService.getGlobalSummaryMetrics();
  const planDistribution = await AICreditAdminService.getPlanDistributionMetrics();
  const jobSummary = await AICreditAdminService.getJobStatusSummary();
  const ledgerAudit = await AICreditAdminService.getLedgerAuditLog({ limit: 10 });
  const topUpReport = await AICreditAdminService.getTopUpPurchasesReport({ limit: 10 });
  const anomalies = await AICreditAdminService.detectSystemAnomalies();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-400" /> Administración & Observabilidad Económica de IA
            </h1>
            <p className="text-slate-400 text-sm">
              Consola global FinOps para supervisión de créditos, monitoreo de background jobs, distribución por plan y auditoría de ledger.
            </p>
          </div>

          {/* Section 1: Global Economic Summary */}
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Teacher Credits Disponibles</span>
              <div className="text-2xl font-extrabold text-blue-400">{globalSummary.totalTeacherAvailable.toLocaleString()}</div>
              <span className="text-xs text-slate-500 mt-1 block">En todas las wallets de docentes</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Student Credits Disponibles</span>
              <div className="text-2xl font-extrabold text-purple-400">{globalSummary.totalStudentAvailable.toLocaleString()}</div>
              <span className="text-xs text-slate-500 mt-1 block">En todas las wallets de estudiantes</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Créditos Top-Up Comprados</span>
              <div className="text-2xl font-extrabold text-emerald-400">{globalSummary.totalPurchasedCreditsComprados.toLocaleString()}</div>
              <span className="text-xs text-slate-500 mt-1 block">Ingresos: ${globalSummary.topUpPurchases.totalRevenueUSD.toLocaleString()} USD</span>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Consumo Total Acumulado</span>
              <div className="text-2xl font-extrabold text-amber-400">{globalSummary.totalConsumedCredits.toLocaleString()}</div>
              <span className="text-xs text-slate-500 mt-1 block">Expirados: {globalSummary.totalExpiredCredits.toLocaleString()}</span>
            </div>
          </div>

          {/* Section 2: Distribution by Plan */}
          <div className="mb-8 p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" /> Distribución de Economía por Plan (Datos Reales)
            </h2>

            <div className="grid md:grid-cols-3 gap-6">
              {planDistribution.map((p) => (
                <div key={p.planId} className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-white uppercase">{p.planId}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {p.tenantCount} Tenants
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300 mb-4">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cuota Teacher:</span>
                        <span className="font-mono font-semibold">{p.cuotaMensualTeacher}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Cuota Student:</span>
                        <span className="font-mono font-semibold">{p.cuotaMensualStudent}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Rollover Vigente:</span>
                        <span className="font-mono font-semibold text-amber-400">{p.rolloverTeacher + p.rolloverStudent}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Comprados (Top-Up):</span>
                        <span className="font-mono font-semibold text-emerald-400">{p.creditosComprados}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Utilización</span>
                      <span>{p.utilizacionPorcentaje}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                        style={{ width: `${p.utilizacionPorcentaje}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Background Job Engine Status & Anomalies */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Background Job Status */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" /> Estado de Background Jobs & Reset Mensual
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                  <span className="text-slate-400">Total Wallets Registradas</span>
                  <span className="font-mono font-bold text-white">{jobSummary.totalWallets}</span>
                </div>

                <div className="flex justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                  <span className="text-slate-400">Wallets Pendientes de Reset</span>
                  <span className={`font-mono font-bold ${jobSummary.walletsPendingReset > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                    {jobSummary.walletsPendingReset}
                  </span>
                </div>

                <div className="flex justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                  <span className="text-slate-400">Último Reset Procesado</span>
                  <span className="font-mono text-xs text-slate-300">
                    {jobSummary.lastResetProcessedAt ? new Date(jobSummary.lastResetProcessedAt).toLocaleString() : "Sin historial reciente"}
                  </span>
                </div>
              </div>
            </div>

            {/* Anomalies & Health Warnings */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" /> Monitor de Anomalías & Alertas de Salud
              </h2>

              {anomalies.length === 0 ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Sistema 100% saludable. No se detectaron inconsistencias de balance ni anomalías en wallets.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {anomalies.map((a) => (
                    <div
                      key={a.id}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        a.severity === "CRITICAL"
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                          : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      }`}
                    >
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block mb-0.5">{a.type}</strong>
                        <span>{a.description}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Immutable Ledger Audit Log Table */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" /> Auditoría de Ledger Inmutable (AICreditTransaction)
              </h2>
              <span className="text-xs text-slate-400 font-mono">Lectura Directa de DB (Inmutable)</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Tenant</th>
                    <th className="p-3">Tipo Transacción</th>
                    <th className="p-3">Bolsa</th>
                    <th className="p-3">Monto</th>
                    <th className="p-3">Idempotency Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                  {ledgerAudit.transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-850">
                      <td className="p-3 text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="p-3 text-white font-semibold">{tx.tenant?.name || tx.tenantId}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.transactionType === "ALLOCATION"
                              ? "bg-blue-500/20 text-blue-400"
                              : tx.transactionType === "USAGE"
                              ? "bg-amber-500/20 text-amber-400"
                              : tx.transactionType === "ROLLOVER"
                              ? "bg-purple-500/20 text-purple-400"
                              : tx.transactionType === "EXPIRATION"
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="p-3">{tx.creditType}</td>
                      <td className={`p-3 font-bold ${tx.amount > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </td>
                      <td className="p-3 text-slate-500 truncate max-w-xs">{tx.idempotencyKey || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

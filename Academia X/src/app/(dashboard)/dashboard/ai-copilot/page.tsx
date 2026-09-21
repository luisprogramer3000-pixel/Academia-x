import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { AICopilotForm } from "@/components/dashboard/AICopilotForm";
import { AICreditDashboardView } from "@/components/dashboard/AICreditDashboardView";
import { AICreditHistoryTable } from "@/components/dashboard/AICreditHistoryTable";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { Sparkles, AlertCircle } from "lucide-react";

export default async function AICopilotPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  const walletSummary = await AICreditEngine.getTenantWalletSummary(tenantId);
  const historyRecords = await AICreditEngine.getTenantCreditHistory(tenantId, 15);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-5xl space-y-8">
          {/* Header Banner */}
          <div className="p-8 rounded-3xl bg-gradient-to-r from-indigo-900/40 via-blue-900/30 to-slate-900 border border-indigo-500/30 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-wider">
                Generador Pedagógico IA
              </span>
            </div>

            <h1 className="text-3xl font-extrabold text-white mb-2">Copiloto IA de Creación de Cursos</h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              Transforma una idea o tema de enseñanza en un plan de estudios completo estructurado en módulos y lecciones en segundos.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/60 border border-slate-800 text-slate-400 text-xs font-mono">
              <AlertCircle className="w-3.5 h-3.5 text-blue-400" /> Regla de Calidad: AI → Review → Approve → Publish
            </div>
          </div>

          {/* AI Credit Wallet Dashboard View */}
          <AICreditDashboardView
            tenantId={tenantId}
            planId={walletSummary.planId}
            teacherCredits={walletSummary.teacherCredits}
            studentCredits={walletSummary.studentCredits}
            resetAt={walletSummary.resetAt}
            capacityStatus={walletSummary.capacityStatus}
          />

          {/* Generator Form Card */}
          <AICopilotForm
            tenantId={tenantId}
            tenantSlug={tenantSlug}
            isExceeded={walletSummary.capacityStatus === "EXCEEDED"}
            availableTeacherCredits={walletSummary.teacherCredits.available}
          />

          {/* Transaction Ledger History Table */}
          <AICreditHistoryTable transactions={historyRecords} />
        </main>
      </div>
    </div>
  );
}


// Las Server Actions de IA pueden tardar (generación de cursos): ampliar el límite de la función serverless
export const maxDuration = 60;

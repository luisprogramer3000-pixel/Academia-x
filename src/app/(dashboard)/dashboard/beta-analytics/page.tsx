import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { redirect } from "next/navigation";
import { BetaLaunchService } from "@/modules/academy/beta-launch.service";
import { seedJLGlobalAction } from "@/app/actions/beta.actions";
import { Rocket, Target, Users, BookOpen, Sparkles, CheckCircle2, RefreshCw } from "lucide-react";

export default async function BetaAnalyticsDashboardPage() {
  const ctx = await getDashboardContext(OWNER_ONLY, { requirePlan: false });
  if (!ctx.isSuperAdmin) redirect("/dashboard");
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  const betaStats = await BetaLaunchService.getBetaAnalytics();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-5xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
                <Rocket className="w-7 h-7 text-blue-400" /> Analíticas del Lanzamiento Beta
              </h1>
              <p className="text-slate-400 text-sm">
                Monitoreo del objetivo comercial: Reclutamiento de 10 a 30 profesores beta iniciales.
              </p>
            </div>

            <form action={seedJLGlobalAction}>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 font-medium text-xs transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Inicializar Tenant Insignia (JL Global)
              </button>
            </form>
          </div>

          {/* Goal Progress Banner */}
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-lg">Objetivo Beta: 10 – 30 Profesores</h2>
                  <span className="text-xs text-slate-400">Medidor de adopción de producto inicial</span>
                </div>
              </div>
              <div className="text-2xl font-extrabold text-blue-400 font-mono">
                {betaStats.activeBetaTeachers} / {betaStats.targetBetaTeachers}
              </div>
            </div>

            <div className="w-full h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${betaStats.progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Academias Creadas</span>
              <div className="text-3xl font-bold text-white">{betaStats.totalAcademies}</div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Cursos Publicados</span>
              <div className="text-3xl font-bold text-white">{betaStats.totalCourses}</div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Alumnos Totales</span>
              <div className="text-3xl font-bold text-white">{betaStats.totalStudents}</div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Generaciones IA</span>
              <div className="text-3xl font-bold text-purple-400 font-mono">{betaStats.totalAIGenerations}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

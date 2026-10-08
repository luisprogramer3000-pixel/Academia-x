import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { AcademyService } from "@/modules/academy/academy.service";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import Link from "next/link";
import { Users, BookOpen, GraduationCap, DollarSign, Sparkles, Plus, ArrowUpRight, CheckCircle2 } from "lucide-react";

export default async function DashboardPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;

  const stats = await AcademyService.getAcademyDashboardStats(tenantId);
  const walletSummary = await AICreditEngine.getTenantWalletSummary(tenantId);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          {/* Welcome Banner */}
          <div className="mb-8 p-8 rounded-3xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block mb-1 font-mono">
                Panel Administrativo
              </span>
              <h1 className="text-3xl font-extrabold text-white mb-2">¡Hola, bienvenido a {name}!</h1>
              <p className="text-slate-400 text-sm max-w-xl">
                Gestiona tus alumnos, crea nuevos cursos con Inteligencia Artificial y consulta el rendimiento de tu escuela.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/ai-copilot"
                className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Crear Curso con IA ({walletSummary.teacherCredits.available} cr)
              </Link>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Estudiantes Activos</span>
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.studentsCount}</div>
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" /> +12% este mes
              </span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Cursos Publicados</span>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{stats.publishedCoursesCount}</div>
              <span className="text-xs text-slate-400 font-medium">de {stats.coursesCount} creados</span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Créditos IA Profesor</span>
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">{walletSummary.teacherCredits.available}</div>
              <span className="text-xs text-slate-400 font-mono font-medium">de {walletSummary.teacherCredits.monthlyAllowance} cr mes</span>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Ingresos Mensuales</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">${stats.monthlyRevenue}</div>
              <span className="text-xs text-emerald-400 font-medium">Estimado</span>
            </div>
          </div>

          {/* Quick Actions & Recent Activity */}
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-4">Acciones Rápidas</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Link
                  href="/dashboard/ai-copilot"
                  className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 transition-all flex items-start gap-4 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm mb-1">Generar Curso con IA</h3>
                    <p className="text-xs text-slate-400">Diseña módulos y lecciones en segundos.</p>
                  </div>
                </Link>

                <Link
                  href="/dashboard/students"
                  className="p-5 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all flex items-start gap-4 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm mb-1">Invitar Estudiantes</h3>
                    <p className="text-xs text-slate-400">Envía acceso a nuevos alumnos.</p>
                  </div>
                </Link>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-lg font-bold text-white mb-4">Estado del Sistema</h2>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Aislamiento de Tenant</span>
                  <span className="font-mono text-emerald-400">Activo</span>
                </li>
                <li className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Billetera de Créditos IA</span>
                  <span className="font-mono text-purple-400 font-bold">{walletSummary.capacityStatus}</span>
                </li>
                <li className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Subdominio & Slug</span>
                  <span className="font-mono text-blue-400">{tenantSlug}</span>
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

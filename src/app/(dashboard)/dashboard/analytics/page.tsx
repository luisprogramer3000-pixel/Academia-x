import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { SAAS_PLANS } from "@/modules/billing/plans";
import { BarChart3, Users, BookOpen, GraduationCap, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { AnalyticsService } from "@/modules/academy/analytics.service";
import { MonthlyBarChart } from "@/components/dashboard/MonthlyBarChart";
import Link from "next/link";

export default async function AnalyticsPage() {
  const ctx = await getDashboardContext(OWNER_ONLY);
  const { tenantId, tenant: academy } = ctx;
  const planId = ctx.activePlan?.id as keyof typeof SAAS_PLANS | undefined;
  const capabilities = planId ? SAAS_PLANS[planId].capabilities : null;

  if (!capabilities?.advancedAnalytics) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
          <main className="p-8 flex-1 flex items-center justify-center">
            <div className="text-center p-8 rounded-3xl bg-slate-900 border border-slate-800 max-w-lg">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Analíticas Avanzadas</h2>
              <p className="text-slate-400 mb-8">
                Esta función es exclusiva del plan <strong className="text-white">Academy Executive</strong>. Mejora tu plan para obtener métricas detalladas sobre el rendimiento de tu escuela.
              </p>
              <Link href="/dashboard/billing" className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors">
                Mejorar Plan
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Get some real data for the analytics
  const studentsCount = await prisma.membership.count({
    where: { tenantId, role: "STUDENT" }
  });

  const coursesCount = await prisma.course.count({
    where: { tenantId }
  });

  const certificatesCount = await prisma.certificate.count({
    where: { tenantId }
  });

  const analytics = await AnalyticsService.getMonthlyAnalytics(tenantId, 6, academy.timezone);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        
        <main className="p-8 flex-1 overflow-y-auto max-w-6xl">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-400" /> Analíticas de la Academia
            </h1>
            <p className="text-slate-400 mt-2">
              Resumen del rendimiento y actividad de tus estudiantes.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3 text-slate-400 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <span className="font-semibold text-sm">Estudiantes Activos</span>
              </div>
              <div className="text-4xl font-extrabold text-white">{studentsCount}</div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3 text-slate-400 mb-4">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <span className="font-semibold text-sm">Cursos Creados</span>
              </div>
              <div className="text-4xl font-extrabold text-white">{coursesCount}</div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3 text-slate-400 mb-4">
                <GraduationCap className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-sm">Certificados Emitidos</span>
              </div>
              <div className="text-4xl font-extrabold text-white">{certificatesCount}</div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3 text-slate-400 mb-4">
                <ArrowUpRight className="w-5 h-5 text-purple-400" />
                <span className="font-semibold text-sm">Tasa de Finalización</span>
              </div>
              <div className="text-4xl font-extrabold text-white">{studentsCount > 0 ? Math.min(100, Math.round((certificatesCount / studentsCount) * 100)) : 0}%</div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-baseline justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Alumnos inscritos por mes</h3>
                <span className="text-xs text-slate-400">
                  {analytics.totals.students} en los últimos 6 meses
                </span>
              </div>
              <MonthlyBarChart
                data={analytics.newStudents}
                color="#3987e5"
                ariaLabel="Alumnos inscritos por mes en los últimos seis meses"
              />
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-baseline justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Alumnos que completaron un curso</h3>
                <span className="text-xs text-slate-400">
                  {analytics.totals.completions} certificados emitidos
                </span>
              </div>
              <MonthlyBarChart
                data={analytics.completions}
                color="#199e70"
                ariaLabel="Alumnos que completaron un curso por mes"
              />
              <p className="text-[11px] text-slate-500 mt-4">
                Se cuenta un alumno como completado cuando le apruebas el certificado del curso.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-baseline justify-between mb-5">
                <h3 className="text-lg font-bold text-white">Valor de las inscripciones por mes</h3>
                <span className="text-xs text-slate-400">
                  {analytics.totals.revenue.toLocaleString("es")} {analytics.currency} en total
                </span>
              </div>
              <MonthlyBarChart
                data={analytics.revenue}
                color="#c98500"
                format={(v) => `${v.toLocaleString("es")}`}
                ariaLabel="Valor de las inscripciones por mes"
              />
              <p className="text-[11px] text-amber-400/80 mt-4">
                Suma el precio de los cursos en los que se inscribieron tus alumnos. Como los cobros se hacen
                por enlace externo, la plataforma no puede confirmar qué pagos se completaron: es el valor
                generado, no el dinero cobrado.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

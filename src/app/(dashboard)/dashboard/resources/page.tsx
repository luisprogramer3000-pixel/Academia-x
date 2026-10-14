import Link from "next/link";
import { formatInTimezone } from "@/lib/timezone";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ResourceCardActions } from "./ResourceCardActions";
import { CalendarClock, FolderOpen, GraduationCap, Plus, Search, Wand2 } from "lucide-react";



export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string }> }) {
  const { q = "", subject = "" } = await searchParams;
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;

  const query = q.trim().slice(0, 100);
  const [resources, subjects] = await Promise.all([
    prisma.teachingResource.findMany({
      where: {
        tenantId,
        ...(subject ? { subject } : {}),
        ...(query
          ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { topic: { contains: query, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true, kind: true, title: true, subject: true, grade: true, createdAt: true, lessonId: true,
        user: { select: { name: true, email: true } },
        _count: { select: { schedules: true } },
      },
    }),
    prisma.teachingResource.findMany({
      where: { tenantId, subject: { not: null } },
      distinct: ["subject"],
      select: { subject: true },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        <main className="p-8 flex-1 overflow-y-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                <FolderOpen className="w-7 h-7 text-blue-400" /> Mis recursos
              </h1>
              <p className="text-slate-400 text-sm mt-1">Todos los planes de clase de tu academia, listos para reutilizar.</p>
            </div>
            <div className="flex gap-2 self-start">
              <Link href="/dashboard/ai-tools" className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm flex items-center gap-2">
                <Wand2 className="w-4 h-4" /> Herramientas IA
              </Link>
              <Link href="/dashboard/class-plan" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20">
                <Plus className="w-4 h-4" /> Nuevo plan de clase
              </Link>
            </div>
          </div>

          <form className="flex flex-col sm:flex-row gap-3 mb-8">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Buscar por título o tema…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <select name="subject" defaultValue={subject} className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white">
              <option value="">Todas las asignaturas</option>
              {subjects.map((s) => s.subject && <option key={s.subject} value={s.subject}>{s.subject}</option>)}
            </select>
            <button className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium">Filtrar</button>
          </form>

          {resources.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center max-w-xl mx-auto">
              <FolderOpen className="w-10 h-10 text-slate-600 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-white mb-2">{query || subject ? "Sin resultados" : "Aún no tienes recursos"}</h2>
              <p className="text-sm text-slate-400 mb-6">
                {query || subject ? "Prueba con otra búsqueda." : "Cada plan de clase que generes se guarda aquí automáticamente."}
              </p>
              {!query && !subject && (
                <Link href="/dashboard/class-plan" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm">
                  <Plus className="w-4 h-4" /> Crear mi primer plan
                </Link>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {resources.map((r) => (
                <div key={r.id} className="rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition-colors flex flex-col">
                  <Link href={`/dashboard/resources/${r.id}`} className="p-5 flex-1">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {r.kind === "MATERIAL" ? (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase tracking-wide">
                          Material IA
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20 uppercase tracking-wide">
                          Plan de clase
                        </span>
                      )}
                      {r.lessonId && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" /> En el campus
                        </span>
                      )}
                      {r._count.schedules > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" /> {r._count.schedules} programada{r._count.schedules > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-lg leading-snug mb-1">{r.title}</h3>
                    <p className="text-xs text-slate-400">{[r.subject, r.grade].filter(Boolean).join(" · ")}</p>
                  </Link>
                  <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <span>{r.user.name || r.user.email} · {formatInTimezone(r.createdAt, academy.timezone, { day: "numeric", month: "short", year: "numeric" })}</span>
                    <ResourceCardActions id={r.id} title={r.title} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

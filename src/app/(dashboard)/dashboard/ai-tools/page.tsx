import Link from "next/link";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { MATERIAL_TOOLS, getMaterialTool } from "@/modules/ai/material-tools";
import { ToolForm } from "./ToolForm";
import { CalendarClock, FileText, Wand2, Zap } from "lucide-react";

export const maxDuration = 120;

export default async function AIToolsPage({ searchParams }: { searchParams: Promise<{ tool?: string }> }) {
  const { tool: toolId } = await searchParams;
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tool = toolId ? getMaterialTool(toolId) : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        <main className="p-8 flex-1 overflow-y-auto">
          {tool ? (
            <ToolForm
              tool={{
                id: tool.id, name: tool.name, emoji: tool.emoji, description: tool.description,
                countLabel: tool.countLabel, defaultCount: tool.defaultCount, maxCount: tool.maxCount, liveQuiz: tool.liveQuiz,
              }}
            />
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                  <Wand2 className="w-7 h-7 text-blue-400" /> Herramientas IA
                </h1>
                <p className="text-slate-400 text-sm mt-1">Crea un material concreto en segundos. Todo se guarda en Mis recursos.</p>
              </div>

              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Clase completa</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-10">
                <Link href="/dashboard/class-plan" className="p-5 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/30 hover:border-blue-400 transition-colors flex gap-4">
                  <CalendarClock className="w-8 h-8 text-blue-300 shrink-0" />
                  <div>
                    <p className="font-bold text-white">Plan de clase completo</p>
                    <p className="text-sm text-slate-300 mt-1">Momentos con minutos, guion para el profesor y 5 materiales listos.</p>
                  </div>
                </Link>
                <Link href="/dashboard/lessons" className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors flex gap-4">
                  <FileText className="w-8 h-8 text-purple-300 shrink-0" />
                  <div>
                    <p className="font-bold text-white">Lección en PDF / PowerPoint</p>
                    <p className="text-sm text-slate-400 mt-1">Desde Lecciones descarga cualquier lección en PDF o PowerPoint, o preséntala en clase.</p>
                  </div>
                </Link>
              </div>

              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Materiales</h2>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {MATERIAL_TOOLS.map((t) => (
                  <Link key={t.id} href={`/dashboard/ai-tools?tool=${t.id}`} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 hover:-translate-y-0.5 transition-all">
                    <div className="flex items-start justify-between">
                      <span className="text-3xl">{t.emoji}</span>
                      {t.liveQuiz && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> En vivo
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-white mt-3">{t.name}</p>
                    <p className="text-sm text-slate-400 mt-1">{t.description}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

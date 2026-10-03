import Link from "next/link";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { createStandaloneLessonAction } from "@/app/actions/course.actions";
import { NewLessonAI } from "./NewLessonAI";
import { FileText, ArrowLeft, Plus, Sparkles, PencilLine, CheckCircle2 } from "lucide-react";

export const maxDuration = 300;

export default async function NewLessonPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams;
  const blank = modo === "blanco";
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;

  const tab = (active: boolean) =>
    `px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${
      active ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" : "text-slate-400 hover:text-white hover:bg-slate-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          <div className="max-w-3xl">
            <Link href="/dashboard/lessons" className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-4">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a mis lecciones
            </Link>
            <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
              <FileText className="w-7 h-7 text-emerald-400" /> Nueva lección
            </h1>
            <p className="text-slate-400 text-sm mb-6">
              Clase suelta para tus alumnos: contenido con actividades intercaladas y corrección al instante.
            </p>

            <div className="inline-flex p-1 rounded-2xl bg-slate-900 border border-slate-800 mb-8">
              <Link href="/dashboard/courses/new/lesson" className={tab(!blank)}>
                <Sparkles className="w-4 h-4" /> Con IA <span className="text-[10px] uppercase opacity-80">recomendado</span>
              </Link>
              <Link href="/dashboard/courses/new/lesson?modo=blanco" className={tab(blank)}>
                <PencilLine className="w-4 h-4" /> En blanco
              </Link>
            </div>

            {blank ? (
              <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
                <form action={createStandaloneLessonAction} className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Título de la lección</label>
                    <input
                      type="text"
                      name="title"
                      required
                      placeholder="Ej. Clase de conversación — Subjuntivo presente"
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Descripción breve <span className="text-slate-500 font-normal normal-case">(opcional)</span>
                    </label>
                    <textarea
                      name="description"
                      rows={3}
                      placeholder="¿Qué se trabaja en esta clase?"
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Nivel MCER <span className="text-slate-500 font-normal normal-case">(opcional)</span>
                    </label>
                    <select
                      name="level"
                      defaultValue=""
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    >
                      <option value="">Sin nivel específico</option>
                      <option value="A1">A1 - Principiante</option>
                      <option value="A2">A2 - Básico</option>
                      <option value="B1">B1 - Intermedio</option>
                      <option value="B2">B2 - Intermedio Alto</option>
                      <option value="C1">C1 - Avanzado</option>
                      <option value="C2">C2 - Maestría</option>
                    </select>
                  </div>
                  <div className="pt-6 border-t border-slate-800 flex justify-end">
                    <button type="submit" className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/30">
                      <Plus className="w-4 h-4" /> Crear y editar lección
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <ul className="grid sm:grid-cols-3 gap-3 mb-8 text-sm">
                  {[
                    "Contenido completo con tablas, ejemplos y consejos",
                    "Actividades intercaladas con corrección al instante",
                    "Tu guion de clase con momentos y minutos",
                  ].map((t) => (
                    <li key={t} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> {t}
                    </li>
                  ))}
                </ul>
                <NewLessonAI />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

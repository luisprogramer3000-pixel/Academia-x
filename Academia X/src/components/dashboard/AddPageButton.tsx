"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, FileText, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { addBlankPageAction, addToolPageAction } from "@/app/actions/course-page.actions";

export interface PageTool {
  id: string;
  name: string;
  emoji: string;
  description: string;
  countLabel: string;
  defaultCount: number;
  maxCount: number;
}

interface Props {
  courseId: string;
  moduleId: string;
  /** Lección tras la que se inserta (null = al final del módulo) */
  afterLessonId: string | null;
  afterTitle?: string;
  tools: PageTool[];
}

type Choice = { type: "blank" } | { type: "tool"; tool: PageTool };

const input = "w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500";
const label = "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2";

export function AddPageButton({ courseId, moduleId, afterLessonId, afterTitle, tools }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    if (busy) return;
    setOpen(false);
    setChoice(null);
    setError("");
  }

  async function submit(formData: FormData) {
    if (!choice) return;
    setBusy(true);
    setError("");
    const place = { moduleId, afterLessonId };
    const result =
      choice.type === "blank"
        ? await addBlankPageAction({ ...place, title: String(formData.get("title") || "") })
        : await addToolPageAction({
            ...place,
            toolId: choice.tool.id,
            topic: String(formData.get("topic") || ""),
            count: Number(formData.get("count") || choice.tool.defaultCount),
            context: String(formData.get("context") || "") || undefined,
            idempotencyKey: crypto.randomUUID(),
          });
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setChoice(null);
    // Página en blanco: directo al editor para escribirla. Con IA: se queda en el builder para seguir añadiendo
    if (choice.type === "blank") router.push(`/dashboard/courses/${courseId}/lessons/${result.lessonId}`);
    else router.refresh();
  }

  return (
    <>
      <div className="relative flex items-center justify-center py-1 group/add">
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-800 group-hover/add:border-blue-500/40 transition-colors" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-400 hover:text-white hover:border-blue-500 hover:bg-blue-600 transition-colors flex items-center gap-1"
          title={afterTitle ? `Añadir una página después de «${afterTitle}»` : "Añadir una página"}
        >
          <Plus className="w-3 h-3" /> Añadir página
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4" onClick={close}>
          <div className="w-full max-w-3xl my-10 rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                {choice && (
                  <button type="button" onClick={() => !busy && setChoice(null)} className="text-slate-400 hover:text-white" aria-label="Volver">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {!choice ? "¿Qué página quieres añadir?" : choice.type === "blank" ? "Página en blanco" : `${choice.tool.emoji} ${choice.tool.name}`}
                  </h3>
                  {afterTitle && <p className="text-xs text-slate-400">Se insertará después de «{afterTitle}»</p>}
                </div>
              </div>
              <button type="button" onClick={close} className="text-slate-400 hover:text-white" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!choice ? (
              <div className="p-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setChoice({ type: "blank" })}
                  className="relative p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-blue-500 text-left transition-colors"
                >
                  <span className="absolute top-3 right-3 text-[10px] font-semibold text-slate-500">Gratis</span>
                  <FileText className="w-6 h-6 text-blue-400 mb-2" />
                  <span className="block text-sm font-bold text-white">Página en blanco</span>
                  <span className="block text-xs text-slate-400 mt-1">Escribe tú el contenido con el editor de bloques.</span>
                </button>
                {tools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setChoice({ type: "tool", tool })}
                    className="relative p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500 text-left transition-colors"
                  >
                    <span className="absolute top-3 right-3 text-[10px] font-semibold text-indigo-400 flex items-center gap-0.5">
                      <Sparkles className="w-3 h-3" /> IA · 1 cr
                    </span>
                    <span className="block text-2xl mb-1.5">{tool.emoji}</span>
                    <span className="block text-sm font-bold text-white">{tool.name}</span>
                    <span className="block text-xs text-slate-400 mt-1 line-clamp-2">{tool.description}</span>
                  </button>
                ))}
              </div>
            ) : (
              <form action={submit} className="p-6 space-y-4">
                {choice.type === "blank" ? (
                  <div>
                    <label className={label}>Título de la página</label>
                    <input name="title" required minLength={2} maxLength={150} autoFocus placeholder="Ej. Práctica: saludos formales" className={input} />
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-slate-400">{choice.tool.description}</p>
                    <div>
                      <label className={label}>Tema</label>
                      <input name="topic" required minLength={3} maxLength={300} defaultValue={afterTitle || ""} className={input} />
                      <p className="text-[11px] text-slate-500 mt-1">Usa el nivel e idioma del curso.</p>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className={label}>{choice.tool.countLabel}</label>
                        <input name="count" type="number" min={1} max={choice.tool.maxCount} defaultValue={choice.tool.defaultCount} className={input} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={label}>Indicaciones (opcional)</label>
                        <input name="context" maxLength={2000} placeholder="Ej. centrado en saludos formales, con diálogos" className={input} />
                      </div>
                    </div>
                  </>
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {choice.type === "blank" ? "Creando..." : "Generando con IA (hasta 1 minuto)..."}
                    </>
                  ) : choice.type === "blank" ? (
                    "Crear página"
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Generar página · 1 crédito
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

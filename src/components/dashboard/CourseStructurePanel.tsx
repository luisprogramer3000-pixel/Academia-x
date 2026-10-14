"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Sparkles, AlertCircle, CheckCircle2, X, BookOpen } from "lucide-react";
import { regenerateCourseStructureAIAction } from "@/app/actions/ai.actions";
import { applyCourseStructureAction } from "@/app/actions/course.actions";

interface ProposedModule {
  title: string;
  description?: string;
  lessons?: Array<{ title: string }>;
}

interface CourseStructurePanelProps {
  courseId: string;
  courseTitle: string;
  courseLevel: string;
  hasExistingModules: boolean;
  /** Recién creado desde "Crear curso": se abre y genera la propuesta sin pedir otro clic */
  autoStart?: boolean;
  initialAudience?: string;
}

export function CourseStructurePanel({
  courseId,
  courseTitle,
  courseLevel,
  hasExistingModules,
  autoStart = false,
  initialAudience = "",
}: CourseStructurePanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<ProposedModule[] | null>(null);
  const [audience, setAudience] = useState(initialAudience);
  const [feedback, setFeedback] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function generate() {
    setBusy(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("courseId", courseId);
    formData.set("topic", courseTitle);
    formData.set("level", courseLevel);
    formData.set("audience", audience);
    if (feedback) formData.set("feedback", feedback);
    formData.set("clientRequestId", `${courseId}-structure-${Date.now()}`);

    const res = await regenerateCourseStructureAIAction(formData);
    setBusy(false);

    if (!res.success) {
      setMessage({ type: "error", text: res.error || "No se pudo generar la estructura." });
      return;
    }
    const payload = (res as { result?: { modules?: ProposedModule[] } }).result;
    const modules = payload?.modules || [];
    if (!modules.length) {
      setMessage({ type: "error", text: "La IA no devolvió módulos. Prueba a reformular el tema." });
      return;
    }
    setProposal(modules);
  }

  // Generación automática al llegar desde la creación del curso (una sola vez)
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current || hasExistingModules) return;
    started.current = true;
    setOpen(true);
    generate();
    // Quita ?generar=1 de la dirección para que recargar no vuelva a cobrar
    router.replace(`/dashboard/courses/${courseId}/builder`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply() {
    if (!proposal) return;
    setBusy(true);
    setMessage(null);
    const res = await applyCourseStructureAction(courseId, { modules: proposal });
    setBusy(false);
    if (res.success) {
      setProposal(null);
      setOpen(false);
      // Siguiente paso: escribir el contenido de cada lección (se abre el panel con el costo)
      router.push(`/dashboard/courses/${courseId}/builder?desarrollar=1`);
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo aplicar." });
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-indigo-600/20"
      >
        <Wand2 className="w-4 h-4" /> Generar módulos con IA
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4">
      <div className="w-full max-w-2xl my-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-indigo-400" /> Estructura del curso con IA
          </h3>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setProposal(null);
            }}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {message && (
          <div
            className={`mx-6 mt-6 p-3 rounded-xl text-sm flex items-start gap-2 ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {!proposal && busy && autoStart ? (
          <div className="p-10 text-center space-y-3">
            <span className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-indigo-400 border-t-transparent" />
            <p className="text-white font-semibold">La IA está diseñando los módulos y lecciones de «{courseTitle}»…</p>
            <p className="text-xs text-slate-400">Tarda unos segundos. Después podrás revisarla y aprobarla, o pedir otra versión.</p>
          </div>
        ) : !proposal ? (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                ¿A quién va dirigido? (opcional)
              </label>
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Ej: adultos que empiezan de cero"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Indicaciones para la IA (opcional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Ej: que empiece por lo más práctico y deje la gramática para el final"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="button"
              onClick={generate}
              disabled={busy}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition-colors flex items-center gap-2"
            >
              {busy ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Proponer estructura (3 créditos)
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-300">
              La IA propone <strong className="text-white">{proposal.length} módulo(s)</strong> con{" "}
              <strong className="text-white">
                {proposal.reduce((n, m) => n + (m.lessons?.length || 0), 0)} lección(es)
              </strong>
              .
            </p>

            <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
              {proposal.map((m, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <h4 className="font-bold text-white text-sm mb-1">{m.title}</h4>
                  {m.description && <p className="text-xs text-slate-400 mb-2">{m.description}</p>}
                  <ul className="space-y-1">
                    {(m.lessons || []).map((l, j) => (
                      <li key={j} className="text-xs text-slate-300 flex items-center gap-2">
                        <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" /> {l.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {hasExistingModules && (
              <p className="text-xs text-amber-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                Estos módulos se <strong>añaden</strong> al final del curso. No se borra nada de lo que ya tienes.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={apply}
                disabled={busy}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-colors"
              >
                {busy ? "Añadiendo..." : "Añadir al curso"}
              </button>
              <button
                type="button"
                onClick={() => setProposal(null)}
                disabled={busy}
                className="px-5 py-3 rounded-xl text-slate-400 hover:text-white font-medium"
              >
                Descartar y probar otra
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

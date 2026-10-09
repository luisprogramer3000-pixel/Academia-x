"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpenCheck, CheckCircle2, Loader2, RotateCcw, Sparkles, XCircle } from "lucide-react";

type Mode = "full" | "basic";
const CREDITS: Record<Mode, number> = { full: 6, basic: 2 };
const PARALLEL = 3;

type Status = "pending" | "running" | "done" | "skipped" | "error";

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/**
 * Desarrolla con IA las lecciones vacías del curso (la estructura propuesta
 * por la IA solo crea los títulos). Muestra el costo total antes de empezar y
 * el avance lección por lección; las que fallan no se cobran y se reintentan.
 */
export function DevelopLessonsPanel({
  lessons,
  credits,
  autoOpen = false,
}: {
  lessons: Array<{ id: string; title: string; moduleTitle: string }>;
  credits: number;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [mode, setMode] = useState<Mode>("full");
  const [status, setStatus] = useState<Record<string, { s: Status; error?: string }>>({});
  const [running, setRunning] = useState(false);
  const [spent, setSpent] = useState(0);
  const cleaned = useRef(false);

  // Quita ?desarrollar=1 de la dirección para que recargar no vuelva a abrir el panel
  useEffect(() => {
    if (autoOpen && !cleaned.current) {
      cleaned.current = true;
      const url = new URL(window.location.href);
      url.searchParams.delete("desarrollar");
      window.history.replaceState(null, "", url.toString());
    }
  }, [autoOpen]);

  if (lessons.length === 0) return null;

  const pending = lessons.filter((l) => !["done", "skipped"].includes(status[l.id]?.s ?? "pending"));
  const total = pending.length * CREDITS[mode];
  const available = credits - spent;
  const finished = lessons.filter((l) => ["done", "skipped"].includes(status[l.id]?.s ?? "")).length;
  const failed = lessons.filter((l) => status[l.id]?.s === "error").length;

  async function run() {
    const queue = [...pending];
    setRunning(true);
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const lesson = queue[cursor++];
        setStatus((st) => ({ ...st, [lesson.id]: { s: "running" } }));
        try {
          const res = await fetch(`/api/lessons/${lesson.id}/develop`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, idempotencyKey: `dev-${lesson.id}-${uid()}` }),
          });
          const data = (await res.json().catch(() => ({}))) as { skipped?: boolean; error?: string };
          if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
          if (!data.skipped) setSpent((x) => x + CREDITS[mode]);
          setStatus((st) => ({ ...st, [lesson.id]: { s: data.skipped ? "skipped" : "done" } }));
        } catch (error) {
          setStatus((st) => ({ ...st, [lesson.id]: { s: "error", error: error instanceof Error ? error.message : "No se pudo desarrollar." } }));
          // Sin créditos no tiene sentido seguir intentando
          if (error instanceof Error && /créditos/i.test(error.message)) cursor = queue.length;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));
    setRunning(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30">
        <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
          <BookOpenCheck className="w-4 h-4 text-emerald-400" /> {lessons.length} {lessons.length === 1 ? "lección vacía" : "lecciones vacías"}
        </h3>
        <p className="text-xs text-slate-400 mb-4">La estructura tiene los títulos; la IA puede escribir cada clase completa con lectura y ejercicios.</p>
        <button type="button" onClick={() => setOpen(true)} className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" /> Desarrollar las lecciones con IA
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border-2 border-emerald-500/40 space-y-4">
      <div>
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <BookOpenCheck className="w-4 h-4 text-emerald-400" /> Desarrollar las lecciones con IA
        </h3>
        <p className="text-xs text-slate-400 mt-1">Solo se escriben las lecciones vacías; las que ya tienen contenido no se tocan.</p>
      </div>

      {!running && finished === 0 && (
        <div className="grid gap-2">
          {([
            ["full", "Clase completa (recomendado)", "Explicación, ejemplos, lectura de comprensión, actividades, ejercicios con respuestas y el plan del profesor."],
            ["basic", "Contenido básico", "Explicación y bloques de la lección, más corto. Puedes completarlo después con el Agente de Clase."],
          ] as const).map(([m, title, desc]) => (
            <label key={m} className={`p-3 rounded-xl border cursor-pointer flex gap-3 ${mode === m ? "border-emerald-500 bg-emerald-500/10" : "border-slate-800 hover:border-slate-600"}`}>
              <input type="radio" name="develop-mode" checked={mode === m} onChange={() => setMode(m)} className="mt-1 accent-emerald-500" />
              <span>
                <span className="text-sm font-bold text-white">{title} · {CREDITS[m]} créditos por lección</span>
                <span className="block text-xs text-slate-400 mt-0.5">{desc}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <ul className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
        {lessons.map((l) => {
          const st = status[l.id];
          return (
            <li key={l.id} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 shrink-0">
                {st?.s === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  : st?.s === "done" || st?.s === "skipped" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  : st?.s === "error" ? <XCircle className="w-3.5 h-3.5 text-red-400" />
                  : <span className="block w-3.5 h-3.5 rounded-full border border-slate-600" />}
              </span>
              <span className="min-w-0">
                <span className="text-white">{l.title}</span> <span className="text-slate-500">· {l.moduleTitle}</span>
                {st?.s === "skipped" && <span className="text-slate-500"> (ya tenía contenido)</span>}
                {st?.error && <span className="block text-red-400">{st.error}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <p className="text-xs text-slate-300 mr-auto">
          {running
            ? `Escribiendo las clases: ${finished} de ${lessons.length}… (cada clase tarda de 1 a 5 minutos; deja esta página abierta)`
            : pending.length
              ? <>Total: <strong className="text-emerald-300">{total} créditos</strong> ({pending.length} × {CREDITS[mode]}) · tienes {available}</>
              : <span className="text-emerald-400">¡Listo! Todas las lecciones tienen contenido.</span>}
        </p>
        {!running && pending.length > 0 && (
          <button
            type="button"
            onClick={run}
            disabled={total > available}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2"
          >
            {failed ? <RotateCcw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            {failed ? `Reintentar ${pending.length}` : `Desarrollar ${pending.length} ${pending.length === 1 ? "lección" : "lecciones"}`} ({total} créditos)
          </button>
        )}
        {!running && (
          <button type="button" onClick={() => setOpen(false)} className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white">Cerrar</button>
        )}
      </div>
      {!running && pending.length > 0 && total > available && (
        <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> No te alcanzan los créditos: elige «Contenido básico», recarga créditos o desarrolla algunas lecciones a mano.</p>
      )}
    </div>
  );
}

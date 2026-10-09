"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BookOpenCheck, CheckCircle2, ExternalLink, ImageIcon, Loader2, RotateCcw, Search, Sparkles, XCircle } from "lucide-react";

type Mode = "full" | "basic";
const CREDITS: Record<Mode, number> = { full: 6, basic: 2 };
const PARALLEL = 3;
const IMAGE_CREDITS = 1;
const RESEARCH_CREDITS = 2;
const IMAGE_OPTIONS = [0, 2, 4] as const;

type Status = "pending" | "running" | "done" | "skipped" | "error";
type Research = { sources: Array<{ title: string; url: string }>; webSearch: boolean } | null;

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/**
 * Desarrolla con IA las lecciones vacías del curso (la estructura propuesta
 * por la IA solo crea los títulos). Antes de escribir, investiga el tema en
 * fuentes profesionales (una vez por curso) y pregunta si se quieren imágenes.
 * Muestra el costo total antes de empezar y el avance lección por lección; las
 * que fallan no se cobran y se reintentan.
 */
export function DevelopLessonsPanel({
  courseId,
  research: initialResearch,
  lessons,
  credits,
  autoOpen = false,
}: {
  courseId: string;
  research: Research;
  lessons: Array<{ id: string; title: string; moduleTitle: string }>;
  credits: number;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [mode, setMode] = useState<Mode>("full");
  const [images, setImages] = useState<number>(0);
  const [research, setResearch] = useState<Research>(initialResearch);
  const [phase, setPhase] = useState<"" | "research">("");
  const [researchError, setResearchError] = useState("");
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
  const imageCount = mode === "full" ? images : 0;
  const perLesson = CREDITS[mode] + imageCount * IMAGE_CREDITS;
  const researchCost = mode === "full" && !research && pending.length ? RESEARCH_CREDITS : 0;
  const total = pending.length * perLesson + researchCost;
  const available = credits - spent;
  const finished = lessons.filter((l) => ["done", "skipped"].includes(status[l.id]?.s ?? "")).length;
  const failed = lessons.filter((l) => status[l.id]?.s === "error").length;

  async function run() {
    const queue = [...pending];
    setRunning(true);
    setResearchError("");

    // 1) Investigación del tema (una vez por curso): todas las clases se escriben sobre ese marco
    if (mode === "full" && !research) {
      setPhase("research");
      try {
        const res = await fetch(`/api/courses/${courseId}/research`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const data = (await res.json().catch(() => ({}))) as { error?: string; sources?: Array<{ title: string; url: string }>; webSearch?: boolean };
        if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
        setResearch({ sources: data.sources ?? [], webSearch: data.webSearch === true });
        setSpent((x) => x + RESEARCH_CREDITS);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudo investigar el tema.";
        if (/créditos/i.test(message)) {
          setResearchError(message);
          setPhase("");
          setRunning(false);
          return;
        }
        setResearchError(`${message} Las clases se escriben igual, sin el marco investigado.`);
      }
      setPhase("");
    }

    // 2) Clases, de 3 en 3
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const lesson = queue[cursor++];
        setStatus((st) => ({ ...st, [lesson.id]: { s: "running" } }));
        try {
          const res = await fetch(`/api/lessons/${lesson.id}/develop`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode, imageCount, idempotencyKey: `dev-${lesson.id}-${uid()}` }),
          });
          const data = (await res.json().catch(() => ({}))) as { skipped?: boolean; error?: string };
          if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
          if (!data.skipped) setSpent((x) => x + perLesson);
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
        <p className="text-xs text-slate-400 mb-4">La estructura tiene los títulos; la IA puede investigar el tema y escribir cada clase completa con teoría, ejemplos, lectura y ejercicios.</p>
        <button type="button" onClick={() => setOpen(true)} className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" /> Desarrollar las lecciones con IA
        </button>
      </div>
    );
  }

  const setup = !running && finished === 0;

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border-2 border-emerald-500/40 space-y-4">
      <div>
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <BookOpenCheck className="w-4 h-4 text-emerald-400" /> Desarrollar las lecciones con IA
        </h3>
        <p className="text-xs text-slate-400 mt-1">Solo se escriben las lecciones vacías; las que ya tienen contenido no se tocan.</p>
      </div>

      {setup && (
        <div className="grid gap-2">
          {([
            ["full", "Clase completa (recomendado)", "Basada en la investigación del tema: teoría con la profundidad del nivel, muchos ejemplos, lectura de comprensión, actividades, ejercicios con respuestas y el plan del profesor."],
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

      {setup && mode === "full" && (
        <div className="p-3 rounded-xl border border-slate-800 space-y-2">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-emerald-400" /> ¿Quieres imágenes en las lecciones?
          </p>
          <div className="flex flex-wrap gap-2">
            {IMAGE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setImages(n)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${images === n ? "border-emerald-500 bg-emerald-500/15 text-white" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}
              >
                {n === 0 ? "Sin imágenes" : `${n} por lección (+${n * IMAGE_CREDITS} créditos)`}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">Ilustran la teoría, la lectura y los ejemplos. Siempre puedes añadir o cambiar imágenes después en cada lección.</p>
        </div>
      )}

      {mode === "full" && (
        <div className="p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
          <p className="font-bold text-white text-sm flex items-center gap-2">
            {phase === "research" ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Search className="w-4 h-4 text-emerald-400" />}
            Investigación del tema
          </p>
          {phase === "research" ? (
            <p className="text-slate-300">Buscando fuentes profesionales del tema (organismos oficiales, exámenes, cursos de referencia)… 1-2 minutos.</p>
          ) : research ? (
            <>
              <p className="text-emerald-300">
                {research.webSearch
                  ? `Lista: las clases se basan en ${research.sources.length} ${research.sources.length === 1 ? "fuente consultada" : "fuentes consultadas"}.`
                  : "Lista (marco de referencia elaborado por la IA, sin búsqueda web)."}
              </p>
              {research.sources.length > 0 && (
                <ul className="max-h-28 overflow-y-auto space-y-0.5 pr-1">
                  {research.sources.map((src) => (
                    <li key={src.url} className="min-w-0">
                      <a href={src.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-white flex items-center gap-1 min-w-0">
                        <ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{src.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-slate-400">
              Antes de escribir, la IA investiga el tema en fuentes profesionales (programas oficiales, exámenes, cursos y estudios del área) y todas las clases se basan en ese marco. Una sola vez por curso: {RESEARCH_CREDITS} créditos.
            </p>
          )}
          {researchError && <p className="text-amber-300">{researchError}</p>}
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
            ? phase === "research"
              ? "Investigando el tema antes de escribir…"
              : `Escribiendo las clases: ${finished} de ${lessons.length}… (cada clase tarda de 2 a 6 minutos; deja esta página abierta)`
            : pending.length
              ? <>Total: <strong className="text-emerald-300">{total} créditos</strong> ({pending.length} × {perLesson}{researchCost ? ` + ${researchCost} de investigación` : ""}) · tienes {available}</>
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
        <p className="text-xs text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> No te alcanzan los créditos: quita las imágenes, elige «Contenido básico», recarga créditos o desarrolla algunas lecciones a mano.
        </p>
      )}
    </div>
  );
}

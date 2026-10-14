"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { DeckSlide } from "@/modules/presentation/presentation.deck";
import type { TextDensity } from "@/modules/presentation/presentation.themes";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Maximize, Minimize } from "lucide-react";
import { ANNOTATION_COLORS, AnnotationCanvas, AnnotationToolbar, type AnnotationTool, type Stroke } from "./Annotator";
import { DialogueView } from "@/components/lesson/DialogueView";

const OPTION_COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#864cbf", "#0aa3a3"];
const DENSITY_LABEL: Record<TextDensity, string> = { minimo: "Mínimo", estandar: "Estándar", detallado: "Detallado" };

export function LessonPresenter({
  lessonId,
  title,
  slides,
  density,
  accent,
  backHref,
}: {
  lessonId: string;
  title: string;
  slides: DeckSlide[];
  density: TextDensity;
  accent: string;
  backHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const total = slides.length;
  const go = useCallback((delta: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + delta))), [total]);

  // Anotaciones en vivo: una lista de trazos por diapositiva (se conservan al volver atrás)
  const [tool, setTool] = useState<AnnotationTool>("pointer");
  const [penColor, setPenColor] = useState(ANNOTATION_COLORS[0]);
  const [markerColor, setMarkerColor] = useState("#facc15");
  const [annotations, setAnnotations] = useState<Record<number, Stroke[]>>({});
  const strokes = annotations[index] ?? [];
  const setStrokes = useCallback((next: Stroke[]) => setAnnotations((a) => ({ ...a, [index]: next })), [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escribiendo un texto: las teclas son para el texto, no para navegar
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === "z") { e.preventDefault(); setAnnotations((a) => ({ ...a, [index]: (a[index] ?? []).slice(0, -1) })); return; }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (k === "v") return setTool("pointer");
        if (k === "p") return setTool("pen");
        if (k === "m") return setTool("highlighter");
        if (k === "t") return setTool("text");
        if (k === "b") return setTool("eraser");
      }
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(1); }
      if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(-1); }
      if (e.key === "Home") setIndex(0);
      if (e.key === "End") setIndex(total - 1);
    };
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [go, total, index]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const slide = slides[index];

  return (
    <div className="h-screen bg-slate-950 text-white flex flex-col select-none">
      {/* Barra superior: se oculta en pantalla completa */}
      {!fullscreen && (
        <header className="flex items-center justify-between gap-4 px-5 py-3 border-b border-slate-800">
          <Link href={backHref} className="text-sm text-slate-400 hover:text-white flex items-center gap-1.5 shrink-0">
            <ArrowLeft className="w-4 h-4" /> Salir
          </Link>
          <p className="font-semibold text-slate-200 truncate">{title}</p>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
              {(Object.keys(DENSITY_LABEL) as TextDensity[]).map((d) => (
                <Link
                  key={d}
                  href={`/dashboard/lessons/${lessonId}/presentar?d=${d}`}
                  className={`px-2.5 py-1 rounded-md ${d === density ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  {DENSITY_LABEL[d]}
                </Link>
              ))}
            </div>
            <button onClick={toggleFullscreen} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold flex items-center gap-1.5">
              <Maximize className="w-4 h-4" /> Pantalla completa
            </button>
          </div>
        </header>
      )}

      {/* Diapositiva 16:9 centrada; el texto escala con su ancho (unidades cqw) */}
      <main
        className="relative flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8 pl-20 sm:pl-24"
        // Con una herramienta activa, el clic no pasa de diapositiva (se está dibujando)
        onClick={() => tool === "pointer" && go(1)}
      >
        {/* Herramientas de anotación, a un lado de la diapositiva */}
        <div className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20">
          <AnnotationToolbar
            tool={tool}
            color={tool === "highlighter" ? markerColor : penColor}
            canUndo={strokes.length > 0}
            onTool={setTool}
            onColor={(c) => (tool === "highlighter" ? setMarkerColor(c) : setPenColor(c))}
            onUndo={() => setStrokes(strokes.slice(0, -1))}
            onClear={() => setStrokes([])}
          />
        </div>

        <div
          className="relative w-full max-h-full aspect-video bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden"
          style={{ containerType: "inline-size", maxWidth: "calc((100vh - 9rem) * 16 / 9)" }}
        >
          <span className="absolute left-0 top-0 h-[1.2cqw] w-full" style={{ background: accent }} />
          {slide ? <SlideView slide={slide} accent={accent} /> : <Empty />}
          <span className="absolute bottom-[2cqw] right-[3cqw] text-[1.3cqw] text-slate-400 tabular-nums">{index + 1} / {total}</span>
          <AnnotationCanvas
            key={index}
            tool={tool}
            color={tool === "highlighter" ? markerColor : penColor}
            strokes={strokes}
            onChange={setStrokes}
          />
        </div>
      </main>

      {/* Controles */}
      <footer className={`flex items-center gap-4 px-5 ${fullscreen ? "pb-3" : "py-3 border-t border-slate-800"}`}>
        <button onClick={() => go(-1)} disabled={index === 0} className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30" aria-label="Anterior">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full transition-all duration-300" style={{ width: `${((index + 1) / Math.max(1, total)) * 100}%`, background: accent }} />
        </div>
        <button onClick={() => go(1)} disabled={index >= total - 1} className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30" aria-label="Siguiente">
          <ChevronRight className="w-5 h-5" />
        </button>
        {fullscreen && (
          <button onClick={toggleFullscreen} className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700" aria-label="Salir de pantalla completa">
            <Minimize className="w-5 h-5" />
          </button>
        )}
      </footer>
    </div>
  );
}

function Empty() {
  return (
    <div className="h-full flex items-center justify-center text-[2cqw] text-slate-400">Esta lección aún no tiene contenido.</div>
  );
}

function SlideImage({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="w-full h-full object-cover rounded-[1.5cqw] shadow-lg" draggable={false} />;
}

function SlideView({ slide, accent }: { slide: DeckSlide; accent: string }) {
  if (slide.kind === "cover") {
    return (
      <div className={`h-full grid ${slide.image ? "grid-cols-[1.2fr_1fr]" : "grid-cols-1"} gap-[4cqw] p-[6cqw] items-center`}>
        <div>
          {slide.body && <p className="text-[2.2cqw] font-bold uppercase tracking-wider mb-[1.5cqw]" style={{ color: accent }}>{slide.body}</p>}
          <h1 className="text-[5.5cqw] font-black leading-[1.05]">{slide.title}</h1>
          {slide.footnote && <p className="text-[1.8cqw] text-slate-500 mt-[3cqw]">{slide.footnote}</p>}
        </div>
        {slide.image && <div className="h-[36cqw]"><SlideImage src={slide.image} alt={slide.title} /></div>}
      </div>
    );
  }

  if (slide.kind === "section") {
    return (
      <div className="h-full flex flex-col justify-center p-[7cqw]" style={{ background: `${accent}10` }}>
        {slide.footnote && <p className="text-[2cqw] font-bold uppercase tracking-[0.2em] mb-[2cqw]" style={{ color: accent }}>{slide.footnote}</p>}
        <h2 className="text-[5.5cqw] font-black leading-[1.05]" style={{ color: accent }}>{slide.title}</h2>
        {slide.body && <p className="text-[2.2cqw] text-slate-600 mt-[2.5cqw] max-w-[70cqw]">{slide.body}</p>}
      </div>
    );
  }

  if (slide.kind === "quiz") {
    return (
      <div className="h-full flex flex-col p-[5cqw]">
        <p className="text-[1.8cqw] font-bold uppercase tracking-wider mb-[1.5cqw]" style={{ color: accent }}>{slide.title}</p>
        <h2 className="text-[3.4cqw] font-bold leading-tight mb-[3cqw] whitespace-pre-line">{slide.body}</h2>
        {slide.bullets?.length ? (
          <div className="grid grid-cols-2 gap-[1.6cqw] mt-auto">
            {slide.bullets.map((opt, i) => (
              <div key={i} className="rounded-[1.2cqw] px-[2cqw] py-[1.8cqw] text-white text-[2.3cqw] font-bold" style={{ background: OPTION_COLORS[i % OPTION_COLORS.length] }}>
                {opt}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-auto rounded-[1.2cqw] border-[0.25cqw] border-dashed border-slate-300 h-[14cqw] flex items-center justify-center text-[2cqw] text-slate-400">
            Piensa tu respuesta…
          </div>
        )}
      </div>
    );
  }

  if (slide.kind === "answer" && slide.options?.length && slide.correct !== undefined) {
    // Corrección de opción múltiple: la pregunta con ✓ en la buena y ✕ en las demás
    return (
      <div className="h-full flex flex-col p-[5cqw]">
        <h2 className="text-[3cqw] font-bold leading-tight mb-[3cqw] whitespace-pre-line">{slide.body}</h2>
        <div className="space-y-[1.3cqw] mt-auto">
          {slide.options.map((opt, i) => {
            const right = i === slide.correct;
            return (
              <div
                key={i}
                className={`rounded-[1.2cqw] border-[0.2cqw] px-[2cqw] py-[1.4cqw] text-[2.2cqw] flex items-center gap-[1.6cqw] ${right ? "bg-emerald-50 border-emerald-400 font-bold" : "bg-rose-50 border-rose-200 text-slate-600"}`}
              >
                <span className={`w-[3.2cqw] h-[3.2cqw] rounded-full flex items-center justify-center text-white text-[1.8cqw] font-black shrink-0 ${right ? "bg-emerald-600" : "bg-rose-300"}`}>
                  {right ? "✓" : "✕"}
                </span>
                {opt}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (slide.kind === "answer") {
    return (
      <div className="h-full flex flex-col justify-center p-[6cqw] bg-emerald-50">
        <p className="text-[2cqw] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-[1cqw] mb-[2cqw]">
          <CheckCircle2 className="w-[3cqw] h-[3cqw]" /> {slide.title}
        </p>
        <p className="text-[4.2cqw] font-black text-emerald-900 leading-tight whitespace-pre-line">{slide.body}</p>
        {slide.footnote && <p className="text-[1.8cqw] text-emerald-800/70 mt-[3cqw]">{slide.footnote}</p>}
      </div>
    );
  }

  if (slide.dialogue?.length) {
    return (
      <div className="h-full flex flex-col p-[4cqw]">
        <h2 className="text-[3.2cqw] font-black leading-tight mb-[2cqw]" style={{ color: accent }}>{slide.title}</h2>
        <div className={`flex-1 min-h-0 grid gap-[3cqw] ${slide.image ? "grid-cols-[1fr_1.4fr]" : "grid-cols-1"} items-center`}>
          {slide.image && <div className="h-full min-h-0"><SlideImage src={slide.image} alt={slide.title} /></div>}
          <div className="min-h-0 overflow-hidden">
            <DialogueView lines={slide.dialogue} large />
          </div>
        </div>
      </div>
    );
  }

  // Puntos cortos (resúmenes, listas de ideas): en columnas, como tarjetas, en vez de una lista lineal
  const points = slide.bullets ?? [];
  const asColumns =
    !slide.image && points.length >= 2 && points.length <= 6 && points.every((p) => p.length <= 160) && (slide.body?.length ?? 0) <= 220;
  if (asColumns) {
    const cols = points.length === 4 ? 2 : Math.min(3, points.length);
    return (
      <div className="h-full flex flex-col p-[5cqw]">
        <h2 className="text-[3.6cqw] font-black leading-tight mb-[1.5cqw]" style={{ color: accent }}>{slide.title}</h2>
        {slide.body && <p className="text-[2cqw] text-slate-600 mb-[2cqw]">{slide.body}</p>}
        <div className="flex-1 min-h-0 grid gap-[2cqw] content-center" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {points.map((p, i) => (
            <div key={i} className="rounded-[1.5cqw] p-[2.2cqw] flex flex-col gap-[1.2cqw]" style={{ background: `${accent}12`, borderTop: `0.5cqw solid ${accent}` }}>
              <span
                className="w-[4cqw] h-[4cqw] rounded-full flex items-center justify-center text-white font-black text-[2cqw] shrink-0"
                style={{ background: accent }}
              >
                {slide.numbered ? i + 1 : "✓"}
              </span>
              <p className={`${points.length > 3 ? "text-[1.9cqw]" : "text-[2.2cqw]"} leading-snug text-slate-800 font-medium`}>{p}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Contenido
  const long = (slide.body?.length ?? 0) + (slide.bullets ?? []).join("").length > 450;
  return (
    <div className={`h-full grid ${slide.image ? "grid-cols-[1.4fr_1fr]" : "grid-cols-1"} gap-[3.5cqw] p-[5cqw]`}>
      <div className="min-h-0 flex flex-col">
        <h2 className="text-[3.6cqw] font-black leading-tight mb-[2cqw]" style={{ color: accent }}>{slide.title}</h2>
        <div className={`${long ? "text-[1.7cqw]" : "text-[2.3cqw]"} leading-snug text-slate-700 space-y-[1.2cqw] overflow-hidden`}>
          {slide.body?.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
          {slide.bullets?.length ? (
            <ul className="space-y-[0.8cqw]">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex gap-[1.2cqw]">
                  <span className="mt-[0.9cqw] w-[0.9cqw] h-[0.9cqw] rounded-full shrink-0" style={{ background: accent }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      {slide.image && <div className="min-h-0 h-full"><SlideImage src={slide.image} alt={slide.title} /></div>}
    </div>
  );
}

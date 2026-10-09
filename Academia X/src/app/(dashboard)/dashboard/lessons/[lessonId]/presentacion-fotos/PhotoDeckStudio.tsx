"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, Camera, CheckCircle2, Download, Eye, ImagePlus, Loader2, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, Wand2,
} from "lucide-react";
import { deckPalette } from "@/modules/presentation/photo-deck/layout";
import { SlidePreview } from "./SlidePreview";
import {
  PHOTO_CHANGE_CREDITS, PHOTO_CREDITS, SCRIPT_CREDITS, SLIDE_TYPES, SLIDE_TYPE_LABELS, defaultPhotoFor, newSlideId, photosCost,
  type DeckScript, type ScriptSlide, type ScriptSlideType,
} from "@/modules/presentation/photo-deck/script";

const input = "w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500";
const select = "px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500";
const label = "block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1";
const PARALLEL = 4;

type SlideState = { busy?: boolean; error?: string; instruction?: string };

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  return data as T;
}

export function PhotoDeckStudio({
  lessonId,
  initialDeck,
  initialCredits,
  accent,
  academyName,
}: {
  lessonId: string;
  initialDeck: { id: string; script: DeckScript } | null;
  initialCredits: number;
  accent: string;
  academyName: string;
}) {
  const colors = useMemo(() => deckPalette(accent), [accent]);
  // Con todas las fotos listas se abre directamente la vista previa
  const [view, setView] = useState<"edit" | "preview">(initialDeck?.script.slides.every((s) => s.imageUrl) ? "preview" : "edit");
  const [deckId, setDeckId] = useState(initialDeck?.id ?? null);
  const [script, setScript] = useState<DeckScript | null>(initialDeck?.script ?? null);
  const [saved, setSaved] = useState(JSON.stringify(initialDeck?.script ?? null));
  const [credits, setCredits] = useState(initialCredits);
  const [density, setDensity] = useState<"minimo" | "estandar" | "detallado">("estandar");
  const [slideCount, setSlideCount] = useState(12);
  const [busy, setBusy] = useState<null | "script" | "save" | "photos" | "download">(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [slideState, setSlideState] = useState<Record<string, SlideState>>({});
  const scriptRef = useRef(script);
  scriptRef.current = script;

  const dirty = JSON.stringify(script) !== saved;
  const pendingCost = script ? photosCost(script.slides) : 0;
  const missing = script ? script.slides.filter((s) => !s.imageUrl).length : 0;
  const fromLesson = script ? script.slides.filter((s) => s.imageUrl && s.imageSource === "lesson").length : 0;
  const locked = busy === "photos";
  const setSlide = (id: string, patch: Partial<SlideState>) => setSlideState((st) => ({ ...st, [id]: { ...st[id], ...patch } }));

  const counts = useMemo(() => {
    const s = script?.slides ?? [];
    return { realistic: s.filter((x) => !x.imageUrl && x.photo === "realistic").length, economic: s.filter((x) => !x.imageUrl && x.photo === "economic").length };
  }, [script]);

  // ─── Guion ────────────────────────────────────────────────────────────────

  async function createScript() {
    setBusy("script");
    setMessage(null);
    try {
      const { id } = await api<{ id: string }>("/api/photo-decks", { method: "POST", body: JSON.stringify({ lessonId, density, slides: slideCount, idempotencyKey: uid() }) });
      const deck = await api<{ script: DeckScript }>(`/api/photo-decks/${id}`);
      setDeckId(id);
      setScript(deck.script);
      setSaved(JSON.stringify(deck.script));
      setCredits((c) => c - SCRIPT_CREDITS);
      setMessage({ ok: true, text: `Guion listo: ${deck.script.slides.length} diapositivas. Revísalo y corrígelo antes de generar las fotos.` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "No se pudo escribir el guion." });
    } finally {
      setBusy(null);
    }
  }

  async function save(quiet = false): Promise<boolean> {
    if (!deckId || !scriptRef.current) return false;
    if (!quiet) setBusy("save");
    try {
      const res = await api<{ script: DeckScript }>(`/api/photo-decks/${deckId}`, { method: "PUT", body: JSON.stringify({ script: scriptRef.current }) });
      setScript(res.script);
      setSaved(JSON.stringify(res.script));
      if (!quiet) setMessage({ ok: true, text: "Guion guardado." });
      return true;
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "No se pudo guardar el guion." });
      return false;
    } finally {
      if (!quiet) setBusy(null);
    }
  }

  const update = (id: string, patch: Partial<ScriptSlide>) =>
    setScript((s) => (s ? { ...s, slides: s.slides.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : s));

  function move(index: number, dir: -1 | 1) {
    setScript((s) => {
      if (!s) return s;
      const slides = [...s.slides];
      const j = index + dir;
      if (j < 0 || j >= slides.length) return s;
      [slides[index], slides[j]] = [slides[j], slides[index]];
      return { ...s, slides };
    });
  }

  function addSlide() {
    setScript((s) =>
      s ? { ...s, slides: [...s.slides, { id: newSlideId(), type: "concept", title: "Nueva diapositiva", text: "", items: [], imagePrompt: "", photo: "realistic", notes: "" }] } : s
    );
  }

  // ─── Fotos ────────────────────────────────────────────────────────────────

  async function photoFor(slide: ScriptSlide, instruction?: string): Promise<boolean> {
    setSlide(slide.id, { busy: true, error: undefined });
    try {
      const res = await api<{ imageUrl: string }>(`/api/photo-decks/${deckId}/slides/${slide.id}/photo`, {
        method: "POST",
        body: JSON.stringify({ instruction, requestId: uid() }),
      });
      update(slide.id, { imageUrl: res.imageUrl, imageSource: "ai" });
      setSaved((prev) => {
        // La foto ya quedó guardada en el servidor: el guion local sigue "sin cambios"
        try {
          const p = JSON.parse(prev) as DeckScript;
          return JSON.stringify({ ...p, slides: p.slides.map((x) => (x.id === slide.id ? { ...x, imageUrl: res.imageUrl, imageSource: "ai" as const } : x)) });
        } catch {
          return prev;
        }
      });
      setCredits((c) => c - (instruction ? PHOTO_CHANGE_CREDITS : PHOTO_CREDITS[slide.photo]));
      setSlide(slide.id, { busy: false, instruction: "" });
      return true;
    } catch (error) {
      setSlide(slide.id, { busy: false, error: error instanceof Error ? error.message : "No se pudo generar la foto." });
      return false;
    }
  }

  async function generateAll() {
    if (!script) return;
    if (dirty && !(await save(true))) return;
    const queue = (scriptRef.current ?? script).slides.filter((s) => !s.imageUrl);
    if (!queue.length) return;
    setBusy("photos");
    setMessage(null);
    setProgress({ done: 0, total: queue.length });
    let failed = 0;
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const slide = queue[cursor++];
        const ok = await photoFor(slide);
        if (!ok) failed++;
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));
    setBusy(null);
    setProgress(null);
    setMessage(
      failed
        ? { ok: false, text: `${queue.length - failed} fotos listas; ${failed} no se pudieron generar (no se cobraron). Puedes reintentarlas una a una.` }
        : { ok: true, text: "¡Fotos listas! Revisa cada diapositiva, cambia la que quieras y descarga el PowerPoint." }
    );
    setView("preview");
  }

  async function download() {
    if (!deckId) return;
    if (dirty && !(await save(true))) return;
    setBusy("download");
    try {
      const res = await fetch(`/api/photo-decks/${deckId}/pptx`);
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "No se pudo armar el PowerPoint.");
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "presentacion.pptx";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "No se pudo descargar." });
    } finally {
      setBusy(null);
    }
  }

  // ─── Vista ────────────────────────────────────────────────────────────────

  if (!script) {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-3">
          {[
            ["1", "Guion con IA", `La IA escribe cada diapositiva con la clasificación real, la lectura y los ejercicios. ${SCRIPT_CREDITS} créditos.`],
            ["2", "Lo revisas", "Corriges títulos, textos y la descripción de cada foto. Gratis."],
            ["3", "Fotos", `Primero se usan las imágenes que ya tiene la lección (gratis). Las que falten: realista ${PHOTO_CREDITS.realistic} cr · económica ${PHOTO_CREDITS.economic} cr. Antes ves el total.`],
            ["4", "PowerPoint", `Foto + texto real editable y notas del orador. Cambiar una foto: ${PHOTO_CHANGE_CREDITS} cr.`],
          ].map(([n, t, d]) => (
            <div key={n} className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 text-sm font-extrabold flex items-center justify-center mb-2">{n}</span>
              <p className="text-sm font-bold text-white">{t}</p>
              <p className="text-xs text-slate-400 mt-1">{d}</p>
            </div>
          ))}
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-end gap-4">
          <div>
            <label className={label}>Cantidad de texto</label>
            <select value={density} onChange={(e) => setDensity(e.target.value as typeof density)} className={input}>
              <option value="minimo">Poco texto (presentador)</option>
              <option value="estandar">Estándar</option>
              <option value="detallado">Detallado</option>
            </select>
          </div>
          <div>
            <label className={label}>Diapositivas</label>
            <select value={slideCount} onChange={(e) => setSlideCount(Number(e.target.value))} className={input}>
              {[8, 10, 12, 15].map((n) => (
                <option key={n} value={n}>{n} (≈ {SCRIPT_CREDITS + Math.round(n * 1.4)} créditos en total)</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={createScript}
            disabled={busy !== null || credits < SCRIPT_CREDITS}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm flex items-center gap-2"
          >
            {busy === "script" ? <><Loader2 className="w-4 h-4 animate-spin" /> La IA está escribiendo el guion…</> : <><Sparkles className="w-4 h-4" /> Escribir el guion con IA ({SCRIPT_CREDITS} créditos)</>}
          </button>
          <p className="text-xs text-slate-500">Tienes {credits} créditos.</p>
        </div>
        {message && <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-28">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={script.title}
          onChange={(e) => setScript({ ...script, title: e.target.value })}
          disabled={locked}
          className={`${input} max-w-xl text-base font-bold`}
          aria-label="Título de la presentación"
        />
        <a href={`?nueva=1`} className="text-xs text-slate-400 hover:text-white underline">Empezar otra desde cero</a>
      </div>
      <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800">
        {([["preview", Eye, "Vista previa de diapositivas"], ["edit", Pencil, "Editar guion"]] as const).map(([v, Icon, text]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${view === v ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:text-white"}`}
          >
            <Icon className="w-4 h-4" /> {text}
          </button>
        ))}
      </div>

      {view === "preview" ? (
        <div className="space-y-6">
          <p className="text-xs text-slate-500">Así se verá cada diapositiva en el PowerPoint. Cambia la foto o edita el texto de la que no te guste antes de descargar.</p>
          {script.slides.map((s, i) => {
            const st = slideState[s.id] ?? {};
            return (
              <div key={s.id} className="p-3 sm:p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="relative">
                  <SlidePreview slide={s} index={i + 1} colors={colors} academyName={academyName} />
                  {st.busy && (
                    <div className="absolute inset-0 rounded-xl bg-slate-950/60 flex items-center justify-center gap-2 text-sm text-white">
                      <Loader2 className="w-5 h-5 animate-spin" /> Generando la foto…
                    </div>
                  )}
                  {s.imageUrl && s.imageSource === "lesson" && !st.busy && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow">Foto de la lección · gratis</span>
                  )}
                </div>
                {st.error && <p className="text-xs text-red-400">{st.error}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400 mr-1">#{i + 1}</span>
                  {s.imageUrl ? (
                    <>
                      <input
                        value={st.instruction ?? ""}
                        disabled={locked || st.busy}
                        onChange={(e) => setSlide(s.id, { instruction: e.target.value })}
                        placeholder="¿Qué cambiarías de la foto? Ej.: que sea una chica desayunando"
                        className={`${input} flex-1 min-w-[220px] text-xs`}
                      />
                      <button
                        type="button"
                        onClick={() => photoFor(s, st.instruction)}
                        disabled={locked || st.busy || !(st.instruction ?? "").trim() || credits < PHOTO_CHANGE_CREDITS}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
                      >
                        <Wand2 className="w-3.5 h-3.5" /> Cambiar foto ({PHOTO_CHANGE_CREDITS} cr)
                      </button>
                      <button
                        type="button"
                        onClick={() => photoFor({ ...s, imageUrl: undefined })}
                        disabled={locked || st.busy || credits < PHOTO_CREDITS[s.photo]}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> {s.imageSource === "lesson" ? "Foto con IA" : "Foto nueva"} ({PHOTO_CREDITS[s.photo]} cr)
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => { if (dirty && !(await save(true))) return; await photoFor(scriptRef.current?.slides.find((x) => x.id === s.id) ?? s); }}
                      disabled={locked || st.busy || credits < PHOTO_CREDITS[s.photo]}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
                    >
                      <ImagePlus className="w-3.5 h-3.5" /> Generar la foto ({PHOTO_CREDITS[s.photo]} cr)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setView("edit"); setTimeout(() => document.getElementById(`slide-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
                    disabled={locked}
                    className="ml-auto px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar texto
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <>
      <p className="text-xs text-slate-500">
        Escribe <strong className="text-slate-300">**así**</strong> las palabras que quieres resaltar con el color de tu academia. El texto aparece tal cual en el PowerPoint.
      </p>

      {script.slides.map((s, i) => {
        const st = slideState[s.id] ?? {};
        return (
          <div key={s.id} id={`slide-${s.id}`} className="scroll-mt-6 p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 grid lg:grid-cols-[1fr_240px] gap-5">
            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-400">#{i + 1}</span>
                <select value={s.type} disabled={locked} onChange={(e) => { const type = e.target.value as ScriptSlideType; update(s.id, { type, photo: s.imageUrl ? s.photo : defaultPhotoFor(type) }); }} className={select}>
                  {SLIDE_TYPES.map((t) => <option key={t} value={t}>{SLIDE_TYPE_LABELS[t]}</option>)}
                </select>
                <select value={s.photo} disabled={locked || Boolean(s.imageUrl)} onChange={(e) => update(s.id, { photo: e.target.value as ScriptSlide["photo"] })} className={select} title="Calidad de la foto">
                  <option value="realistic">Foto realista ({PHOTO_CREDITS.realistic} cr)</option>
                  <option value="economic">Foto económica ({PHOTO_CREDITS.economic} cr)</option>
                </select>
                <div className="ml-auto flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={locked || i === 0} className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30" aria-label="Subir"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={locked || i === script.slides.length - 1} className="p-1.5 rounded-lg hover:bg-slate-800 disabled:opacity-30" aria-label="Bajar"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setScript({ ...script, slides: script.slides.filter((x) => x.id !== s.id) })} disabled={locked || script.slides.length <= 1} className="p-1.5 rounded-lg hover:bg-red-600/80 disabled:opacity-30" aria-label="Eliminar"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div>
                <label className={label}>Título</label>
                <input value={s.title} disabled={locked} maxLength={140} onChange={(e) => update(s.id, { title: e.target.value })} className={`${input} font-semibold`} />
              </div>
              <div>
                <label className={label}>{s.type === "reading" ? "Texto de la lectura" : s.type === "exercise" ? "Instrucción" : "Texto"}</label>
                <textarea value={s.text} disabled={locked} maxLength={1600} rows={s.type === "reading" ? 7 : 3} onChange={(e) => update(s.id, { text: e.target.value })} className={`${input} resize-y`} />
              </div>
              <div>
                <label className={label}>{s.type === "reading" ? "Preguntas de comprensión" : s.type === "exercise" ? "Ítems del ejercicio" : "Lista"} (una por línea)</label>
                <textarea
                  value={s.items.join("\n")}
                  disabled={locked}
                  rows={Math.min(8, Math.max(2, s.items.length + 1))}
                  onChange={(e) => update(s.id, { items: e.target.value.split("\n").slice(0, 14) })}
                  onBlur={(e) => update(s.id, { items: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 14) })}
                  className={`${input} resize-y`}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={label}>Foto: qué debe mostrar</label>
                  <textarea value={s.imagePrompt} disabled={locked} maxLength={700} rows={3} onChange={(e) => update(s.id, { imagePrompt: e.target.value })} placeholder="Quién, qué hace, dónde, qué luz" className={`${input} resize-y`} />
                </div>
                <div>
                  <label className={label}>Notas del profesor (respuestas)</label>
                  <textarea value={s.notes} disabled={locked} maxLength={4000} rows={3} onChange={(e) => update(s.id, { notes: e.target.value })} className={`${input} resize-y`} />
                </div>
              </div>
            </div>

            {/* Foto de la diapositiva */}
            <div className="space-y-2">
              <div className={`relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 ${s.type === "cover" ? "aspect-video" : "aspect-[3/4]"}`} style={!s.imageUrl ? { background: `${accent}22` } : undefined}>
                {s.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.imageUrl} alt={s.imagePrompt || s.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 text-xs text-slate-400 gap-2">
                    <Camera className="w-6 h-6 opacity-60" /> Sin foto todavía
                  </div>
                )}
                {s.imageUrl && s.imageSource === "lesson" && !st.busy && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold shadow">De la lección · gratis</span>
                )}
                {st.busy && (
                  <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center gap-2 text-xs text-white">
                    <Loader2 className="w-4 h-4 animate-spin" /> Generando…
                  </div>
                )}
              </div>
              {st.error && <p className="text-[11px] text-red-400">{st.error}</p>}
              {s.imageUrl ? (
                <div className="space-y-1.5">
                  <input
                    value={st.instruction ?? ""}
                    disabled={locked || st.busy}
                    onChange={(e) => setSlide(s.id, { instruction: e.target.value })}
                    placeholder="Ej.: que sea una chica desayunando"
                    className={`${input} text-xs`}
                  />
                  <button
                    type="button"
                    onClick={() => photoFor(s, st.instruction)}
                    disabled={locked || st.busy || !(st.instruction ?? "").trim() || credits < PHOTO_CHANGE_CREDITS}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Cambiar foto ({PHOTO_CHANGE_CREDITS} cr)
                  </button>
                  <button
                    type="button"
                    onClick={() => { update(s.id, { imageUrl: undefined }); setTimeout(() => photoFor({ ...s, imageUrl: undefined }), 0); }}
                    disabled={locked || st.busy || credits < PHOTO_CREDITS[s.photo]}
                    className="w-full px-3 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-white flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> {s.imageSource === "lesson" ? "Generar una foto con IA" : "Otra foto nueva"} ({PHOTO_CREDITS[s.photo]} cr)
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={async () => { if (dirty && !(await save(true))) return; await photoFor(scriptRef.current?.slides.find((x) => x.id === s.id) ?? s); }}
                  disabled={locked || st.busy || credits < PHOTO_CREDITS[s.photo]}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Solo esta foto ({PHOTO_CREDITS[s.photo]} cr)
                </button>
              )}
            </div>
          </div>
        );
      })}

      <button type="button" onClick={addSlide} disabled={locked || script.slides.length >= 30} className="w-full py-3 rounded-2xl border border-dashed border-slate-700 text-sm text-slate-400 hover:text-white hover:border-slate-500 flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> Añadir diapositiva
      </button>
      </>
      )}

      {/* Barra fija: guardar, generar fotos (con el costo) y descargar */}
      <div className="sticky bottom-4 z-20 p-3 sm:p-4 rounded-2xl bg-slate-900 border-2 border-amber-500/50 shadow-2xl flex flex-wrap items-center gap-3">
        <div className="mr-auto text-xs text-slate-300">
          {progress ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-amber-400" /> Generando fotos: {progress.done} de {progress.total}…</span>
          ) : missing ? (
            <span>
              Faltan <strong className="text-white">{missing}</strong> fotos ({counts.realistic} realistas + {counts.economic} económicas) ={" "}
              <strong className="text-amber-300">{pendingCost} créditos</strong> · tienes {credits}
              {fromLesson > 0 && <> · <strong className="text-emerald-400">{fromLesson}</strong> imágenes de la lección (gratis)</>}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Todas las fotos listas{fromLesson > 0 ? ` (${fromLesson} de la lección, gratis)` : ""} · tienes {credits} créditos</span>
          )}
          {message && <p className={`mt-1 ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
          {missing > 0 && pendingCost > credits && (
            <p className="mt-1 text-amber-300 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> No te alcanzan los créditos para todas: cambia algunas a «económica» o recarga créditos.</p>
          )}
        </div>
        {dirty && (
          <button type="button" onClick={() => save()} disabled={busy !== null} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white flex items-center gap-2">
            {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar guion
          </button>
        )}
        {missing > 0 && (
          <button type="button" onClick={generateAll} disabled={busy !== null || pendingCost > credits} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold flex items-center gap-2">
            <Camera className="w-4 h-4" /> Generar {missing} fotos ({pendingCost} créditos)
          </button>
        )}
        <button type="button" onClick={download} disabled={busy !== null} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2">
          {busy === "download" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Descargar PowerPoint
        </button>
      </div>
    </div>
  );
}

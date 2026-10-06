"use client";

import { useEffect, useState } from "react";
import { DialogShell } from "./DialogShell";
import { PRESET_THEMES, brandTheme, SLIDE_H, SLIDE_W, type DeckTheme, type TextDensity } from "@/modules/presentation/presentation.themes";
import { Check, CheckCircle2, FileText, Globe, Loader2, Paperclip, Presentation, Sparkles, Upload, Wand2 } from "lucide-react";

type DesignMode = "preset" | "upload" | "web";
const PREFS_KEY = "academiax:presentation-prefs";

/** Etapas del motor (se muestran mientras se genera; la petición es una sola). */
const STAGES = ["Analizando la clase…", "Diseñando la secuencia de diapositivas…", "Aplicando el diseño…", "Preparando imágenes e iconos…", "Creando diapositivas…", "Validando legibilidad y calidad…"];

interface GenerationSummary {
  slides: number;
  quality: number;
  planner: string;
  warnings: string[];
  fileName: string;
}

const DENSITIES: Array<{ id: TextDensity; label: string; lines: number; cols: number }> = [
  { id: "minimo", label: "Mínimo", lines: 2, cols: 1 },
  { id: "estandar", label: "Estándar", lines: 4, cols: 1 },
  { id: "detallado", label: "Detallado", lines: 4, cols: 2 },
];

export function PresentationWizard({
  lessonId,
  primaryColor,
  hasUnsavedChanges,
  initialFormat,
  onClose,
}: {
  lessonId: string;
  primaryColor: string;
  hasUnsavedChanges?: boolean;
  initialFormat: "pptx" | "pdf";
  onClose: () => void;
}) {
  const themes = [brandTheme(primaryColor.replace("#", "").toUpperCase()), ...PRESET_THEMES];
  const [format, setFormat] = useState<"pptx" | "pdf">(initialFormat);
  const [density, setDensity] = useState<TextDensity>("estandar");
  const [slideCount, setSlideCount] = useState(14);
  const [autoSlides, setAutoSlides] = useState(true);
  const [templateMode, setTemplateMode] = useState<"inspired" | "adapt">("inspired");
  const [stage, setStage] = useState(0);
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  const [quality, setQuality] = useState<"basic" | "ai">("basic");
  const [aiImages, setAiImages] = useState(0);
  const [mode, setMode] = useState<DesignMode>("preset");
  const [preset, setPreset] = useState("marca");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryModel[] | null>(null);

  // Recuerda la última densidad y modelo elegidos por este profesor
  useEffect(() => {
    let saved: { density?: TextDensity; preset?: string; slides?: number; auto?: boolean; templateMode?: "inspired" | "adapt" } = {};
    try {
      saved = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
      if (saved.density) setDensity(saved.density);
      if (saved.slides && saved.slides >= 5 && saved.slides <= 20) setSlideCount(saved.slides);
      if (typeof saved.auto === "boolean") setAutoSlides(saved.auto);
      if (saved.templateMode) setTemplateMode(saved.templateMode);
      if (saved.preset) setPreset(saved.preset);
    } catch {}
    fetch("/api/presentation-models")
      .then((r) => (r.ok ? r.json() : []))
      .then((models: LibraryModel[]) => {
        setLibrary(models);
        if (!saved.preset && models[0]) setPreset(`lib:${models[0].id}`);
      })
      .catch(() => setLibrary([]));
  }, []);

  const isLibraryModel = preset.startsWith("lib:");

  const ready = mode === "preset" || (mode === "upload" && file) || (mode === "web" && /^https:\/\/\S+$/.test(url.trim()));

  // Etapas mientras se genera (la presentación con IA puede tardar 1-2 min)
  useEffect(() => {
    if (!busy) return;
    setStage(0);
    const t = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), quality === "ai" ? 9000 : 1500);
    return () => clearInterval(t);
  }, [busy, quality]);

  async function generate() {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ density, preset, slides: slideCount, auto: autoSlides, templateMode }));
    } catch {}

    const fd = new FormData();
    fd.set("format", format);
    fd.set("density", density);
    fd.set("slides", format === "pptx" && autoSlides ? "auto" : String(slideCount));
    fd.set("templateMode", templateMode);
    fd.set("quality", format === "pptx" ? quality : "basic");
    if (quality === "ai" && format === "pptx") {
      fd.set("imageCount", String(aiImages));
      fd.set("idempotencyKey", crypto.randomUUID());
    }
    fd.set("design", mode);
    fd.set("preset", preset);
    if (mode === "upload" && file) fd.set("file", file);
    if (mode === "web") fd.set("url", url.trim());

    try {
      const res = await fetch(`/api/lessons/${lessonId}/presentation`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No se pudo generar la presentación.");
        return;
      }
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `leccion.${format}`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(href), 5000);
      const qualityScore = Number(res.headers.get("X-Presentation-Quality"));
      if (format === "pptx" && qualityScore) {
        // Motor v2: se muestra el resumen de la generación en lugar de cerrar
        const warnings = res.headers.get("X-Presentation-Warnings");
        setSummary({
          slides: Number(res.headers.get("X-Presentation-Slides")) || 0,
          quality: qualityScore,
          planner: res.headers.get("X-Presentation-Planner") || "heuristic",
          warnings: warnings ? decodeURIComponent(warnings).split(" | ").filter(Boolean) : [],
          fileName: name,
        });
      } else {
        onClose();
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  }

  const label = "block text-sm font-semibold text-slate-200 mb-2";

  return (
    <DialogShell title="Crear presentación" onClose={onClose} size="lg">
      <div className="space-y-7">
        {/* Formato */}
        <div>
          <p className={label}>Formato</p>
          <div className="flex gap-2">
            {([["pptx", "PowerPoint", Presentation], ["pdf", "PDF", FileText]] as const).map(([id, name, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFormat(id)}
                className={`px-4 py-2.5 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-colors ${
                  format === id ? "bg-blue-600/20 border-blue-500 text-blue-100" : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                <Icon className="w-4 h-4" /> {name}
              </button>
            ))}
          </div>
        </div>

        {format === "pdf" ? (
          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
            <p className="font-semibold text-white mb-1">Documento de estudio (A4) · gratis</p>
            <p className="text-sm text-slate-400">
              El PDF no es una copia de las diapositivas: es un documento para imprimir o repartir con portada y ruta de aprendizaje,
              una sección por página con su foto y frase clave, tablas, recuadros de aviso, ejercicios con huecos y la clave de
              respuestas al final de cada sección.
            </p>
          </div>
        ) : (
        <>
        {/* Tipo: básica gratis o inteligente con IA */}
        <div>
          <p className={label}>Tipo de presentación</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setQuality("basic")}
              className={`text-left rounded-xl border p-4 transition-colors ${quality === "basic" ? "bg-blue-600/15 border-blue-500" : "border-slate-700 hover:border-slate-500"}`}
            >
              <span className="flex items-center justify-between">
                <span className="font-bold text-white">Básica</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">GRATIS</span>
              </span>
              <span className="block text-xs text-slate-400 mt-1">Reparte el contenido de la lección en diapositivas: texto, viñetas, imágenes y preguntas con su corrección.</span>
            </button>
            <button
              type="button"
              onClick={() => setQuality("ai")}
              className={`text-left rounded-xl border p-4 transition-colors ${quality === "ai" ? "bg-violet-600/15 border-violet-500" : "border-slate-700 hover:border-slate-500"}`}
            >
              <span className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-violet-300" /> Inteligente con IA</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-200">2 CRÉDITOS</span>
              </span>
              <span className="block text-xs text-slate-400 mt-1">La IA la diseña: índice, tarjetas, tablas, columnas, pasos guiados, debate, quiz con ✓/✕ y relacionar columnas.</span>
            </button>
          </div>
          {quality === "ai" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400 mr-1">Fotos realistas (vocabulario, ejemplos, lectura):</span>
              {[0, 6, 12, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setAiImages(n)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${aiImages === n ? "bg-violet-600/20 border-violet-400 text-violet-100" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}
                >
                  {n === 0 ? "Ninguna" : `${n} (+${n} créditos)`}
                </button>
              ))}
            </div>
          )}
          {quality === "ai" && (
            <p className="text-xs text-slate-500 mt-2">
              La IA planifica la clase como un diseñador instruccional: activación, objetivos, vocabulario visual, comparaciones,
              mapa, actividades y cierre. Si no puede, se usa el planificador interno y se devuelven los créditos.
            </p>
          )}
        </div>

        {/* Número de diapositivas */}
        <div>
          <p className={label}>
            Número de diapositivas <span className="text-red-400">*</span>
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-300 mb-3 cursor-pointer">
            <input type="checkbox" checked={autoSlides} onChange={(e) => setAutoSlides(e.target.checked)} className="accent-blue-500 w-4 h-4" />
            Automático (recomendado): según la cantidad de contenido de la clase
          </label>
          <div className={`flex items-center gap-4 ${autoSlides ? "opacity-40 pointer-events-none" : ""}`}>
            <button
              type="button"
              onClick={() => setSlideCount((n) => Math.max(5, n - 1))}
              disabled={slideCount <= 5}
              className="w-10 h-10 rounded-xl border border-slate-700 text-lg font-bold hover:bg-slate-800 disabled:opacity-40"
              aria-label="Menos diapositivas"
            >
              −
            </button>
            <input
              type="range"
              min={5}
              max={20}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="flex-1 accent-blue-500"
              aria-label="Número de diapositivas"
            />
            <button
              type="button"
              onClick={() => setSlideCount((n) => Math.min(20, n + 1))}
              disabled={slideCount >= 20}
              className="w-10 h-10 rounded-xl border border-slate-700 text-lg font-bold hover:bg-slate-800 disabled:opacity-40"
              aria-label="Más diapositivas"
            >
              +
            </button>
            <span className="w-24 text-center px-3 py-2 rounded-xl bg-blue-600/15 border border-blue-500/40 text-blue-100 font-bold tabular-nums">
              {slideCount} diap.
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {autoSlides
              ? "El motor decide entre 8 y 25 diapositivas según los conceptos, el vocabulario y las actividades de la clase."
              : "Entre 5 y 20, incluida la portada. Si la lección tiene más contenido, se agrupan conceptos sin perder ninguno."}
          </p>
        </div>

        {/* Densidad */}
        <div>
          <p className={label}>Densidad del texto <span className="text-red-400">*</span></p>
          <div className="grid grid-cols-3 gap-3">
            {DENSITIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDensity(d.id)}
                className={`rounded-xl border p-3 flex flex-col items-center gap-2 transition-colors ${
                  density === d.id ? "bg-blue-600/15 border-blue-500 text-blue-200" : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                <div className={`w-20 h-9 grid gap-1.5 ${d.cols === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {Array.from({ length: d.cols }).map((_, c) => (
                    <div key={c} className="flex flex-col justify-center gap-1">
                      {Array.from({ length: d.lines }).map((_, i) => (
                        <span key={i} className={`h-0.5 rounded ${density === d.id ? "bg-blue-400" : "bg-slate-500"}`} style={{ width: i === d.lines - 1 ? "60%" : "100%" }} />
                      ))}
                    </div>
                  ))}
                </div>
                <span className="text-sm font-semibold">{d.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {density === "minimo" && "Ideas clave y letra grande: tú explicas en voz alta."}
            {density === "estandar" && "Equilibrio entre explicación y puntos clave."}
            {density === "detallado" && "Todo el contenido de la lección, ideal para repartir o estudiar."}
          </p>
        </div>

        {/* Diseño */}
        <div>
          <p className={label}>Diseño</p>
          <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 mb-4 text-sm">
            {([["preset", "Modelos", Sparkles], ["upload", "Subir mi modelo", Upload], ["web", "Desde la web", Globe]] as const).map(([id, name, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                className={`px-3.5 py-2 rounded-lg font-medium flex items-center gap-1.5 transition-colors ${mode === id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
              >
                <Icon className="w-4 h-4" /> {name}
              </button>
            ))}
          </div>

          {mode === "preset" && (
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Modelos de la academia</p>
                {library === null ? (
                  <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando modelos…</p>
                ) : library.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay modelos cargados.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <button type="button" onClick={() => setPreset("smart")} className="text-left group">
                      <div className={`relative aspect-video rounded-xl overflow-hidden border-2 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-violet-600/30 via-blue-600/20 to-emerald-500/20 transition-colors ${preset === "smart" ? "border-blue-500" : "border-slate-700 group-hover:border-slate-500"}`}>
                        <Wand2 className="w-6 h-6 text-violet-200" />
                        <span className="text-[11px] text-slate-200 px-3 text-center">Elige el estilo según tu alumnado</span>
                      </div>
                      <p className={`mt-2 text-sm font-semibold flex items-center gap-1.5 ${preset === "smart" ? "text-blue-300" : "text-slate-200"}`}>
                        {preset === "smart" && <Check className="w-4 h-4" />} ✨ Diseño inteligente
                      </p>
                    </button>
                    {library.map((m) => {
                      const id = `lib:${m.id}`;
                      return (
                        <button key={id} type="button" onClick={() => setPreset(id)} className="text-left group">
                          <div className={`relative aspect-video rounded-xl overflow-hidden border-2 bg-slate-800 transition-colors ${preset === id ? "border-blue-500" : "border-slate-700 group-hover:border-slate-500"}`}>
                            <ModelThumbnail model={m} />
                          </div>
                          <p className={`mt-2 text-sm font-semibold flex items-center gap-1.5 ${preset === id ? "text-blue-300" : "text-slate-200"}`}>
                            {preset === id && <Check className="w-4 h-4" />} {m.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {isLibraryModel && format === "pptx" && (
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 flex flex-wrap gap-2">
                  {([
                    ["inspired", "Inspirado en este diseño", "Su estilo (colores, fuentes, fondo, personajes) con diapositivas nuevas y variadas"],
                    ["adapt", "Adaptar diseño original", "Más cerca de la composición original del modelo, empezando por su portada"],
                  ] as const).map(([id, name, hint]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTemplateMode(id)}
                      className={`flex-1 min-w-[220px] text-left rounded-lg border px-3 py-2 transition-colors ${templateMode === id ? "border-blue-500 bg-blue-600/15" : "border-slate-700 hover:border-slate-500"}`}
                    >
                      <span className="text-sm font-semibold text-white flex items-center gap-1.5">
                        {templateMode === id && <Check className="w-3.5 h-3.5 text-blue-300" />} {name}
                        {id === "inspired" && <span className="text-[10px] font-bold text-emerald-300">RECOMENDADO</span>}
                      </span>
                      <span className="block text-[11px] text-slate-400 mt-0.5">{hint}</span>
                    </button>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Diseños básicos</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {themes.map((t) => (
                    <button key={t.id} type="button" onClick={() => setPreset(t.id)} className="text-left group">
                      <ThemePreview theme={t} selected={preset === t.id} />
                      <p className={`mt-2 text-sm font-semibold flex items-center gap-1.5 ${preset === t.id ? "text-blue-300" : "text-slate-200"}`}>
                        {preset === t.id && <Check className="w-4 h-4" />} {t.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}


          {mode === "upload" && (
            <div className="rounded-2xl border border-dashed border-slate-700 p-5">
              <p className="text-sm text-slate-300 mb-1 font-semibold">Adjunta tu modelo</p>
              <p className="text-xs text-slate-500 mb-4">
                Una presentación <strong>.pptx</strong> (por ejemplo, exportada de Canva): analizamos su estilo — colores, tipografías, fondo,
                personajes e ilustraciones — y diseñamos tu clase con esa identidad visual (no se copian sus diapositivas). Máx. 36 MB.
                También vale una <strong>imagen PNG/JPG</strong> de una diapositiva, que se usará como fondo (máx. 12 MB).
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-800">
                <Paperclip className="w-4 h-4" /> {file ? "Cambiar archivo" : "Adjuntar archivo"}
                <input
                  type="file"
                  accept=".pptx,.png,.jpg,.jpeg,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/png,image/jpeg"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {file && <p className="text-xs text-slate-400 mt-2">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
            </div>
          )}

          {mode === "web" && (
            <div className="rounded-2xl border border-slate-700 p-5 space-y-3">
              <p className="text-sm text-slate-300 font-semibold">Replica un modelo que encontraste en internet</p>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://… (imagen de la plantilla, archivo .pptx o página de la plantilla)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500">
                Busca plantillas en sitios como Slidesgo, Canva o Pinterest y pega aquí el enlace. Si es un enlace de descarga de un
                <strong> .pptx</strong>, se usa la plantilla completa; si es una imagen o una página, replicamos su fondo y su color principal.
              </p>
            </div>
          )}
        </div>
        </>
        )}

        {summary && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2">
            <p className="font-semibold text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Presentación descargada: {summary.fileName}
            </p>
            <p className="text-sm text-slate-300">
              {summary.slides} diapositivas · calidad {summary.quality}/100 ·{" "}
              {summary.planner === "llm" ? "planificada con IA" : "planificador pedagógico interno"}
            </p>
            {summary.warnings.map((w) => (
              <p key={w} className="text-xs text-amber-300">• {w}</p>
            ))}
            <p className="text-xs text-slate-400">Las explicaciones completas para ti van en las notas del orador de cada diapositiva.</p>
          </div>
        )}

        {busy && format === "pptx" && (
          <p className="text-sm text-blue-200 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {STAGES[stage]}
          </p>
        )}

        {hasUnsavedChanges && (
          <p className="text-xs text-amber-400">Tienes cambios sin guardar: la presentación usa la última versión guardada.</p>
        )}
        {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">{summary ? "Cerrar" : "Cancelar"}</button>
          <button
            type="button"
            onClick={generate}
            disabled={busy || !ready}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy
              ? quality === "ai" && format === "pptx" ? "La IA está diseñando… (hasta 1–2 min)" : "Generando…"
              : `Crear ${format === "pptx" ? "PowerPoint" : "PDF"}${quality === "ai" && format === "pptx" ? ` · ${2 + aiImages} créditos` : " · gratis"}`}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

interface LibraryModel {
  id: string;
  name: string;
  version: number;
  palette: { background?: string; title?: string; text?: string; font?: string } | null;
}

/** Miniatura real del modelo; si no tiene, una vista previa con su fondo, colores y tipografía. */
function ModelThumbnail({ model }: { model: LibraryModel }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/presentation-models/${model.id}/thumbnail?v=${model.version}`}
        alt={model.name}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  const p = model.palette ?? {};
  return (
    <div className="w-full h-full flex flex-col justify-center px-[10%]" style={{ background: `#${p.background ?? "FFFFFF"}` }}>
      <p className="text-base font-bold leading-tight truncate" style={{ color: `#${p.title ?? "1E293B"}`, fontFamily: p.font ? `"${p.font}", sans-serif` : undefined }}>
        {model.name}
      </p>
      <p className="text-[9px] mt-1" style={{ color: `#${p.text ?? "475569"}` }}>Un subtítulo de ejemplo</p>
    </div>
  );
}

/** Miniatura del modelo: dibuja las mismas decoraciones que la presentación, a escala. */
function ThemePreview({ theme, selected }: { theme: DeckTheme; selected: boolean }) {
  const decos = theme.coverDecorations ?? theme.decorations;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  return (
    <div
      className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-colors ${selected ? "border-blue-500" : "border-slate-700 group-hover:border-slate-500"}`}
      style={{ background: `#${theme.coverBackground ?? theme.background}` }}
    >
      {decos.map((d, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: pct(d.x, SLIDE_W), top: pct(d.y, SLIDE_H), width: pct(d.w, SLIDE_W), height: pct(d.h, SLIDE_H),
            background: `#${d.color}`, opacity: 1 - (d.transparency ?? 0) / 100, borderRadius: d.shape === "ellipse" ? "9999px" : 0,
          }}
        />
      ))}
      <div className="absolute" style={{ left: theme.id === "cuaderno" ? "13%" : "9%", top: "36%", width: "58%" }}>
        <p className="text-[11px] font-bold leading-tight" style={{ color: `#${theme.coverTitle ?? theme.title}` }}>Un gran título aparece aquí</p>
        <p className="text-[6px] mt-1 leading-tight" style={{ color: `#${theme.coverTitle ? "CBD5E1" : theme.text}` }}>
          Un subtítulo para complementar el título
        </p>
      </div>
    </div>
  );
}

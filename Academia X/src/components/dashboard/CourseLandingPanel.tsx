"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone, Sparkles, AlertCircle, CheckCircle2, Trash2, ExternalLink, X, Eye, Monitor, Tablet, Smartphone, ImageIcon, Check, LayoutTemplate,
} from "lucide-react";
import { generateLandingPageAIAction } from "@/app/actions/ai.actions";
import { saveCourseLandingAction, removeCourseLandingAction, generateLandingHeroImageAction } from "@/app/actions/course.actions";
import { LANDING_TEMPLATES, getLandingTemplate, type LandingTemplateId } from "@/components/landing/course-landing/templates";
import { landingDraftKey } from "@/components/landing/course-landing/draft";

export interface CourseLanding {
  template?: LandingTemplateId;
  headline: string;
  subheadline: string;
  benefits: string[];
  callToAction: string;
  audience?: string;
  heroImageUrl?: string;
}

interface CourseLandingPanelProps {
  courseId: string;
  courseTitle: string;
  courseSlug: string;
  tenantSlug: string;
  isPublished: boolean;
  initialLanding: CourseLanding | null;
  /** Color principal de la academia, para las miniaturas de los modelos */
  accent?: string;
}

const DEVICES = [
  { id: "desktop", label: "Ordenador", icon: Monitor, width: "100%" },
  { id: "tablet", label: "Tableta", icon: Tablet, width: "820px" },
  { id: "mobile", label: "Móvil", icon: Smartphone, width: "390px" },
] as const;

const input = "w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-purple-500";
const label = "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2";

export function CourseLandingPanel({
  courseId,
  courseTitle,
  courseSlug,
  tenantSlug,
  isPublished,
  initialLanding,
  accent = "#2563eb",
}: CourseLandingPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [landing, setLanding] = useState<CourseLanding | null>(initialLanding);
  const [draft, setDraft] = useState<CourseLanding | null>(initialLanding);
  // Sin landing todavía: lo primero es elegir el modelo
  const [step, setStep] = useState<"model" | "content">(initialLanding ? "content" : "model");
  const [language, setLanguage] = useState("es");
  const [imagePrompt, setImagePrompt] = useState("");
  const [busy, setBusy] = useState<null | "text" | "image" | "save">(null);
  const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const publicUrl = `/a/${tenantSlug}/courses/${courseSlug}`;
  const template = getLandingTemplate(draft?.template);

  // La vista previa (otra pestaña / iframe) lee el borrador del navegador
  useEffect(() => {
    if (!draft) return;
    try {
      localStorage.setItem(landingDraftKey(courseId), JSON.stringify(draft));
    } catch {
      // Sin almacenamiento: la vista previa mostrará la versión publicada
    }
  }, [draft, courseId]);

  function chooseTemplate(id: LandingTemplateId) {
    setDraft((d) => d ? { ...d, template: id } : { template: id, headline: courseTitle, subheadline: "", benefits: [], callToAction: "Inscribirme en el curso", audience: "", heroImageUrl: "" });
    setStep("content");
    if (id === "portada" && !imagePrompt) setImagePrompt(`Estudiantes jóvenes aprendiendo juntos en un aula luminosa y moderna, relacionado con: ${courseTitle}`);
  }

  async function generateText() {
    if (!draft) return;
    setBusy("text");
    setMessage(null);
    const formData = new FormData();
    formData.set("courseTitle", courseTitle);
    formData.set("targetAudience", draft.audience || "");
    formData.set("language", language);
    formData.set("clientRequestId", `${courseId}-landing-${Date.now()}`);

    const res = await generateLandingPageAIAction(formData);
    setBusy(null);
    if (!res.success) {
      setMessage({ type: "error", text: res.error || "No se pudo generar la landing." });
      return;
    }
    const l = res.landing as CourseLanding;
    setDraft({ ...draft, headline: l.headline, subheadline: l.subheadline, benefits: l.benefits || [], callToAction: l.callToAction || "Inscríbete ahora" });
    setMessage({ type: "success", text: "Textos generados. Revísalos, mira la vista previa y publica." });
  }

  async function generateImage() {
    if (!draft) return;
    setBusy("image");
    setMessage(null);
    const res = await generateLandingHeroImageAction(courseId, imagePrompt);
    setBusy(null);
    if (!res.success) {
      setMessage({ type: "error", text: res.error });
      return;
    }
    setDraft({ ...draft, heroImageUrl: res.url });
    setMessage({ type: "success", text: "Imagen de portada lista. Mírala en la vista previa." });
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    setMessage(null);
    const res = await saveCourseLandingAction(courseId, draft);
    setBusy(null);
    if (res.success) {
      setLanding(draft);
      setMessage({ type: "success", text: "Landing publicada en la página del curso." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo guardar." });
    }
  }

  async function remove() {
    setBusy("save");
    const res = await removeCourseLandingAction(courseId);
    setBusy(null);
    if (res.success) {
      setLanding(null);
      setDraft(null);
      setStep("model");
      try {
        localStorage.removeItem(landingDraftKey(courseId));
      } catch {
        // nada que limpiar
      }
      setMessage({ type: "success", text: "Landing retirada." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo quitar." });
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30"
      >
        <Megaphone className="w-4 h-4" />
        {landing ? "Editar landing" : "Crear landing"}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4">
      <div className="w-full max-w-4xl my-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-purple-400" /> Landing de venta del curso
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {step === "model" ? "Paso 1 de 2 · Elige el modelo de tu landing." : "Paso 2 de 2 · Contenido, imagen y vista previa."}
            </p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white" aria-label="Cerrar">
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
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{message.text}</span>
          </div>
        )}

        {step === "model" ? (
          /* Paso 1: modelo */
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {LANDING_TEMPLATES.map((t) => {
                const selected = draft?.template === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => chooseTemplate(t.id)}
                    className={`rounded-2xl overflow-hidden border text-left transition-all hover:-translate-y-0.5 ${selected ? "border-purple-500 ring-2 ring-purple-500/40" : "border-slate-800 hover:border-slate-600"}`}
                  >
                    <div className="h-28 relative" style={{ background: t.thumb(accent) }}>
                      {/* Boceto del titular y el botón */}
                      <div className={`absolute inset-x-5 top-8 space-y-2 ${t.heroAlign === "center" ? "flex flex-col items-center" : ""}`}>
                        <div className="h-2.5 w-3/4 rounded-full bg-white/80 mix-blend-difference" />
                        <div className="h-2.5 w-1/2 rounded-full bg-white/60 mix-blend-difference" />
                        <div className="h-4 w-16 rounded-md bg-white/90 mt-3" />
                      </div>
                      {selected && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                    <div className="p-3 bg-slate-950">
                      <p className="text-sm font-bold text-white">{t.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{t.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          draft && (
            /* Paso 2: contenido */
            <div className="p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-8 rounded-lg shrink-0" style={{ background: template.thumb(accent) }} />
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Modelo</p>
                    <p className="text-sm font-bold text-white">{template.name}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setStep("model")} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5">
                  <LayoutTemplate className="w-3.5 h-3.5" /> Cambiar modelo
                </button>
              </div>

              {/* Textos con IA */}
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                <div className="grid sm:grid-cols-[1fr_160px] gap-3">
                  <div>
                    <label className={label}>¿A quién va dirigido?</label>
                    <textarea
                      value={draft.audience || ""}
                      onChange={(e) => setDraft({ ...draft, audience: e.target.value })}
                      rows={2}
                      maxLength={1000}
                      placeholder="Ej: jóvenes de 12 años que empiezan a aprender español"
                      className={input}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Se muestra en la landing como «¿A quién está dirigido?» y orienta a la IA.</p>
                  </div>
                  <div>
                    <label className={label}>Idioma</label>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)} className={input}>
                      <option value="es">Español</option>
                      <option value="en">Inglés</option>
                      <option value="fr">Francés</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={generateText}
                  disabled={busy !== null}
                  className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold transition-colors flex items-center gap-2"
                >
                  {busy === "text" ? (
                    <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Generando...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> {draft.subheadline ? "Generar otros textos" : "Escribir los textos con IA"} (8 créditos)</>
                  )}
                </button>
              </div>

              {/* Imagen de portada */}
              {template.usesImage && (
                <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <label className={label}>Imagen de portada</label>
                  {draft.heroImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.heroImageUrl} alt="Portada" className="w-full max-h-52 object-cover rounded-xl border border-slate-800" />
                  )}
                  <textarea value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value)} rows={2} maxLength={500} placeholder="Describe la foto de portada" className={input} />
                  <button
                    type="button"
                    onClick={generateImage}
                    disabled={busy !== null || imagePrompt.trim().length < 5}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2"
                  >
                    {busy === "image" ? (
                      <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Generando imagen...</>
                    ) : (
                      <><ImageIcon className="w-4 h-4" /> {draft.heroImageUrl ? "Generar otra imagen" : "Generar imagen con IA"} (1 crédito)</>
                    )}
                  </button>
                </div>
              )}

              <div>
                <label className={label}>Titular</label>
                <input type="text" value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} maxLength={200} className={`${input} font-bold`} />
              </div>

              <div>
                <label className={label}>Subtítulo</label>
                <textarea value={draft.subheadline} onChange={(e) => setDraft({ ...draft, subheadline: e.target.value })} rows={2} maxLength={500} className={input} />
              </div>

              <div>
                <label className={label}>Beneficios</label>
                <div className="space-y-2">
                  {draft.benefits.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={b}
                        onChange={(e) => {
                          const next = [...draft.benefits];
                          next[i] = e.target.value;
                          setDraft({ ...draft, benefits: next });
                        }}
                        maxLength={300}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setDraft({ ...draft, benefits: draft.benefits.filter((_, idx) => idx !== i) })}
                        className="px-3 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400"
                        aria-label="Quitar beneficio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {draft.benefits.length < 10 && (
                    <button type="button" onClick={() => setDraft({ ...draft, benefits: [...draft.benefits, ""] })} className="text-xs text-purple-400 hover:text-purple-300 font-semibold">
                      + Añadir beneficio
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className={label}>Texto del botón</label>
                <input type="text" value={draft.callToAction} onChange={(e) => setDraft({ ...draft, callToAction: e.target.value })} maxLength={120} className={input} />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPreview(true)}
                  className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Vista previa
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={busy !== null || draft.headline.trim().length < 3}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-colors"
                >
                  {busy === "save" ? "Guardando..." : "Publicar landing"}
                </button>
                {landing && (
                  <button type="button" onClick={remove} disabled={busy !== null} className="px-5 py-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-400 text-sm font-semibold border border-red-500/30">
                    Quitar landing
                  </button>
                )}
                {isPublished && landing && (
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" /> Ver página pública
                  </a>
                )}
              </div>

              {!isPublished && (
                <p className="text-xs text-amber-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  El curso está en borrador: la landing no será visible hasta que lo publiques.
                </p>
              )}
            </div>
          )
        )}
      </div>

      {/* Vista previa a pantalla completa */}
      {preview && (
        <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col">
          <div className="h-14 shrink-0 px-4 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900">
            <span className="text-sm text-slate-300 flex items-center gap-2">
              <Eye className="w-4 h-4" /> <span className="hidden sm:inline">Vista previa ·</span> {template.name}
            </span>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-slate-800">
              {DEVICES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDevice(d.id)}
                  title={d.label}
                  aria-label={d.label}
                  className={`p-2 rounded-lg ${device === d.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <d.icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setPreview(false)} className="text-sm text-white font-semibold flex items-center gap-1.5 hover:text-slate-300">
              Cerrar vista previa <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto bg-slate-800/60 flex justify-center p-0 sm:p-4">
            <iframe
              title="Vista previa de la landing"
              src={`/vista-previa/landing/${courseId}`}
              className="h-full bg-white shadow-2xl transition-[width] duration-300 rounded-none sm:rounded-xl"
              style={{ width: DEVICES.find((d) => d.id === device)!.width, maxWidth: "100%" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

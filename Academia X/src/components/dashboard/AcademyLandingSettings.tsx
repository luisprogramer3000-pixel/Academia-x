"use client";

import { useState } from "react";
import { Check, ExternalLink, Layout, Loader2, Monitor, Smartphone, X } from "lucide-react";
import { LANDING_TEMPLATES } from "@/components/landing/course-landing/templates";
import { AcademyLandingView, type AcademyLandingCourse } from "@/components/landing/academy-landing/AcademyLandingView";
import { LessonImagePicker } from "./LessonImagePicker";
import { saveAcademyLandingAction } from "@/app/actions/academy.actions";

interface Landing {
  template: string;
  headline: string;
  subheadline: string;
  callToAction: string;
  heroImageUrl: string;
}

const input = "w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-blue-500";
const label = "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2";

/**
 * Diseño de la página pública de la academia: los mismos modelos que las
 * landings de curso, textos propios y vista previa en vivo (ordenador / móvil).
 */
export function AcademyLandingSettings({
  initial,
  academy,
  courses,
  publicUrl,
}: {
  initial: Landing;
  academy: { name: string; primaryColor: string; secondaryColor?: string | null; logoUrl?: string | null; host: string };
  courses: AcademyLandingCourse[];
  publicUrl: string;
}) {
  const [draft, setDraft] = useState<Landing>(initial);
  const [saved, setSaved] = useState<Landing>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const accent = academy.primaryColor || "#2563eb";
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch: Partial<Landing>) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await saveAcademyLandingAction(draft);
    setBusy(false);
    if (!res.success) return setMessage({ ok: false, text: res.error });
    setSaved(draft);
    setMessage({ ok: true, text: "Página publicada." });
  }

  const template = LANDING_TEMPLATES.find((t) => t.id === draft.template);

  return (
    <section id="pagina-publica" className="mt-10 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 scroll-mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layout className="w-5 h-5 text-blue-400" /> Página pública de la academia
          </h2>
          <p className="text-xs text-slate-400 mt-1">Elige el diseño de tu página principal (los mismos modelos de las landings de curso) y personaliza sus textos.</p>
        </div>
        <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 flex items-center gap-1.5">
          Ver página pública <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Modelos */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {LANDING_TEMPLATES.map((t) => {
          const selected = draft.template === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ template: t.id })}
              className={`rounded-2xl overflow-hidden border text-left transition-all hover:-translate-y-0.5 ${selected ? "border-blue-500 ring-2 ring-blue-500/40" : "border-slate-800 hover:border-slate-600"}`}
            >
              <div className="h-20 relative" style={{ background: t.thumb(accent) }}>
                <div className={`absolute inset-x-4 top-5 space-y-1.5 ${t.heroAlign === "center" ? "flex flex-col items-center" : ""}`}>
                  <div className="h-2 w-3/4 rounded-full bg-white/80 mix-blend-difference" />
                  <div className="h-2 w-1/2 rounded-full bg-white/60 mix-blend-difference" />
                  <div className="h-3 w-12 rounded-md bg-white/90 mt-2" />
                </div>
                {selected && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </span>
                )}
              </div>
              <div className="p-3 bg-slate-950">
                <p className="text-sm font-bold text-white">{t.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Textos */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={label}>Titular</label>
          <input value={draft.headline} onChange={(e) => set({ headline: e.target.value })} maxLength={120} placeholder="Formación de excelencia en enseñanza de idiomas" className={input} />
        </div>
        <div className="md:col-span-2">
          <label className={label}>Subtítulo</label>
          <textarea value={draft.subheadline} onChange={(e) => set({ subheadline: e.target.value })} maxLength={300} rows={2} placeholder={`Bienvenido a la página oficial de ${academy.name}…`} className={`${input} resize-none`} />
        </div>
        <div>
          <label className={label}>Texto del botón principal</label>
          <input value={draft.callToAction} onChange={(e) => set({ callToAction: e.target.value })} maxLength={40} placeholder="Ver cursos" className={input} />
        </div>
        <div>
          <label className={label}>Imagen de portada {template?.usesImage ? "" : <span className="normal-case font-normal text-slate-500">(modelo “Con imagen”)</span>}</label>
          {draft.heroImageUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={draft.heroImageUrl} alt="Portada" className="h-14 w-24 rounded-lg object-cover" />
              <button type="button" onClick={() => set({ heroImageUrl: "" })} className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Quitar
              </button>
            </div>
          ) : (
            <LessonImagePicker compact onPick={(img) => set({ heroImageUrl: img.url })} />
          )}
          {!draft.heroImageUrl && <p className="text-[11px] text-slate-500 mt-1">Sin imagen se usa la portada de tu primer curso.</p>}
        </div>
      </div>

      {/* Vista previa */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={label}>Vista previa</p>
          <div className="inline-flex p-1 rounded-lg bg-slate-950 border border-slate-800">
            {([["desktop", Monitor], ["mobile", Smartphone]] as const).map(([id, Icon]) => (
              <button key={id} type="button" onClick={() => setDevice(id)} className={`px-2.5 py-1 rounded-md ${device === id ? "bg-blue-600 text-white" : "text-slate-400"}`} aria-label={id === "desktop" ? "Ordenador" : "Móvil"}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 overflow-hidden">
          <div className="mx-auto overflow-hidden rounded-xl transition-all" style={{ width: device === "desktop" ? "100%" : 390, maxHeight: 520, overflowY: "auto" }}>
            {/* Escala de la vista de ordenador para que quepa en el panel */}
            <div style={device === "desktop" ? { zoom: 0.6 } : undefined} className="pointer-events-none select-none">
              <AcademyLandingView
                landing={draft}
                academy={academy}
                courses={courses}
                links={{ login: "#", join: "#" }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {message && <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
        {dirty && <button type="button" onClick={() => setDraft(saved)} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">Descartar cambios</button>}
        <button type="button" onClick={save} disabled={busy || !dirty} className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Publicar página
        </button>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { ClassPlanMaterial, ClassPlanOutput } from "@/modules/ai/class-plan.schema";
import { KIND_META, MaterialContent } from "./MaterialContent";
import {
  ChevronLeft, ChevronRight, ChevronUp, Clock, Download, Eye, Play, RefreshCw, Target, X,
} from "lucide-react";

const PHASE_COLORS = ["#4f7cf7", "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];

export function ClassPlanView({
  plan,
  onReset,
  toolbar,
  notice,
}: {
  plan: ClassPlanOutput;
  onReset?: () => void;
  toolbar?: ReactNode;
  notice?: ReactNode;
}) {
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const materialsById = useMemo(() => new Map(plan.materials.map((m) => [m.id, m])), [plan.materials]);
  // Orden de materiales según aparecen en los momentos, para navegar anterior/siguiente
  const orderedMaterials = useMemo(() => {
    const ids = plan.moments.flatMap((m) => m.materialIds);
    return [...new Set(ids)].map((id) => materialsById.get(id)).filter(Boolean) as ClassPlanMaterial[];
  }, [plan.moments, materialsById]);

  const totalMinutes = plan.moments.reduce((a, m) => a + m.minutes, 0) || plan.durationMinutes;

  return (
    <div className="pb-16">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <h1 className="text-3xl font-extrabold text-white">{plan.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {onReset ? (
            <button onClick={onReset} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Nuevo plan
            </button>
          ) : (
            <Link href="/dashboard/class-plan" className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Nuevo plan
            </Link>
          )}
          {toolbar}
          <button onClick={() => setPresenting(true)} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2">
            <Play className="w-4 h-4" /> Presentar
          </button>
          <button onClick={() => window.print()} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20">
            <Download className="w-4 h-4" /> Descargar plan de clase
          </button>
        </div>
      </div>

      {notice && <div className="max-w-4xl mx-auto mb-4 print:hidden">{notice}</div>}

      <div id="class-plan-print" className="max-w-4xl mx-auto bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-xl">
        {/* Cabecera del plan con línea de tiempo */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5">
            <div className="shrink-0">
              <p className="text-xl font-bold text-slate-900">Mi plan de clase</p>
              <p className="text-sm text-slate-500">
                {plan.durationMinutes} min · {plan.moments.length} momentos · {plan.materials.length} materiales
              </p>
            </div>
            <div className="flex-1 flex gap-1 min-w-0">
              {plan.moments.map((m, i) => (
                <a key={i} href={`#moment-${i}`} className="min-w-0 group" style={{ flexGrow: Math.max(m.minutes, totalMinutes * 0.08), flexBasis: 0, opacity: m.minutes ? 1 : 0.55 }}>
                  <div className="h-2.5 rounded-full group-hover:opacity-80" style={{ background: PHASE_COLORS[i % PHASE_COLORS.length] }} />
                  <p className="text-[11px] text-slate-500 mt-1 truncate">{m.minutes ? `${m.minutes}'` : "Antes"} {m.phase}</p>
                </a>
              ))}
            </div>
            <button onClick={() => setCollapsed((v) => !v)} className="hidden lg:flex p-2 rounded-lg border border-slate-200 hover:bg-slate-50 print:hidden" title={collapsed ? "Expandir" : "Contraer"}>
              <ChevronUp className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Metodología: {plan.methodology.split(":")[0]} · Tiempo total planificado: {totalMinutes} min
          </p>
        </div>

        {!collapsed && (
          <div className="p-6 space-y-10">
            {/* Objetivos y competencias */}
            <div className="rounded-xl bg-slate-100 p-5">
              <p className="flex items-center gap-2 text-sm font-bold tracking-wide text-blue-600 uppercase mb-3">
                <Target className="w-4 h-4" /> Objetivos de aprendizaje
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-[15px] text-slate-700">
                {plan.objectives.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
              {plan.competencies.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {plan.competencies.map((c, i) => (
                    <span key={i} className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-600">
                      {c.code && <strong className="mr-1">{c.code}</strong>}{c.description}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Momentos */}
            {plan.moments.map((moment, i) => {
              const color = PHASE_COLORS[i % PHASE_COLORS.length];
              const mats = moment.materialIds.map((id) => materialsById.get(id)).filter(Boolean) as ClassPlanMaterial[];
              return (
                <section key={i} id={`moment-${i}`} className="scroll-mt-6">
                  <div className="flex items-start justify-between gap-4 pl-4 border-l-4 mb-5" style={{ borderColor: color }}>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide" style={{ color }}>{moment.phase}</p>
                      <h2 className="text-2xl font-bold text-slate-900">{moment.title}</h2>
                    </div>
                    <span className="shrink-0 flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-600">
                      <Clock className="w-3.5 h-3.5" /> {moment.minutes ? `${moment.minutes} min` : "Antes de clase"}
                    </span>
                  </div>

                  <div className={mats.length ? "grid md:grid-cols-[1fr_280px] gap-6" : ""}>
                    <div className="space-y-3 text-[15px] leading-relaxed text-slate-700">
                      {moment.guide.map((g, gi) => <p key={gi} dangerouslySetInnerHTML={{ __html: emphasizeQuotes(g) }} />)}
                      {moment.steps.length > 0 && (
                        <ul className="list-disc pl-6 space-y-1.5 pt-1">
                          {moment.steps.map((s, si) => (
                            <li key={si}>
                              <strong>{s.label}{s.minutes ? ` (${s.minutes} min)` : ""}:</strong> {s.text}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {mats.length > 0 && (
                      <div className="space-y-4 print:hidden">
                        {mats.map((m) => (
                          <MaterialCard key={m.id} material={m} onOpen={() => setOpenMaterialId(m.id)} />
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}

            {/* Anexo impreso con todos los materiales */}
            <div className="hidden print:block">
              {orderedMaterials.map((m, i) => (
                <div key={m.id} style={{ pageBreakBefore: "always" }}>
                  <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    Material {i + 1} de {orderedMaterials.length} · {KIND_META[m.kind].label}
                  </p>
                  <h2 className="text-2xl font-bold text-slate-900 mb-1">{m.title}</h2>
                  {m.description && <p className="text-slate-500 mb-5">{m.description}</p>}
                  <MaterialContent material={m} printMode />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {openMaterialId && (
        <MaterialViewer
          plan={plan}
          ordered={orderedMaterials}
          currentId={openMaterialId}
          onNavigate={setOpenMaterialId}
          onClose={() => setOpenMaterialId(null)}
        />
      )}

      {presenting && <PresentMode plan={plan} materials={orderedMaterials} onClose={() => setPresenting(false)} />}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #class-plan-print, #class-plan-print * { visibility: visible; }
          #class-plan-print { position: absolute; left: 0; top: 0; width: 100%; max-width: none; border: none; box-shadow: none; border-radius: 0; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>
    </div>
  );
}

/** Escapa HTML y pone en negrita lo que va entre comillas (preguntas para la clase). */
function emphasizeQuotes(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/(["“«][^"”»]{3,}["”»])/g, '<strong class="text-slate-900">$1</strong>');
}

function MaterialCard({ material, onOpen }: { material: ClassPlanMaterial; onOpen: () => void }) {
  const meta = KIND_META[material.kind];
  return (
    <button onClick={onOpen} className="w-full text-left rounded-2xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all group">
      <div className={`${meta.tint} h-32 flex items-center justify-center relative`}>
        <span className="text-5xl group-hover:scale-110 transition-transform">{meta.emoji}</span>
        <span className="absolute top-2 right-2 p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500">
          <Eye className="w-4 h-4" />
        </span>
      </div>
      <div className="p-4">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.chip}`}>{meta.label}</span>
        <p className="font-semibold text-slate-900 mt-2">{material.title}</p>
      </div>
    </button>
  );
}

function MaterialViewer({
  plan,
  ordered,
  currentId,
  onNavigate,
  onClose,
}: {
  plan: ClassPlanOutput;
  ordered: ClassPlanMaterial[];
  currentId: string;
  onNavigate: (id: string) => void;
  onClose: () => void;
}) {
  const idx = ordered.findIndex((m) => m.id === currentId);
  const material = ordered[idx];
  const prev = ordered[idx - 1];
  const next = ordered[idx + 1];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!material) return null;
  const meta = KIND_META[material.kind];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 print:hidden" onClick={onClose}>
      <div className="bg-white text-slate-800 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {plan.title} · Material {idx + 1} de {ordered.length}
            </p>
            <h2 className="text-xl font-bold text-slate-900">{material.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 overflow-y-auto p-6 md:p-10">
            <div className="max-w-3xl mx-auto">
              <MaterialContent key={material.id} material={material} />
            </div>
          </div>

          <aside className="hidden md:flex w-72 border-l border-slate-200 flex-col overflow-y-auto">
            <div className="p-5 border-b border-slate-100">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.chip}`}>{meta.emoji} {meta.label}</span>
              <p className="font-bold text-slate-900 mt-2">{material.title}</p>
              {material.description && <p className="text-sm text-slate-500 mt-1">{material.description}</p>}
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Momentos de la clase</p>
              {plan.moments.map((mo, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold uppercase text-blue-600 mb-1">{mo.phase}</p>
                  {mo.materialIds.length === 0 && <p className="text-xs text-slate-400">Sin materiales</p>}
                  {mo.materialIds.map((id) => {
                    const m = ordered.find((x) => x.id === id);
                    if (!m) return null;
                    return (
                      <button
                        key={id}
                        onClick={() => onNavigate(id)}
                        className={`w-full text-left text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${
                          id === currentId ? "border border-blue-400 bg-blue-50 font-semibold" : "hover:bg-slate-50"
                        }`}
                      >
                        <span>{KIND_META[m.kind].emoji}</span> {m.title}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>
        </div>

        <div className="grid grid-cols-2 gap-4 p-4 border-t border-slate-200">
          {prev ? (
            <button onClick={() => onNavigate(prev.id)} className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center gap-3">
              <ChevronLeft className="w-4 h-4 text-slate-400" />
              <span>
                <span className="block text-xs uppercase text-slate-400">Anterior · {KIND_META[prev.kind].label}</span>
                <span className="block font-semibold text-slate-900">{prev.title}</span>
              </span>
            </button>
          ) : <span />}
          {next ? (
            <button onClick={() => onNavigate(next.id)} className="text-left px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-between gap-3">
              <span>
                <span className="block text-xs uppercase text-slate-400">Siguiente · {KIND_META[next.kind].label}</span>
                <span className="block font-semibold text-slate-900">{next.title}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          ) : <span />}
        </div>
      </div>
    </div>
  );
}

// ─── Modo presentación ───────────────────────────────────────────────────────

type Slide =
  | { kind: "cover" }
  | { kind: "objectives" }
  | { kind: "moment"; index: number }
  | { kind: "section"; material: ClassPlanMaterial; index: number }
  | { kind: "question"; material: ClassPlanMaterial; index: number }
  | { kind: "cards"; material: ClassPlanMaterial };

function PresentMode({ plan, materials, onClose }: { plan: ClassPlanOutput; materials: ClassPlanMaterial[]; onClose: () => void }) {
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [{ kind: "cover" }, { kind: "objectives" }];
    plan.moments.forEach((mo, mi) => {
      list.push({ kind: "moment", index: mi });
      mo.materialIds.forEach((id) => {
        const m = materials.find((x) => x.id === id);
        if (!m) return;
        m.sections.forEach((_, si) => list.push({ kind: "section", material: m, index: si }));
        m.questions.forEach((_, qi) => list.push({ kind: "question", material: m, index: qi }));
        if (m.cards.length) list.push({ kind: "cards", material: m });
      });
    });
    return list;
  }, [plan, materials]);

  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") { setI((v) => Math.min(v + 1, slides.length - 1)); setReveal(false); }
      if (e.key === "ArrowLeft") { setI((v) => Math.max(v - 1, 0)); setReveal(false); }
    }
    window.addEventListener("keydown", onKey);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      window.removeEventListener("keydown", onKey);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [slides.length, onClose]);

  const slide = slides[i];

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 text-white flex flex-col print:hidden">
      <div className="flex items-center justify-between px-6 py-3 text-sm text-slate-400">
        <span>{plan.title}</span>
        <span>{i + 1} / {slides.length}</span>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 flex items-center justify-center px-8 md:px-20 overflow-y-auto">
        <div className="w-full max-w-5xl">
          {slide.kind === "cover" && (
            <div className="text-center">
              <p className="text-blue-400 font-semibold uppercase tracking-widest mb-4">{plan.durationMinutes} minutos · {plan.moments.length} momentos</p>
              <h1 className="text-5xl md:text-7xl font-black leading-tight">{plan.title}</h1>
              {plan.summary && <p className="text-xl md:text-2xl text-slate-400 mt-6">{plan.summary}</p>}
            </div>
          )}
          {slide.kind === "objectives" && (
            <div>
              <h2 className="text-4xl md:text-5xl font-black mb-8 flex items-center gap-4"><Target className="w-10 h-10 text-blue-400" /> Objetivos</h2>
              <ul className="space-y-5 text-2xl md:text-3xl text-slate-200">
                {plan.objectives.map((o, oi) => <li key={oi} className="flex gap-4"><span className="text-blue-400 font-black">{oi + 1}.</span>{o}</li>)}
              </ul>
            </div>
          )}
          {slide.kind === "moment" && (() => {
            const mo = plan.moments[slide.index];
            return (
              <div>
                <p className="text-2xl font-semibold uppercase tracking-widest" style={{ color: PHASE_COLORS[slide.index % PHASE_COLORS.length] }}>
                  {mo.phase} · {mo.minutes} min
                </p>
                <h2 className="text-5xl md:text-6xl font-black mt-3 mb-10">{mo.title}</h2>
                <ul className="space-y-4 text-2xl text-slate-300">
                  {mo.steps.map((s, si) => <li key={si}>• {s.text}</li>)}
                </ul>
              </div>
            );
          })()}
          {slide.kind === "section" && (() => {
            const s = slide.material.sections[slide.index];
            return (
              <div>
                <p className="text-lg text-slate-400 mb-2">{KIND_META[slide.material.kind].emoji} {slide.material.title}</p>
                <h2 className="text-4xl md:text-5xl font-black mb-6">{s.heading}</h2>
                {s.body && <p className="text-2xl leading-relaxed text-slate-200 whitespace-pre-line">{s.body}</p>}
                {s.bullets.length > 0 && (
                  <ul className="mt-6 space-y-3 text-2xl text-slate-300">
                    {s.bullets.map((b, bi) => <li key={bi}>• {b}</li>)}
                  </ul>
                )}
              </div>
            );
          })()}
          {slide.kind === "question" && (() => {
            const q = slide.material.questions[slide.index];
            return (
              <div>
                <p className="text-lg text-slate-400 mb-2">{KIND_META[slide.material.kind].emoji} {slide.material.title} · Pregunta {slide.index + 1}</p>
                <h2 className="text-3xl md:text-4xl font-bold leading-snug mb-8 whitespace-pre-line">{q.prompt}</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {q.options.map((o, oi) => (
                    <div
                      key={oi}
                      className={`px-6 py-5 rounded-2xl text-2xl font-semibold border-2 ${
                        reveal && oi === q.correctIndex ? "border-emerald-400 bg-emerald-500/20" : "border-slate-700 bg-slate-900"
                      }`}
                    >
                      <span className="text-slate-500 mr-3">{"ABCDEFGH"[oi]}</span>{o}
                    </div>
                  ))}
                </div>
                {reveal && q.options.length === 0 && q.answer && <p className="mt-6 text-2xl text-emerald-300">{q.answer}</p>}
                {reveal && q.explanation && <p className="mt-6 text-xl text-slate-400">{q.explanation}</p>}
                {!reveal && (
                  <button onClick={() => setReveal(true)} className="mt-8 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-lg font-bold">
                    Mostrar respuesta
                  </button>
                )}
              </div>
            );
          })()}
          {slide.kind === "cards" && (
            <div>
              <h2 className="text-4xl font-black mb-8">🃏 {slide.material.title}</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {slide.material.cards.map((c, ci) => (
                  <div key={ci} className="rounded-2xl bg-slate-900 border border-slate-700 p-5">
                    <p className="text-2xl font-bold">{c.front}</p>
                    {reveal && <p className="text-lg text-slate-400 mt-2">{c.back}</p>}
                  </div>
                ))}
              </div>
              {!reveal && (
                <button onClick={() => setReveal(true)} className="mt-8 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-lg font-bold">
                  Mostrar respuestas
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => { setI((v) => Math.max(v - 1, 0)); setReveal(false); }}
          disabled={i === 0}
          className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 mx-6 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
        </div>
        <button
          onClick={() => { setI((v) => Math.min(v + 1, slides.length - 1)); setReveal(false); }}
          disabled={i === slides.length - 1}
          className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

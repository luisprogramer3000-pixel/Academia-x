"use client";

import { useState } from "react";
import {
  Bot, Sparkles, AlertCircle, X, Target, ListChecks, Brain, Dumbbell,
  HelpCircle, Clock, ImageIcon, NotebookPen,
} from "lucide-react";
import { generateFullClassAIAction } from "@/app/actions/ai.actions";
import { MindMapView } from "@/components/shared/MindMapView";
import type { LessonBlock } from "./LessonBlockEditor";

interface ClassAgentWizardProps {
  lessonId: string;
  lessonTitle: string;
  onApply: (blocks: LessonBlock[], teacherPlan: TeacherPlan) => void;
}

export interface TeacherPlan {
  objective: string;
  prerequisites: string[];
  classFlow: Array<{ minute: number; durationMinutes: number; activity: string }>;
  homework: string;
  teacherNotes: string[];
}

interface AgentResult {
  lessonTitle: string;
  objective: string;
  prerequisites: string[];
  keyConcepts: Array<{ term: string; definition: string; example: string }>;
  explanation: string;
  mindMap: { center: string; branches: Array<{ label: string; children: string[] }> };
  examples: string[];
  exercises: Array<{ instruction: string; type: string; solution: string }>;
  quiz: Array<{ question: string; options: string[]; correctAnswerIndex: number; explanation: string }>;
  classFlow: Array<{ minute: number; durationMinutes: number; activity: string }>;
  homework: string;
  teacherNotes: string[];
  images: Array<{ purpose: string; prompt: string; altText: string; url?: string }>;
  imagesGenerated: number;
  imageErrors: string[];
}

const CLASS_CREDITS = 6;
const IMAGE_CREDITS = { standard: 1, hq: 2 };

function newId() {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function ClassAgentWizard({ lessonId, lessonTitle, onApply }: ClassAgentWizardProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentResult | null>(null);

  const [topic, setTopic] = useState(lessonTitle);
  const [level, setLevel] = useState("B1");
  const [language, setLanguage] = useState("es");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [methodology, setMethodology] = useState("");
  const [imageCount, setImageCount] = useState(2);
  const [imageQuality, setImageQuality] = useState<"standard" | "hq">("standard");

  const totalCredits = CLASS_CREDITS + imageCount * IMAGE_CREDITS[imageQuality];

  async function generate() {
    setBusy(true);
    setError(null);

    const formData = new FormData();
    formData.set("lessonId", lessonId);
    formData.set("topic", topic);
    formData.set("level", level);
    formData.set("language", language);
    formData.set("durationMinutes", String(durationMinutes));
    formData.set("audience", audience);
    formData.set("goal", goal);
    formData.set("methodology", methodology);
    formData.set("imageCount", String(imageCount));
    formData.set("imageQuality", imageQuality);
    formData.set("clientRequestId", `${lessonId}-agent-${Date.now()}`);

    const res = await generateFullClassAIAction(formData);
    setBusy(false);

    if (!res.success) {
      setError(res.error || "No se pudo preparar la clase.");
      return;
    }
    setResult(res.result as AgentResult);
  }

  /** Convierte la salida del agente en bloques de lección para el alumno */
  function apply() {
    if (!result) return;
    const blocks: LessonBlock[] = [];

    if (result.explanation) {
      blocks.push({ id: newId(), type: "text", title: "Explicación", content: result.explanation });
    }

    if (result.keyConcepts.length) {
      blocks.push({
        id: newId(),
        type: "text",
        title: "Conceptos clave",
        content: result.keyConcepts
          .map((c) => `• ${c.term}: ${c.definition}\n   Ejemplo: ${c.example}`)
          .join("\n\n"),
      });
    }

    if (result.mindMap?.branches?.length) {
      blocks.push({ id: newId(), type: "mindmap", title: "Mapa mental", mindMap: result.mindMap });
    }

    for (const image of result.images) {
      if (image.url) {
        blocks.push({ id: newId(), type: "image", title: image.purpose, url: image.url, content: image.altText });
      }
    }

    if (result.examples.length) {
      blocks.push({
        id: newId(),
        type: "text",
        title: "Ejemplos",
        content: result.examples.map((e) => `• ${e}`).join("\n"),
      });
    }

    for (const exercise of result.exercises) {
      blocks.push({
        id: newId(),
        type: "text",
        title: `Ejercicio (${exercise.type})`,
        content: `${exercise.instruction}\n\nSolución: ${exercise.solution}`,
      });
    }

    for (const q of result.quiz) {
      blocks.push({
        id: newId(),
        type: "quiz",
        question: q.question,
        options: q.options,
        correctOptionIndex: q.correctAnswerIndex,
      });
    }

    onApply(blocks, {
      objective: result.objective,
      prerequisites: result.prerequisites,
      classFlow: result.classFlow,
      homework: result.homework,
      teacherNotes: result.teacherNotes,
    });

    setResult(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full px-4 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25"
      >
        <Bot className="w-5 h-5" /> Preparar clase completa con el Agente
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-4">
      <div className="w-full max-w-3xl my-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" /> Agente de Clase
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Prepara la clase entera: conceptos, mapa mental, ejercicios con solución, quiz y guion de tiempos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setOpen(false); setResult(null); }}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!result ? (
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Tema de la clase
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ej: el pretérito imperfecto para narrar anécdotas"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Nivel</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Duración</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  {[30, 45, 60, 90, 120].map((d) => (
                    <option key={d} value={d}>{d} min</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Idioma</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="es">Español</option>
                  <option value="en">Inglés</option>
                  <option value="fr">Francés</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Perfil del alumnado
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Ej: adultos profesionales"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  ¿Qué quieres conseguir?
                </label>
                <input
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Ej: que sepan narrar una anécdota"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Enfoque didáctico (opcional)
              </label>
              <input
                type="text"
                value={methodology}
                onChange={(e) => setMethodology(e.target.value)}
                placeholder="Ej: comunicativo, aprender haciendo, gamificado"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ImageIcon className="w-4 h-4 text-indigo-400" /> Ilustraciones
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Cuántas</label>
                  <select
                    value={imageCount}
                    onChange={(e) => setImageCount(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>{n === 0 ? "Ninguna" : `${n} imagen${n > 1 ? "es" : ""}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1.5">Calidad</label>
                  <select
                    value={imageQuality}
                    onChange={(e) => setImageQuality(e.target.value as "standard" | "hq")}
                    disabled={imageCount === 0}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm disabled:opacity-40 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="standard">Estándar — 1 crédito c/u</option>
                    <option value="hq">Alta calidad — 2 créditos c/u</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-slate-500">
                {imageQuality === "standard"
                  ? "Rápidas y económicas: perfectas para ilustrar lecciones del día a día."
                  : "Máxima calidad: para portadas, infografías y material que vas a imprimir."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={generate}
                disabled={busy || topic.trim().length < 3}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition-colors flex items-center gap-2"
              >
                {busy ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Preparando la clase...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Preparar clase ({totalCredits} créditos)
                  </>
                )}
              </button>
              <span className="text-xs text-slate-500">
                {CLASS_CREDITS} de la clase
                {imageCount > 0 && ` + ${imageCount} × ${IMAGE_CREDITS[imageQuality]} de las imágenes`}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <h4 className="font-bold text-white mb-1">{result.lessonTitle}</h4>
              <p className="text-sm text-emerald-300 flex items-start gap-2">
                <Target className="w-4 h-4 shrink-0 mt-0.5" /> {result.objective}
              </p>
            </div>

            {result.imageErrors.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
                {result.imageErrors.map((e, i) => (
                  <p key={i} className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {e}
                  </p>
                ))}
              </div>
            )}

            <div className="grid sm:grid-cols-4 gap-3">
              {[
                { icon: ListChecks, label: "Conceptos", value: result.keyConcepts.length },
                { icon: Dumbbell, label: "Ejercicios", value: result.exercises.length },
                { icon: HelpCircle, label: "Quiz", value: result.quiz.length },
                { icon: ImageIcon, label: "Imágenes", value: result.imagesGenerated },
              ].map((s) => (
                <div key={s.label} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                  <s.icon className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                  <div className="text-lg font-bold text-white">{s.value}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">{s.label}</div>
                </div>
              ))}
            </div>

            {result.mindMap?.branches?.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-400" /> Mapa mental
                </h5>
                <MindMapView data={result.mindMap} />
              </div>
            )}

            {result.classFlow.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" /> Guion de la clase
                </h5>
                <ul className="space-y-2">
                  {result.classFlow.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="font-mono text-xs text-indigo-400 shrink-0 pt-0.5">
                        {step.minute}′–{step.minute + step.durationMinutes}′
                      </span>
                      <span className="text-slate-300">{step.activity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.teacherNotes.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <NotebookPen className="w-4 h-4 text-indigo-400" /> Notas para ti
                </h5>
                <ul className="space-y-1.5">
                  {result.teacherNotes.map((n, i) => (
                    <li key={i} className="text-sm text-slate-300 flex gap-2">
                      <span className="text-indigo-400">•</span> {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={apply}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
              >
                Añadir a la lección
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="px-5 py-3 rounded-xl text-slate-400 hover:text-white font-medium"
              >
                Descartar
              </button>
              <span className="text-xs text-slate-500">
                El guion y las notas quedan solo para ti; el alumno ve el contenido y los ejercicios.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

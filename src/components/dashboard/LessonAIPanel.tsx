"use client";

import { useState } from "react";
import { Sparkles, FileText, Dumbbell, HelpCircle, RefreshCw, AlertCircle, X } from "lucide-react";
import {
  generateLessonContentAIAction,
  generateActivityAIAction,
  generateQuizAIAction,
  regenerateLessonContentAIAction,
} from "@/app/actions/ai.actions";
import type { LessonBlock } from "./LessonBlockEditor";

type Operation = "content" | "activity" | "quiz" | "regenerate";

interface LessonAIPanelProps {
  lessonId: string;
  lessonTitle: string;
  /** Añade los bloques generados al final de la lección */
  onBlocksGenerated: (blocks: LessonBlock[]) => void;
  /** Reemplaza todo el contenido (solo al regenerar) */
  onBlocksReplaced: (blocks: LessonBlock[]) => void;
}

const OPERATIONS: Record<Operation, { label: string; description: string; icon: typeof FileText; credits: string }> = {
  content: {
    label: "Generar contenido",
    description: "Crea la teoría, el vocabulario clave y los ejercicios de la lección.",
    icon: FileText,
    credits: "2 créditos",
  },
  activity: {
    label: "Añadir actividad",
    description: "Una actividad práctica con instrucciones paso a paso.",
    icon: Dumbbell,
    credits: "1 crédito",
  },
  quiz: {
    label: "Añadir quiz",
    description: "Preguntas de opción múltiple con su respuesta correcta marcada.",
    icon: HelpCircle,
    credits: "1 crédito",
  },
  regenerate: {
    label: "Regenerar lección",
    description: "Rehace el contenido entero. Puedes indicar qué quieres cambiar.",
    icon: RefreshCw,
    credits: "1 crédito",
  },
};

function newId() {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function LessonAIPanel({ lessonId, lessonTitle, onBlocksGenerated, onBlocksReplaced }: LessonAIPanelProps) {
  const [operation, setOperation] = useState<Operation | null>(null);
  const [topic, setTopic] = useState(lessonTitle);
  const [level, setLevel] = useState("B1");
  const [language, setLanguage] = useState("es");
  const [questionCount, setQuestionCount] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** El contenido y la regeneración devuelven bloques de teoría/vocabulario/ejercicio */
  function lessonBlocksToEditor(generated: { blocks?: Array<{ type: string; title: string; content: string; items?: string[] }> }): LessonBlock[] {
    return (generated.blocks || []).map((b) => ({
      id: newId(),
      type: "text" as const,
      title: b.title,
      content: b.items?.length ? `${b.content}\n\n• ${b.items.join("\n• ")}` : b.content,
    }));
  }

  async function run() {
    if (!operation) return;
    setRunning(true);
    setError(null);

    const formData = new FormData();
    formData.set("lessonId", lessonId);
    formData.set("lessonTitle", lessonTitle);
    formData.set("topic", topic);
    formData.set("level", level);
    formData.set("language", language);
    // Evita que un doble clic cobre dos veces la misma generación
    formData.set("clientRequestId", `${lessonId}-${operation}-${Date.now()}`);

    try {
      if (operation === "content") {
        const res = await generateLessonContentAIAction(formData);
        if (!res.success) throw new Error(res.error);
        onBlocksGenerated(lessonBlocksToEditor(res.lesson as never));
      } else if (operation === "regenerate") {
        if (feedback) formData.set("feedback", feedback);
        const res = await regenerateLessonContentAIAction(formData);
        if (!res.success) throw new Error(res.error);
        const payload = (res as { lesson?: unknown; result?: unknown }).lesson ?? (res as { result?: unknown }).result;
        onBlocksReplaced(lessonBlocksToEditor(payload as never));
      } else if (operation === "activity") {
        const res = await generateActivityAIAction(formData);
        if (!res.success) throw new Error(res.error);
        const a = res.activity as { title: string; description: string; instructions?: string[] };
        onBlocksGenerated([
          {
            id: newId(),
            type: "text",
            title: a.title,
            content: a.instructions?.length ? `${a.description}\n\n1. ${a.instructions.join("\n2. ")}` : a.description,
          },
        ]);
      } else if (operation === "quiz") {
        formData.set("questionCount", String(questionCount));
        const res = await generateQuizAIAction(formData);
        if (!res.success) throw new Error(res.error);
        const q = res.quiz as { questions: Array<{ question: string; options: string[]; correctAnswerIndex: number }> };
        onBlocksGenerated(
          (q.questions || []).map((item) => ({
            id: newId(),
            type: "quiz" as const,
            question: item.question,
            options: item.options,
            correctOptionIndex: item.correctAnswerIndex,
          }))
        );
      }
      setOperation(null);
      setFeedback("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo completar la generación.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-5 h-5 text-indigo-400" />
        <h3 className="font-bold text-white">Copiloto IA de la lección</h3>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        Genera el contenido y añádelo a la lección. Revísalo y pulsa Guardar para publicarlo.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {(Object.keys(OPERATIONS) as Operation[]).map((key) => {
          const op = OPERATIONS[key];
          const Icon = op.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOperation(key)}
              disabled={running}
              className="text-left p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 disabled:opacity-50 transition-colors group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Icon className="w-4 h-4 text-indigo-400" /> {op.label}
                </span>
                <span className="text-[10px] font-mono text-slate-500">{op.credits}</span>
              </div>
              <span className="text-xs text-slate-400 leading-snug block">{op.description}</span>
            </button>
          );
        })}
      </div>

      {operation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" /> {OPERATIONS[operation].label}
              </h4>
              <button type="button" onClick={() => setOperation(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Tema</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              {operation === "quiz" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Número de preguntas
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {operation === "regenerate" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      ¿Qué quieres cambiar? (opcional)
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={3}
                      placeholder="Ej: más ejemplos prácticos y menos teoría"
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <p className="text-xs text-amber-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    Esto reemplaza todo el contenido actual de la lección.
                  </p>
                </>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={run}
                  disabled={running || !topic.trim()}
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition-colors flex items-center gap-2"
                >
                  {running ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Generar ({OPERATIONS[operation].credits})
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setOperation(null)}
                  disabled={running}
                  className="px-5 py-3 rounded-xl text-slate-400 hover:text-white font-medium"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

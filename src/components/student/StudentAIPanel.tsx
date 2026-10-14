"use client";

import { useState } from "react";
import { Bot, Send, SpellCheck2, AlertCircle, Sparkles } from "lucide-react";
import { askAITutorAIAction, getAIFeedbackAIAction } from "@/app/actions/ai.actions";

interface StudentAIPanelProps {
  /** Título de la lección o curso: da contexto a la IA */
  context: string;
  language?: string;
}

type Mode = "tutor" | "feedback";

export function StudentAIPanel({ context, language = "es" }: StudentAIPanelProps) {
  const [mode, setMode] = useState<Mode>("tutor");
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function friendlyError(raw: string) {
    if (raw.includes("INSUFFICIENT") || raw.toLowerCase().includes("saldo")) {
      return "Tu academia se ha quedado sin créditos de IA. Avisa a tu profesor.";
    }
    return raw;
  }

  async function submit() {
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    setAnswer(null);

    const formData = new FormData();
    formData.set("language", language);
    formData.set("clientRequestId", `${mode}-${Date.now()}`);

    try {
      if (mode === "tutor") {
        formData.set("question", input);
        formData.set("context", context);
        const res = await askAITutorAIAction(formData);
        if (!res.success) throw new Error(res.error);
        const r = res.result as { answer?: string; response?: string } | string;
        setAnswer(typeof r === "string" ? r : r.answer || r.response || JSON.stringify(r));
      } else {
        formData.set("studentSubmission", input);
        formData.set("exerciseContext", context);
        const res = await getAIFeedbackAIAction(formData);
        if (!res.success) throw new Error(res.error);
        const r = res.result as { feedback?: string; answer?: string } | string;
        setAnswer(typeof r === "string" ? r : r.feedback || r.answer || JSON.stringify(r));
      }
    } catch (e: unknown) {
      setError(friendlyError(e instanceof Error ? e.message : "No se pudo completar la consulta."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30">
      <div className="flex items-center gap-2 mb-1">
        <Bot className="w-5 h-5 text-indigo-400" />
        <h3 className="font-bold text-white">Tutor IA</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        Resuelve tus dudas de esta lección o pide que revisen un texto tuyo.
      </p>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setMode("tutor");
            setAnswer(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            mode === "tutor"
              ? "bg-indigo-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> Preguntar
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("feedback");
            setAnswer(null);
          }}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            mode === "feedback"
              ? "bg-indigo-600 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <SpellCheck2 className="w-3.5 h-3.5" /> Corregir mi texto
        </button>
      </div>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={mode === "feedback" ? 5 : 3}
        maxLength={2000}
        placeholder={
          mode === "tutor"
            ? "Ej: ¿cuándo se usa el subjuntivo en esta estructura?"
            : "Pega aquí tu texto y recibirás correcciones y sugerencias."
        }
        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
      />

      <div className="flex items-center justify-between mt-3">
        <span className="text-[11px] text-slate-500">{input.length}/2000</span>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !input.trim()}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition-colors"
        >
          {busy ? (
            <>
              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              Pensando...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" /> Enviar
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {answer && (
        <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-indigo-500/20">
          <span className="text-[11px] font-mono text-indigo-400 uppercase tracking-wider block mb-2">
            {mode === "tutor" ? "Respuesta del tutor" : "Corrección"}
          </span>
          <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

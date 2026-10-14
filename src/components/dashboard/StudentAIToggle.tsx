"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, AlertCircle, CheckCircle2 } from "lucide-react";
import { setStudentAIAccessAction } from "@/app/actions/academy.actions";

interface StudentAIToggleProps {
  initialEnabled: boolean;
  teacherCreditsAvailable: number;
}

export function StudentAIToggle({ initialEnabled, teacherCreditsAvailable }: StudentAIToggleProps) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function toggle() {
    const next = !enabled;
    setSaving(true);
    setMessage(null);
    const res = await setStudentAIAccessAction(next);
    setSaving(false);
    if (res.success) {
      setEnabled(next);
      setMessage({
        type: "success",
        text: next
          ? "Tus alumnos ya pueden usar el Tutor IA."
          : "Tutor IA desactivado para los alumnos.",
      });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo actualizar." });
    }
  }

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <h2 className="font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" /> Tutor IA para alumnos
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Permite que tus alumnos hagan preguntas y pidan corrección de sus textos dentro del campus.
          </p>
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={saving}
          aria-pressed={enabled}
          className={`relative shrink-0 w-14 h-8 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-emerald-600" : "bg-slate-700"
          }`}
        >
          <span
            className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Lo que consuman tus alumnos <strong>se descuenta de tus créditos de profesor</strong>. Cada consulta al
          tutor cuesta 1 crédito. Te quedan <strong>{teacherCreditsAvailable}</strong>.
        </span>
      </div>

      {message && (
        <div
          className={`mt-3 p-3 rounded-xl text-sm flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
}

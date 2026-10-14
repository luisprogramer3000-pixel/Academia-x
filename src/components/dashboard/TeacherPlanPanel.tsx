"use client";

import { useState } from "react";
import type { TeacherPlan } from "./ClassAgentWizard";
import { ChevronDown, ClipboardList, Clock, EyeOff, Target } from "lucide-react";

const COLORS = ["#4f7cf7", "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];

/** Guion del profesor de la lección: solo lo ve el staff, nunca el alumno. */
export function TeacherPlanPanel({ plan }: { plan: TeacherPlan }) {
  const [open, setOpen] = useState(true);
  const total = plan.classFlow.reduce((a, s) => a + s.durationMinutes, 0);
  const hasContent = plan.objective || plan.classFlow.length || plan.teacherNotes.length || plan.homework;
  if (!hasContent) return null;

  return (
    <section className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-6 py-4 text-left">
        <span className="flex items-center gap-3">
          <ClipboardList className="w-5 h-5 text-amber-400" />
          <span>
            <span className="block font-bold text-white">Guion del profesor</span>
            <span className="text-xs text-slate-400 flex items-center gap-1"><EyeOff className="w-3 h-3" /> Solo lo ves tú, no aparece a los alumnos</span>
          </span>
        </span>
        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-5">
          {plan.objective && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1.5 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Objetivo</p>
              <p className="text-sm text-slate-200">{plan.objective}</p>
            </div>
          )}

          {plan.classFlow.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Momentos de la clase · {total} min
              </p>
              <div className="flex gap-1 mb-3">
                {plan.classFlow.map((s, i) => (
                  <div key={i} className="h-2 rounded-full" style={{ flexGrow: Math.max(1, s.durationMinutes), flexBasis: 0, background: COLORS[i % COLORS.length] }} />
                ))}
              </div>
              <ol className="space-y-1.5">
                {plan.classFlow.map((s, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="shrink-0 w-20 font-mono text-xs pt-0.5" style={{ color: COLORS[i % COLORS.length] }}>
                      {s.minute}&apos;–{s.minute + s.durationMinutes}&apos;
                    </span>
                    <span className="text-slate-200">{s.activity}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {plan.teacherNotes.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Indicaciones</p>
              <ul className="space-y-2">
                {plan.teacherNotes.map((n, i) => (
                  <li key={i} className="text-sm text-slate-300 pl-3 border-l-2 border-amber-500/40">{n}</li>
                ))}
              </ul>
            </div>
          )}

          {plan.homework && (
            <p className="text-sm text-slate-300"><strong className="text-white">Tarea:</strong> {plan.homework}</p>
          )}
        </div>
      )}
    </section>
  );
}

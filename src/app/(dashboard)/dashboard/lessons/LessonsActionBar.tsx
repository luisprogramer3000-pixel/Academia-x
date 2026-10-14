"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DialogShell } from "@/components/dashboard/DialogShell";
import { PresentationWizard } from "@/components/dashboard/PresentationWizard";
import { FileText, MonitorPlay, Presentation } from "lucide-react";

export interface LessonOption {
  lessonId: string;
  title: string;
  level?: string | null;
}

type Action = "pdf" | "pptx" | "present";

const ACTIONS: Array<{ id: Action; label: string; hint: string; icon: typeof FileText; className: string }> = [
  { id: "pdf", label: "Generar PDF", hint: "Descarga para imprimir o repartir", icon: FileText, className: "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20" },
  { id: "pptx", label: "Generar PPTX", hint: "PowerPoint editable con tu diseño", icon: Presentation, className: "bg-amber-600 hover:bg-amber-500 shadow-amber-600/20" },
  { id: "present", label: "Presentación", hint: "Expón la lección a pantalla completa", icon: MonitorPlay, className: "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20" },
];

/** Barra de acciones de "Mis lecciones": PDF, PowerPoint y modo exposición. */
export function LessonsActionBar({ lessons, primaryColor }: { lessons: LessonOption[]; primaryColor: string }) {
  const router = useRouter();
  const [picking, setPicking] = useState<Action | null>(null);
  const [wizard, setWizard] = useState<{ lessonId: string; format: "pdf" | "pptx" } | null>(null);

  function run(action: Action, lessonId: string) {
    setPicking(null);
    if (action === "present") router.push(`/dashboard/lessons/${lessonId}/presentar`);
    else setWizard({ lessonId, format: action });
  }

  function start(action: Action) {
    if (lessons.length === 1) run(action, lessons[0].lessonId);
    else setPicking(action);
  }

  const disabled = lessons.length === 0;

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => start(a.id)}
            disabled={disabled}
            title={disabled ? "Crea una lección con contenido para usar esta opción" : undefined}
            className={`p-5 rounded-2xl text-white text-left shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 disabled:cursor-not-allowed flex items-center gap-4 ${a.className}`}
          >
            <span className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
              <a.icon className="w-6 h-6" />
            </span>
            <span>
              <span className="block text-lg font-extrabold">{a.label}</span>
              <span className="block text-xs text-white/80">{a.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {picking && (
        <DialogShell title={ACTIONS.find((a) => a.id === picking)!.label + ": elige la lección"} onClose={() => setPicking(null)}>
          <ul className="space-y-2">
            {lessons.map((l) => (
              <li key={l.lessonId}>
                <button
                  type="button"
                  onClick={() => run(picking, l.lessonId)}
                  className="w-full text-left px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 flex items-center justify-between gap-3"
                >
                  <span className="font-semibold text-white">{l.title}</span>
                  {l.level && <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{l.level}</span>}
                </button>
              </li>
            ))}
          </ul>
        </DialogShell>
      )}

      {wizard && (
        <PresentationWizard
          lessonId={wizard.lessonId}
          primaryColor={primaryColor}
          initialFormat={wizard.format}
          onClose={() => setWizard(null)}
        />
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import type { ClassPlanMaterial, ClassMaterialKind } from "@/modules/ai/class-plan.schema";
import { Check, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { LessonProse } from "@/components/lesson/LessonProse";

export const KIND_META: Record<ClassMaterialKind, { label: string; emoji: string; tint: string; chip: string }> = {
  reto: { label: "Reto práctico", emoji: "🧩", tint: "bg-indigo-50", chip: "bg-indigo-100 text-indigo-700" },
  resumen: { label: "Resumen", emoji: "📘", tint: "bg-sky-50", chip: "bg-sky-100 text-sky-700" },
  ejercicios: { label: "Lista de ejercicios", emoji: "📝", tint: "bg-amber-50", chip: "bg-amber-100 text-amber-800" },
  quiz: { label: "Juego · Quiz", emoji: "🎲", tint: "bg-rose-50", chip: "bg-rose-100 text-rose-700" },
  flashcards: { label: "Flashcards", emoji: "🃏", tint: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-700" },
  lectura: { label: "Lectura comprensiva", emoji: "📖", tint: "bg-violet-50", chip: "bg-violet-100 text-violet-700" },
  rubrica: { label: "Rúbrica", emoji: "📊", tint: "bg-teal-50", chip: "bg-teal-100 text-teal-700" },
};

const DIFFICULTY_STYLE: Record<string, string> = {
  Fácil: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medio: "bg-amber-50 text-amber-700 border-amber-200",
  Difícil: "bg-rose-50 text-rose-700 border-rose-200",
};

const LETTERS = "ABCDEFGH";

/** printMode: todo desplegado (respuestas visibles), sin interacción */
export function MaterialContent({ material, printMode = false }: { material: ClassPlanMaterial; printMode?: boolean }) {
  return (
    <div className="space-y-6 text-slate-800">
      {material.sections.map((s, i) => (
        <section key={i} className="break-inside-avoid">
          {s.heading && <h3 className="text-xl font-bold text-slate-900 mb-2">{s.heading}</h3>}
          {s.body && <LessonProse text={s.body} accent="#4f7cf7" />}
          {s.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.imageUrl} alt={s.imagePrompt || s.heading} className="mt-4 w-full max-h-96 object-cover rounded-2xl" loading="lazy" />
          )}
          {s.bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5 list-disc pl-6 text-base">
              {s.bullets.map((b, bi) => <li key={bi}>{b}</li>)}
            </ul>
          )}
        </section>
      ))}

      {material.questions.map((q, i) => (
        <QuestionCard key={i} index={i} question={q} printMode={printMode} />
      ))}

      {material.cards.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {material.cards.map((c, i) => (
            <Flashcard key={i} front={c.front} back={c.back} printMode={printMode} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  index,
  question: q,
  printMode,
}: {
  index: number;
  question: ClassPlanMaterial["questions"][number];
  printMode: boolean;
}) {
  const [showKey, setShowKey] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const reveal = printMode || showKey;

  return (
    <div className="rounded-xl border border-slate-200 p-5 break-inside-avoid">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-bold text-slate-900">Pregunta {index + 1}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${DIFFICULTY_STYLE[q.difficulty] ?? DIFFICULTY_STYLE.Medio}`}>
          {q.difficulty}
        </span>
      </div>
      <p className="text-base leading-relaxed whitespace-pre-line mb-4">{q.prompt}</p>

      {q.options.length > 0 ? (
        <div className="space-y-2">
          {q.options.map((opt, oi) => {
            const isCorrect = oi === q.correctIndex;
            const isPicked = picked === oi;
            const state =
              (reveal || picked !== null) && isCorrect
                ? "border-emerald-400 bg-emerald-50"
                : isPicked
                ? "border-rose-300 bg-rose-50"
                : "border-slate-200 hover:border-slate-300";
            return (
              <button
                key={oi}
                type="button"
                disabled={printMode || picked !== null}
                onClick={() => setPicked(oi)}
                className={`w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-colors ${state}`}
              >
                <span className="w-5 flex justify-center">
                  {(reveal || picked !== null) && isCorrect ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-300 inline-block" />
                  )}
                </span>
                <span className="font-semibold text-slate-500">{LETTERS[oi]}.</span>
                <span className="text-base">{opt}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="h-px bg-slate-200" />
          <div className="h-px bg-slate-200 mt-6" />
        </div>
      )}

      {(q.answer || q.explanation) && (
        <div className="mt-4 rounded-lg border border-slate-200">
          {!printMode && (
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-700"
            >
              Clave de respuestas {showKey ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          {reveal && (
            <div className="px-4 pb-3 pt-2 text-sm text-slate-700 space-y-1 border-t border-slate-100">
              {printMode && <p className="font-semibold text-slate-900">Clave de respuestas</p>}
              {q.answer && <p><span className="font-semibold">Respuesta:</span> {q.answer}</p>}
              {q.explanation && <p className="text-slate-500">{q.explanation}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Flashcard({ front, back, printMode }: { front: string; back: string; printMode: boolean }) {
  const [flipped, setFlipped] = useState(false);
  if (printMode) {
    return (
      <div className="rounded-xl border border-slate-200 p-4 break-inside-avoid">
        <p className="font-bold text-lg">{front}</p>
        <p className="text-slate-600 mt-1">{back}</p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setFlipped((v) => !v)}
      className={`min-h-[120px] rounded-xl border p-5 text-left flex flex-col justify-between transition-colors ${
        flipped ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-200 hover:border-emerald-300"
      }`}
    >
      <span className={flipped ? "text-base text-slate-700" : "text-xl font-bold text-slate-900"}>{flipped ? back : front}</span>
      <span className="text-xs text-slate-400 flex items-center gap-1 mt-3">
        <RotateCcw className="w-3 h-3" /> {flipped ? "Ver frente" : "Girar tarjeta"}
      </span>
    </button>
  );
}

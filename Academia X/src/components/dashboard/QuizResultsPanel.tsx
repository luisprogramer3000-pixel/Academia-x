"use client";

import { useState } from "react";
import { BarChart3, Users, RefreshCw, AlertCircle } from "lucide-react";
import { getQuizResultsAction } from "@/app/actions/quiz.actions";

interface QuizResultsPanelProps {
  lessonId: string;
  hasQuiz: boolean;
}

interface StudentResult {
  userId: string;
  name: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  date: string;
}

export function QuizResultsPanel({ lessonId, hasQuiz }: QuizResultsPanelProps) {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [average, setAverage] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);

  async function load() {
    setBusy(true);
    setError(null);
    const res = await getQuizResultsAction(lessonId);
    setBusy(false);
    if (!res.success) {
      setError(res.error || "No se pudieron cargar los resultados.");
      return;
    }
    setStudents((res.students as StudentResult[]) || []);
    setAverage(res.average || 0);
    setTotalAttempts(res.totalAttempts || 0);
    setLoaded(true);
  }

  if (!hasQuiz) return null;

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" /> Notas del examen
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
          {loaded ? "Actualizar" : "Ver resultados"}
        </button>
      </div>
      <p className="text-xs text-slate-400 mb-4">Se corrigen solas en cuanto el alumno envía sus respuestas.</p>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loaded && !error && (
        students.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            Todavía ningún alumno ha hecho el examen de esta lección.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <div className="text-xl font-bold text-white">{students.length}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Alumnos</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <div
                  className={`text-xl font-bold ${
                    average >= 70 ? "text-emerald-400" : average >= 50 ? "text-amber-400" : "text-red-400"
                  }`}
                >
                  {average}
                </div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Nota media</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
                <div className="text-xl font-bold text-white">{totalAttempts}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider">Intentos</div>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {students.map((s) => (
                <div
                  key={s.userId}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" /> {s.name}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {s.correctCount}/{s.totalQuestions} correctas · {new Date(s.date).toLocaleDateString("es")}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-lg text-sm font-bold shrink-0 ${
                      s.score >= 70
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : s.score >= 50
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {s.score}
                  </span>
                </div>
              ))}
            </div>
          </>
        )
      )}
    </div>
  );
}

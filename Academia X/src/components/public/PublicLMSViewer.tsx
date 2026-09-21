"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle,
  FileText,
  Video,
  Play,
  ArrowLeft,
  ChevronRight,
  Download,
  HelpCircle,
  Award,
} from "lucide-react";
import { toggleLessonProgressAction } from "@/app/actions/course.actions";

export interface LessonData {
  id: string;
  title: string;
  content?: string | null;
}

export interface ModuleData {
  id: string;
  title: string;
  lessons: LessonData[];
}

export interface CourseViewerData {
  id: string;
  title: string;
  tenantSlug: string;
  courseSlug: string;
  academyName: string;
  primaryColor?: string;
  modules: ModuleData[];
  completedLessonIds?: string[];
  /** "preview": visitante sin inscripción (sin progreso). "student": alumno inscrito. */
  mode?: "preview" | "student";
  /** Enlace para inscribirse / iniciar sesión en modo preview */
  joinHref?: string;
  /** Enlace de regreso (campus del alumno o página pública) */
  backHref?: string;
}

export function PublicLMSViewer({
  id: courseId,
  title,
  tenantSlug,
  courseSlug,
  academyName,
  primaryColor = "#2563eb",
  modules,
  completedLessonIds: initialCompleted = [],
  mode = "preview",
  joinHref,
  backHref,
}: CourseViewerData) {
  const allLessons = modules.flatMap((m) => m.lessons);
  const [activeLessonId, setActiveLessonId] = useState<string>(allLessons[0]?.id || "");
  const [completedIds, setCompletedIds] = useState<string[]>(initialCompleted);
  const [toggling, setToggling] = useState(false);

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) || allLessons[0];
  const activeLessonIndex = allLessons.findIndex((l) => l.id === activeLessonId);

  const totalLessons = allLessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedIds.length / totalLessons) * 100) : 0;

  const parseLessonBlocks = (contentJson?: string | null) => {
    if (!contentJson) return [];
    try {
      const parsed = JSON.parse(contentJson);
      if (Array.isArray(parsed.blocks)) return parsed.blocks;
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [{ id: "b_fallback", type: "text", content: contentJson }];
    }
  };

  const handleToggleComplete = async (lessonId: string) => {
    if (mode !== "student") return;
    setToggling(true);
    const isCompleted = completedIds.includes(lessonId);

    // Optimistic UI update
    setCompletedIds((prev) => (isCompleted ? prev.filter((id) => id !== lessonId) : [...prev, lessonId]));

    try {
      await toggleLessonProgressAction(lessonId);
    } catch (e) {
      console.warn("Could not persist progress to DB:", e);
      // Revertir el cambio optimista si falla
      setCompletedIds((prev) => (isCompleted ? [...prev, lessonId] : prev.filter((id) => id !== lessonId)));
    } finally {
      setToggling(false);
    }
  };

  const activeBlocks = parseLessonBlocks(activeLesson?.content);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header LMS */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4 min-w-0">
          <Link
            href={backHref || `/a/${tenantSlug}`}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-mono shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> {academyName}
          </Link>
          <div className="h-4 w-px bg-slate-800 shrink-0" />
          <h1 className="font-bold text-sm text-white truncate">{title}</h1>
        </div>

        {/* Progress Bar & Status */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-32 h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%`, backgroundColor: primaryColor }}
              />
            </div>
            <span className="text-xs font-mono text-slate-300">{progressPercent}%</span>
          </div>

          {progressPercent === 100 && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <Award className="w-3.5 h-3.5" /> Curso Completado
            </span>
          )}
        </div>
      </header>

      {/* Main LMS Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Modules & Lessons Tree */}
        <aside className="w-80 bg-slate-900 border-r border-slate-800 overflow-y-auto hidden md:block">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Contenido del Curso</span>
            <span className="text-xs font-mono text-blue-400">{completedIds.length}/{totalLessons} completadas</span>
          </div>

          <div className="p-4 space-y-6">
            {modules.map((m, mIdx) => (
              <div key={m.id} className="space-y-2">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Módulo {mIdx + 1}: {m.title}
                </h3>

                <div className="space-y-1">
                  {m.lessons.map((l) => {
                    const isCurrent = l.id === activeLesson?.id;
                    const isDone = completedIds.includes(l.id);

                    return (
                      <button
                        key={l.id}
                        onClick={() => setActiveLessonId(l.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between text-xs font-medium ${
                          isCurrent
                            ? "bg-slate-800 border-blue-500/50 text-white shadow-md"
                            : "bg-slate-950 border-slate-800/80 hover:border-slate-700 text-slate-300"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 truncate">
                          <Play className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? "text-blue-400 fill-current" : "text-slate-500"}`} />
                          <span className="truncate">{l.title}</span>
                        </span>
                        {isDone && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Content Viewer Area */}
        <main className="flex-1 p-8 overflow-y-auto max-w-4xl mx-auto space-y-8">
          {activeLesson ? (
            <>
              <div>
                <span className="text-xs font-mono text-blue-400 uppercase tracking-wider block mb-2 font-semibold">
                  Lección #{activeLessonIndex + 1} de {totalLessons}
                </span>
                <h2 className="text-3xl font-extrabold text-white mb-4 leading-tight">{activeLesson.title}</h2>
              </div>

              {/* Render Block List */}
              {activeBlocks.length > 0 ? (
                <div className="space-y-6">
                  {activeBlocks.map((b: any, bIdx: number) => (
                    <div key={b.id || bIdx} className="space-y-4">
                      {b.type === "text" && (
                        <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 leading-relaxed text-slate-200 text-base whitespace-pre-line shadow-lg">
                          {b.content}
                        </div>
                      )}

                      {b.type === "video" && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-lg">
                          <span className="text-xs font-mono text-indigo-400 font-semibold block">{b.title || "Video de la Lección"}</span>
                          <div className="aspect-video w-full bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform">
                              <Play className="w-8 h-8 fill-current ml-1" />
                            </div>
                            <span className="text-xs text-slate-500 font-mono mt-4 truncate max-w-md px-4">{b.url || "Video listo para reproducir"}</span>
                          </div>
                        </div>
                      )}

                      {b.type === "resource" && (
                        <a
                          href={b.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/50 transition-all flex items-center justify-between text-sm text-emerald-400 font-medium shadow-md"
                        >
                          <span className="flex items-center gap-3">
                            <Download className="w-5 h-5 text-emerald-400" />
                            <span className="text-white">{b.title || "Recurso Descargable"}</span>
                          </span>
                          <span className="text-xs font-mono bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">Descargar Material</span>
                        </a>
                      )}

                      {b.type === "quiz" && (
                        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
                          <h4 className="font-bold text-base text-white flex items-center gap-2">
                            <HelpCircle className="w-5 h-5 text-purple-400" /> {b.question || "Pregunta de Evaluación"}
                          </h4>
                          <div className="space-y-2">
                            {(b.options || []).map((opt: string, optIdx: number) => (
                              <div
                                key={optIdx}
                                className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 hover:border-blue-500/40 transition-colors cursor-pointer flex items-center justify-between"
                              >
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 text-sm leading-relaxed">
                  {activeLesson.content || "Contenido de la lección disponible próximamente."}
                </div>
              )}

              {/* Progress & Navigation Footer */}
              <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                {mode === "preview" ? (
                  <Link
                    href={joinHref || `/a/${tenantSlug}/join`}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <CheckCircle className="w-5 h-5" />
                    Inscríbete para acceder al curso completo
                  </Link>
                ) : (
                <button
                  onClick={() => handleToggleComplete(activeLesson.id)}
                  disabled={toggling}
                  className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                    completedIds.includes(activeLesson.id)
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                      : "text-white shadow-blue-600/30 hover:opacity-90"
                  }`}
                  style={{ backgroundColor: completedIds.includes(activeLesson.id) ? undefined : primaryColor }}
                >
                  <CheckCircle className="w-5 h-5" />
                  {completedIds.includes(activeLesson.id) ? "Lección Completada ✓" : "Marcar como Completada"}
                </button>
                )}

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  {activeLessonIndex > 0 && (
                    <button
                      onClick={() => setActiveLessonId(allLessons[activeLessonIndex - 1].id)}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition-colors"
                    >
                      ← Anterior
                    </button>
                  )}
                  {activeLessonIndex < allLessons.length - 1 && (
                    <button
                      onClick={() => setActiveLessonId(allLessons[activeLessonIndex + 1].id)}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      Siguiente <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400">Selecciona una lección del temario para comenzar.</div>
          )}
        </main>
      </div>
    </div>
  );
}

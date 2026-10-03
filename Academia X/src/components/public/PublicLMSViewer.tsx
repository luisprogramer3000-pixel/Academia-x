"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { safeExternalUrl } from "@/lib/utils";
import {
  BookOpen,
  CheckCircle,
  Video,
  Play,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Award,
  Menu,
  X,
} from "lucide-react";
import { toggleLessonProgressAction } from "@/app/actions/course.actions";
import { StudentAssignments } from "@/components/student/StudentAssignments";
import { LessonReader } from "@/components/lesson/LessonReader";
import { parseLessonBlocks } from "@/components/lesson/lesson-blocks";
import { BrandScope } from "@/lib/brand-theme";

export interface LessonData {
  id: string;
  title: string;
  content?: string | null;
  liveUrl?: string | null;
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
  /** Color de fondo de la academia (branding) */
  backgroundColor?: string | null;
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
  title,
  tenantSlug,
  academyName,
  primaryColor = "#2563eb",
  backgroundColor,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) || allLessons[0];
  const activeLessonIndex = allLessons.findIndex((l) => l.id === activeLesson?.id);
  const activeModuleIndex = modules.findIndex((m) => m.lessons.some((l) => l.id === activeLesson?.id));

  const totalLessons = allLessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((completedIds.length / totalLessons) * 100) : 0;
  const isDone = activeLesson ? completedIds.includes(activeLesson.id) : false;
  const liveUrl = safeExternalUrl(activeLesson?.liveUrl);

  const selectLesson = (lessonId: string) => {
    setActiveLessonId(lessonId);
    setMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  };

  const handleToggleComplete = async (lessonId: string) => {
    if (mode !== "student") return;
    setToggling(true);
    const wasCompleted = completedIds.includes(lessonId);
    setCompletedIds((prev) => (wasCompleted ? prev.filter((id) => id !== lessonId) : [...prev, lessonId]));
    try {
      await toggleLessonProgressAction(lessonId);
    } catch (e) {
      console.warn("Could not persist progress to DB:", e);
      setCompletedIds((prev) => (wasCompleted ? [...prev, lessonId] : prev.filter((id) => id !== lessonId)));
    } finally {
      setToggling(false);
    }
  };

  const completeAndContinue = async () => {
    if (!activeLesson) return;
    if (mode === "student" && !isDone) await handleToggleComplete(activeLesson.id);
    const next = allLessons[activeLessonIndex + 1];
    if (next) selectLesson(next.id);
  };

  const sidebar = (
    <>
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Contenido del curso</span>
        <span className="text-xs font-mono text-blue-400">{completedIds.length}/{totalLessons}</span>
      </div>
      <div className="p-4 space-y-6">
        {modules.map((m, mIdx) => (
          <div key={m.id} className="space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Módulo {mIdx + 1}: {m.title}
            </h3>
            <div className="space-y-1">
              {m.lessons.length === 0 ? (
                <p className="text-xs text-slate-600 italic px-2 py-1">Sin lecciones aún</p>
              ) : (
                m.lessons.map((l) => {
                  const isCurrent = l.id === activeLesson?.id;
                  const done = completedIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      onClick={() => selectLesson(l.id)}
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
                      {done && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <BrandScope color={backgroundColor}>
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <header className="h-16 shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-50">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setMenuOpen(true)} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-800" aria-label="Ver lecciones">
            <Menu className="w-5 h-5" />
          </button>
          <Link
            href={backHref || `/a/${tenantSlug}`}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-mono shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">{academyName}</span>
          </Link>
          <div className="h-4 w-px bg-slate-800 shrink-0" />
          <h1 className="font-bold text-sm text-white truncate">{title}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <div className="w-32 h-2.5 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${progressPercent}%`, backgroundColor: primaryColor }} />
            </div>
            <span className="text-xs font-mono text-slate-300">{progressPercent}%</span>
          </div>
          {progressPercent === 100 && (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <Award className="w-3.5 h-3.5" /> Curso completado
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-80 bg-slate-900 border-r border-slate-800 overflow-y-auto hidden md:block">{sidebar}</aside>

        {menuOpen && (
          <div className="fixed inset-0 z-[60] md:hidden flex">
            <div className="w-80 max-w-[85vw] bg-slate-900 border-r border-slate-800 overflow-y-auto">
              <div className="flex justify-end p-2">
                <button onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Cerrar"><X className="w-5 h-5" /></button>
              </div>
              {sidebar}
            </div>
            <div className="flex-1 bg-black/60" onClick={() => setMenuOpen(false)} />
          </div>
        )}

        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-3 sm:px-8 py-6 sm:py-10 space-y-8">
            {activeLesson ? (
              <>
                <LessonReader
                  key={activeLesson.id}
                  lessonId={activeLesson.id}
                  title={activeLesson.title}
                  eyebrow={`${activeModuleIndex >= 0 ? `Módulo ${activeModuleIndex + 1} · ` : ""}Lección ${activeLessonIndex + 1} de ${totalLessons}`}
                  blocks={parseLessonBlocks(activeLesson.content)}
                  mode={mode}
                  accent={primaryColor}
                  actions={
                    liveUrl && mode === "student" ? (
                      <a
                        href={liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm shadow-lg"
                        style={{ background: primaryColor }}
                      >
                        <Video className="w-5 h-5" /> Unirse a la clase en vivo
                      </a>
                    ) : undefined
                  }
                />

                {mode === "student" && <StudentAssignments key={`as-${activeLesson.id}`} lessonId={activeLesson.id} />}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-10">
                  {activeLessonIndex > 0 ? (
                    <button
                      onClick={() => selectLesson(allLessons[activeLessonIndex - 1].id)}
                      className="px-5 py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-sm font-semibold flex items-center justify-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>
                  ) : <span />}

                  {mode === "preview" ? (
                    <Link
                      href={joinHref || `/a/${tenantSlug}/join`}
                      className="px-6 py-3 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 hover:opacity-90"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <CheckCircle className="w-5 h-5" /> Inscríbete para acceder al curso completo
                    </Link>
                  ) : activeLessonIndex < totalLessons - 1 ? (
                    <button
                      onClick={completeAndContinue}
                      disabled={toggling}
                      className="px-6 py-3 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {isDone ? "Siguiente lección" : "Completar y continuar"} <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleComplete(activeLesson.id)}
                      disabled={toggling}
                      className={`px-6 py-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 ${
                        isDone ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-white hover:opacity-90"
                      }`}
                      style={{ backgroundColor: isDone ? undefined : primaryColor }}
                    >
                      <CheckCircle className="w-5 h-5" /> {isDone ? "Lección completada ✓" : "Marcar como completada"}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-slate-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Este curso aún no tiene lecciones</h3>
                  <p className="text-sm text-slate-400 max-w-sm">
                    Los módulos están creados pero todavía no tienen contenido.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
    </BrandScope>
  );
}

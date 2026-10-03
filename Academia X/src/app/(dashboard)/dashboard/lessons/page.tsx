import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { CourseService } from "@/modules/course/course.service";
import Link from "next/link";
import { FileText, Plus, Edit } from "lucide-react";
import { LessonCardActions } from "./LessonCardActions";
import { LessonsActionBar } from "./LessonsActionBar";

export default async function LessonsPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;

  const allContent = await CourseService.getCoursesByTenant(tenantId);
  const lessons = allContent.filter((c) => c.contentType === "STANDALONE_LESSON");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
                <FileText className="w-7 h-7 text-emerald-400" /> Mis Lecciones
              </h1>
              <p className="text-slate-400 text-sm">
                Clases sueltas como recurso interno de tu academia. Sin landing ni inscripciones.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/courses/new/lesson"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nueva Lección
              </Link>
            </div>
          </div>

          {/* Descargar o exponer una lección */}
          <LessonsActionBar
            primaryColor={academy.primaryColor || "#2563EB"}
            lessons={lessons
              .filter((l) => l.modules[0]?.lessons[0])
              .map((l) => ({ lessonId: l.modules[0].lessons[0].id, title: l.title, level: l.level }))}
          />

          {lessons.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center max-w-xl mx-auto my-8">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
                <FileText className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No tienes lecciones todavía</h2>
              <p className="text-sm text-slate-400 mb-6">
                Crea clases sueltas para usar como material de apoyo o clases individuales. Puedes generar el contenido automáticamente con IA.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/dashboard/courses/new/lesson"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" /> Crear lección
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {lessons.map((lesson) => {
                const firstLesson = lesson.modules[0]?.lessons[0];
                const hasContent = Boolean(firstLesson);
                return (
                  <div
                    key={lesson.id}
                    className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                          Lección
                        </span>
                        {lesson.level && (
                          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {lesson.level}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-white mb-2">{lesson.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                        {lesson.description || "Sin descripción."}
                      </p>

                      {!hasContent && (
                        <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2">
                          <span className="font-bold">⚠</span> Sin contenido — ábrela para agregar bloques
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <LessonCardActions id={lesson.id} title={lesson.title} canPreview={hasContent} />
                      {firstLesson ? (
                        <Link
                          href={`/dashboard/lessons/${firstLesson.id}`}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" /> Editar lección
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/courses/${lesson.id}/builder`}
                          className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-emerald-600 text-slate-300 hover:text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" /> Agregar contenido
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

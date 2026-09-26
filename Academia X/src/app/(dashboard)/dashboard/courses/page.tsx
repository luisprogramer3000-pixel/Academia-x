import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { CourseService } from "@/modules/course/course.service";
import Link from "next/link";
import { BookOpen, Plus, Sparkles, Layers, Edit, Globe, FileText } from "lucide-react";

export default async function CoursesPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;

  const allContent = await CourseService.getCoursesByTenant(tenantId);
  const courses = allContent.filter((c) => c.contentType === "COURSE");
  const lessons = allContent.filter((c) => c.contentType === "STANDALONE_LESSON");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
                <BookOpen className="w-7 h-7 text-blue-400" /> Mis Recursos
              </h1>
              <p className="text-slate-400 text-sm">
                Cursos completos y lecciones sueltas de tu academia.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/ai-copilot"
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-blue-400 font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Generar con IA
              </Link>

              <Link
                href="/dashboard/courses/new"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nuevo
              </Link>
            </div>
          </div>

          {allContent.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center max-w-xl mx-auto my-12">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No tienes contenido creado todavía</h2>
              <p className="text-sm text-slate-400 mb-6">
                Crea tu primer curso completo o una lección suelta. También puedes usar el Copiloto IA para generar la estructura en minutos.
              </p>
              <Link
                href="/dashboard/courses/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
              >
                <Plus className="w-4 h-4" /> Crear contenido
              </Link>
            </div>
          ) : (
            <div className="space-y-10">

              {/* ── Cursos completos ── */}
              {courses.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-blue-400" /> Cursos ({courses.length})
                  </h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course) => {
                      const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
                      return (
                        <div key={course.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <span className={`px-3 py-1 rounded-md text-xs font-semibold uppercase ${
                                course.status === "PUBLISHED"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}>
                                {course.status === "PUBLISHED" ? "Publicado" : "Borrador"}
                              </span>
                              <span className="text-xs font-mono text-slate-400">{course.level}</span>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2">{course.title}</h3>
                            <p className="text-xs text-slate-400 line-clamp-2 mb-6">{course.description || "Sin descripción."}</p>

                            <div className="flex items-center gap-4 text-xs text-slate-400 mb-6 font-mono">
                              <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-blue-400" /> {course.modules.length} Módulos</span>
                              <span>•</span>
                              <span>{totalLessons} Lecciones</span>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                            <div className="text-lg font-bold text-white">${Number(course.priceAmount)} <span className="text-xs text-slate-400 font-normal">{course.currency}</span></div>
                            <div className="flex items-center gap-2">
                              {course.status === "PUBLISHED" && (
                                <Link href={`/a/${tenantSlug}/courses/${course.slug}`} target="_blank" className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors" title="Ver en vista estudiante">
                                  <Globe className="w-4 h-4 text-blue-400" />
                                </Link>
                              )}
                              <Link href={`/dashboard/courses/${course.id}/builder`} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5">
                                <Edit className="w-3.5 h-3.5" /> Editar
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── Lecciones sueltas ── */}
              {lessons.length > 0 && (
                <section>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-emerald-400" /> Lecciones / Clases ({lessons.length})
                  </h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lessons.map((lesson) => {
                      const firstLesson = lesson.modules[0]?.lessons[0];
                      return (
                        <div key={lesson.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                Lección
                              </span>
                              {lesson.level && <span className="text-xs font-mono text-slate-400">{lesson.level}</span>}
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">{lesson.title}</h3>
                            <p className="text-xs text-slate-400 line-clamp-2">{lesson.description || "Sin descripción."}</p>
                          </div>

                          <div className="pt-4 mt-4 border-t border-slate-800/80 flex justify-end">
                            {firstLesson ? (
                              <Link
                                href={`/dashboard/courses/${lesson.id}/lessons/${firstLesson.id}`}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                              >
                                <Edit className="w-3.5 h-3.5" /> Editar clase
                              </Link>
                            ) : (
                              <Link
                                href={`/dashboard/courses/${lesson.id}/builder`}
                                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                              >
                                <Edit className="w-3.5 h-3.5" /> Ver
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

            </div>
          )}
        </main>
      </div>
    </div>
  );
}

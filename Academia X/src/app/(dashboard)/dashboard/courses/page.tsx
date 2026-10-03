import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { CourseService } from "@/modules/course/course.service";
import Link from "next/link";
import { BookOpen, Plus, Sparkles, Layers, Edit, Globe } from "lucide-react";
import { DeleteCourseButton } from "@/components/dashboard/DeleteCourseButton";

export default async function CoursesPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;

  const allContent = await CourseService.getCoursesByTenant(tenantId);
  const courses = allContent.filter((c) => c.contentType === "COURSE");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
                <Layers className="w-7 h-7 text-blue-400" /> Mis Cursos
              </h1>
              <p className="text-slate-400 text-sm">
                Programas completos con módulos, precio, landing y certificado.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/ai-copilot"
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-blue-400 font-medium text-sm transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" /> Copiloto IA
              </Link>
              <Link
                href="/dashboard/courses/new/course"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nuevo Curso
              </Link>
            </div>
          </div>

          {courses.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center max-w-xl mx-auto my-12">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-5">
                <Layers className="w-7 h-7 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">No tienes cursos todavía</h2>
              <p className="text-sm text-slate-400 mb-6">
                Crea tu primer programa con módulos y lecciones. Puedes usar el Copiloto IA para generar la estructura en minutos.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/dashboard/courses/new/course"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" /> Crear curso manualmente
                </Link>
                <Link
                  href="/dashboard/ai-copilot"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 font-medium text-sm transition-colors border border-slate-700"
                >
                  <Sparkles className="w-4 h-4" /> Generar con IA
                </Link>
              </div>
            </div>
          ) : (
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
                            : course.status === "ARCHIVED"
                              ? "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>
                          {course.status === "PUBLISHED" ? "Publicado" : course.status === "ARCHIVED" ? "Archivado" : "Borrador"}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{course.level}</span>
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2">{course.title}</h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4">{course.description || "Sin descripción."}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-400 font-mono mb-2">
                        <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-blue-400" /> {course.modules.length} Módulos</span>
                        <span>•</span>
                        <span>{totalLessons} Lecciones</span>
                      </div>
                      {totalLessons === 0 && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 flex items-center gap-2">
                          <span className="font-bold">⚠</span> Sin lecciones — agrega contenido en el builder
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                      <div className="text-lg font-bold text-white">${Number(course.priceAmount)} <span className="text-xs text-slate-400 font-normal">{course.currency}</span></div>
                      <div className="flex items-center gap-2">
                        <DeleteCourseButton courseId={course.id} courseTitle={course.title} lessonCount={totalLessons} />
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
          )}
        </main>
      </div>
    </div>
  );
}

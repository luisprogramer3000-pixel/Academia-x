import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { CourseService } from "@/modules/course/course.service";
import { createModuleAction, createLessonAction, toggleCourseStatusAction } from "@/app/actions/course.actions";
import { CourseSettingsForm } from "@/components/dashboard/CourseSettingsForm";
import { CourseLandingPanel } from "@/components/dashboard/CourseLandingPanel";
import { CourseStructurePanel } from "@/components/dashboard/CourseStructurePanel";
import { DevelopLessonsPanel } from "@/components/dashboard/DevelopLessonsPanel";
import { isLessonEmpty } from "@/modules/course/lesson-develop.service";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Layers, Plus, BookOpen, Edit, Eye, ArrowLeft, CheckCircle2, Globe, FileText, Sparkles, ShieldCheck, AlertCircle } from "lucide-react";
import { PdfExportButton } from "@/components/dashboard/PdfExportButton";
import { GenerateLessonContentButton } from "@/components/dashboard/GenerateLessonContentButton";
import { DeleteItemButton } from "@/components/dashboard/DeleteItemButton";
import { AddPageButton, type PageTool } from "@/components/dashboard/AddPageButton";
import { MATERIAL_TOOLS } from "@/modules/ai/material-tools";
import { parseLessonBlocks } from "@/components/lesson/lesson-blocks";

// Herramientas IA que se pueden añadir como página del curso (la rúbrica es solo para el profesor)
const PAGE_TOOLS: PageTool[] = MATERIAL_TOOLS.filter((t) => t.id !== "rubrica").map(
  ({ id, name, emoji, description, countLabel, defaultCount, maxCount }) => ({ id, name, emoji, description, countLabel, defaultCount, maxCount })
);

interface BuilderPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ generar?: string; publico?: string; desarrollar?: string }>;
}

export default async function CourseBuilderPage({ params, searchParams }: BuilderPageProps) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  const course = await CourseService.getCourseWithCurriculum(tenantId, id);

  if (!course) {
    notFound();
  }

  const courseData = course;

  const isDraft = courseData.status === "DRAFT";
  const isLesson = courseData.contentType === "STANDALONE_LESSON";

  // Lecciones sin contenido (p. ej. recién creadas por la estructura con IA)
  const [lessonRows, wallet, researchRow] = await Promise.all([
    prisma.lesson.findMany({
      where: { module: { courseId: courseData.id } },
      orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
      select: { id: true, title: true, content: true, module: { select: { title: true } } },
    }),
    AICreditEngine.getTenantWalletSummary(tenantId),
    prisma.course.findUnique({ where: { id: courseData.id }, select: { researchBrief: true } }),
  ]);
  const researchBrief = researchRow?.researchBrief as { brief?: string; sources?: Array<{ title: string; url: string }>; webSearch?: boolean } | null;
  const research = researchBrief?.brief ? { sources: researchBrief.sources ?? [], webSearch: researchBrief.webSearch === true } : null;
  const emptyLessons = lessonRows
    .filter((l) => isLessonEmpty(l.content))
    .map((l) => ({ id: l.id, title: l.title, moduleTitle: l.module.title }));

  // Lecciones sueltas no tienen builder — redirigir directamente al editor
  if (isLesson) {
    const firstLesson = courseData.modules[0]?.lessons[0];
    if (firstLesson) {
      redirect(`/dashboard/lessons/${firstLesson.id}/editar`);
    }
    // Si aún no tiene lección (estado raro), redirigir al listado
    redirect("/dashboard/lessons");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/dashboard/courses"
              className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {isLesson ? "Volver a mis recursos" : "Volver al catálogo de cursos"}
            </Link>

            {/* AI Review Banner — solo para cursos completos */}
            {isDraft && !isLesson && (
              <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 flex-shrink-0">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider block">
                      Flujo Pedagógico de Calidad
                    </span>
                    <p className="text-xs text-slate-300">
                      Este borrador fue diseñado por el Copiloto IA. Revisa los módulos y lecciones, edita el contenido y haz clic en <strong className="text-emerald-400 font-semibold">Aprobar y Publicar</strong> cuando esté listo.
                    </p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 text-xs text-slate-400 font-mono border border-slate-800 flex-shrink-0">
                  <span>AI</span>
                  <span>→</span>
                  <span className="text-amber-400 font-bold">Review</span>
                  <span>→</span>
                  <span>Approve</span>
                  <span>→</span>
                  <span>Publish</span>
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  {isLesson ? (
                    <span className="px-3 py-1 rounded-md text-xs font-bold uppercase font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Lección / Clase
                    </span>
                  ) : (
                    <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase font-mono ${
                      courseData.status === "PUBLISHED"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {courseData.status === "PUBLISHED" ? "✓ Publicado y Aprobado" : "Borrador — Pendiente de Revisión"}
                    </span>
                  )}
                  {courseData.level && <span className="text-xs font-mono text-slate-400">Nivel {courseData.level}</span>}
                </div>
                <h1 className="text-3xl font-extrabold text-white">{courseData.title}</h1>
              </div>

              <div className="flex items-center gap-3">
                {/* Landing solo para cursos completos */}
                {!isLesson && (
                  <CourseLandingPanel
                    courseId={courseData.id}
                    courseTitle={courseData.title}
                    courseSlug={courseData.slug}
                    tenantSlug={tenantSlug}
                    isPublished={courseData.status === "PUBLISHED"}
                    initialLanding={(courseData.landing as never) ?? null}
                    accent={academy.primaryColor || "#2563eb"}
                  />
                )}
                <CourseSettingsForm
                  courseId={courseData.id}
                  initial={{
                    title: courseData.title,
                    description: courseData.description,
                    level: courseData.level,
                    language: courseData.language,
                    priceAmount: Number(courseData.priceAmount),
                    currency: courseData.currency,
                    paymentType: courseData.paymentType,
                    paymentLink: courseData.paymentLink,
                    paymentInstructions: courseData.paymentInstructions,
                    freePreview: courseData.freePreview,
                  }}
                />
                <PdfExportButton />
                {/* Publicar solo para cursos completos */}
                {!isLesson && (
                  <form action={toggleCourseStatusAction.bind(null, courseData.id, courseData.status)}>
                    <button
                      type="submit"
                      className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center gap-2 ${
                        courseData.status === "PUBLISHED"
                          ? "bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30"
                      }`}
                    >
                      {courseData.status === "PUBLISHED" ? (
                        <>
                          <AlertCircle className="w-4 h-4" /> Volver a Borrador
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" /> Aprobar y Publicar Curso
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Curriculum Tree */}
            <div className="lg:col-span-2 space-y-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-400" /> Estructura del Currículo
              </h2>

              {courseData.modules.length > 0 ? (
                courseData.modules.map((mod, modIdx) => (
                  <div key={mod.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                      <h3 className="font-bold text-white text-base">
                        Módulo {modIdx + 1}: {mod.title}
                      </h3>
                      <DeleteItemButton
                        type="module"
                        itemId={mod.id}
                        itemTitle={mod.title}
                      />
                    </div>

                    {/* Lessons list */}
                    <div className="space-y-2 mb-4">
                      {mod.lessons.length === 0 && (
                        <AddPageButton courseId={courseData.id} moduleId={mod.id} afterLessonId={null} tools={PAGE_TOOLS} />
                      )}
                      {mod.lessons.map((lesson) => (
                        <div key={lesson.id} className="space-y-2">
                        <div
                          className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/40 transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-blue-400" />
                            <span className="text-sm text-slate-200 font-medium">{lesson.title}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <GenerateLessonContentButton
                              lessonId={lesson.id}
                              lessonTitle={lesson.title}
                              courseTitle={courseData.title}
                              courseLevel={courseData.level || "B1"}
                              courseLanguage={courseData.language || "es"}
                              hasContent={parseLessonBlocks(lesson.content).length > 0}
                            />
                            <Link
                              href={`/dashboard/courses/${courseData.id}/lessons/${lesson.id}`}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" /> Editar
                            </Link>
                            <DeleteItemButton
                              type="lesson"
                              itemId={lesson.id}
                              itemTitle={lesson.title}
                            />
                          </div>
                        </div>
                        <AddPageButton
                          courseId={courseData.id}
                          moduleId={mod.id}
                          afterLessonId={lesson.id}
                          afterTitle={lesson.title}
                          tools={PAGE_TOOLS}
                        />
                        </div>
                      ))}
                    </div>

                    {/* Form para agregar lección */}
                    <form action={createLessonAction} className="flex items-center gap-2 pt-2">
                      <input type="hidden" name="courseId" value={courseData.id} />
                      <input type="hidden" name="moduleId" value={mod.id} />
                      <input
                        type="text"
                        name="title"
                        required
                        placeholder="Nombre de la nueva lección..."
                        className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar Lección
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                  <p className="mb-2 font-medium text-slate-300">Sin módulos todavía</p>
                  <p className="text-sm">Usa <strong className="text-indigo-400">Generar módulos con IA</strong> en el panel derecho para crearlos automáticamente, o añádelos manualmente.</p>
                </div>
              )}
            </div>

            {/* Sidebar Form: Agregar Módulo */}
            <div className="space-y-6">
              <DevelopLessonsPanel courseId={courseData.id} research={research} lessons={emptyLessons} credits={wallet.teacherCredits.available} autoOpen={sp.desarrollar === "1"} />

              <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30">
                <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" /> Generar módulos con IA
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  La IA crea los módulos y lecciones del curso automáticamente. Puedes revisar antes de aplicar.
                </p>
                <CourseStructurePanel
                  courseId={courseData.id}
                  courseTitle={courseData.title}
                  courseLevel={courseData.level}
                  hasExistingModules={courseData.modules.length > 0}
                  autoStart={sp.generar === "1"}
                  initialAudience={(sp.publico ?? "").slice(0, 200)}
                />
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-400" /> Crear Nuevo Módulo
                </h3>

                <form action={createModuleAction} className="space-y-4">
                  <input type="hidden" name="courseId" value={courseData.id} />

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Título del Módulo</label>
                    <input
                      type="text"
                      name="title"
                      required
                      placeholder="Ej. Módulo 3: Expresión Oral Avanzada"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Descripción (Opcional)</label>
                    <textarea
                      name="description"
                      rows={2}
                      placeholder="Objetivo del módulo..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Añadir Módulo
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

// Las Server Actions de IA pueden tardar (generación de cursos): ampliar el límite de la función serverless
export const maxDuration = 120;

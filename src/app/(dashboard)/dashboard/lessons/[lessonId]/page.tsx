import Link from "next/link";
import { notFound } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { prisma } from "@/lib/db";
import { LessonReader } from "@/components/lesson/LessonReader";
import { parseLessonBlocks } from "@/components/lesson/lesson-blocks";
import { TeacherPlanPanel } from "@/components/dashboard/TeacherPlanPanel";
import type { TeacherPlan } from "@/components/dashboard/ClassAgentWizard";
import { LessonsActionBar } from "../LessonsActionBar";
import { ArrowLeft, Pencil } from "lucide-react";

/** Página de una lección suelta: vista del alumno (con actividades para probar), guion y descargas. */
export default async function LessonViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ nueva?: string; img?: string }>;
}) {
  const { lessonId } = await params;
  const { nueva, img } = await searchParams;
  const [imgDone, imgAsked] = (img ?? "").split("-").map(Number);
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { tenantId, deletedAt: null } } },
    select: { id: true, title: true, content: true, teacherPlan: true, module: { select: { course: { select: { level: true } } } } },
  });
  if (!lesson) notFound();

  const accent = academy.primaryColor || "#2563EB";
  const blocks = parseLessonBlocks(lesson.content);
  const plan = lesson.teacherPlan as TeacherPlan | null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        <main className="p-8 flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/dashboard/lessons" className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 font-semibold">
                <ArrowLeft className="w-3.5 h-3.5" /> Volver a mis lecciones
              </Link>
              <Link
                href={`/dashboard/lessons/${lesson.id}/editar`}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" /> Editar lección
              </Link>
            </div>

            {nueva === "1" && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                ✓ Lección creada con IA y guardada en <strong>Lecciones</strong> (y en Mis recursos). Así la verán tus alumnos: puedes probar
                las actividades aquí mismo.
              </div>
            )}
            {nueva === "1" && imgAsked > 0 && imgDone < imgAsked && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                Se generaron {imgDone || 0} de {imgAsked} imágenes. Los créditos de las que no se pudieron crear se han devuelto
                automáticamente. Puedes añadir imágenes desde <strong>Editar lección</strong>.
              </div>
            )}

            <LessonsActionBar primaryColor={accent} lessons={[{ lessonId: lesson.id, title: lesson.title, level: lesson.module.course.level }]} />

            {plan && <TeacherPlanPanel plan={plan} />}

            <LessonReader lessonId={lesson.id} title={lesson.title} eyebrow="Vista del alumno" blocks={blocks} mode="student" practice accent={accent} />
          </div>
        </main>
      </div>
    </div>
  );
}

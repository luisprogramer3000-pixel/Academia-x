import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { LessonBlockEditor } from "@/components/dashboard/LessonBlockEditor";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface LessonPageProps {
  params: Promise<{ id: string; lessonId: string }>;
  searchParams: Promise<{ nueva?: string }>;
}

export default async function LessonEditorPage({ params, searchParams }: LessonPageProps) {
  const { id: courseId, lessonId } = await params;
  const { nueva } = await searchParams;
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;

  // La lección debe pertenecer al curso indicado y a la academia de la sesión
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { courseId, course: { tenantId, deletedAt: null } } },
    include: { module: { select: { course: { select: { contentType: true } } } } },
  });

  if (!lesson) {
    notFound();
  }

  const isStandalone = lesson.module.course.contentType === "STANDALONE_LESSON";
  // Las lecciones sueltas viven en la sección Lecciones, no en Cursos
  if (isStandalone) redirect(nueva === "1" ? `/dashboard/lessons/${lessonId}?nueva=1` : `/dashboard/lessons/${lessonId}/editar`);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          <div className="mb-6">
            <Link
              href={isStandalone ? "/dashboard/lessons" : `/dashboard/courses/${courseId}/builder`}
              className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> {isStandalone ? "Volver a mis lecciones" : "Volver al constructor de currículo"}
            </Link>
          </div>

          <LessonBlockEditor
            lessonId={lesson.id}
            courseId={courseId}
            lessonTitle={lesson.title}
            initialContentJson={lesson.content}
            initialLiveUrl={lesson.liveUrl}
            initialTeacherPlan={(lesson.teacherPlan as never) ?? null}
            tenantSlug={academy.slug}
            isNew={nueva === "1"}
            previewHref={`/campus/courses/${courseId}`}
            accentColor={academy.primaryColor || "#2563eb"}
          />
        </main>
      </div>
    </div>
  );
}

// Las Server Actions de IA pueden tardar (generación de cursos): ampliar el límite de la función serverless
export const maxDuration = 60;

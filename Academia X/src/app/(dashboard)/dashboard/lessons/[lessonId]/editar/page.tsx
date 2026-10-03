import Link from "next/link";
import { notFound } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { prisma } from "@/lib/db";
import { LessonBlockEditor } from "@/components/dashboard/LessonBlockEditor";
import { ArrowLeft } from "lucide-react";

export const maxDuration = 60;

/** Editor de una lección suelta, dentro de la sección Lecciones. */
export default async function EditStandaloneLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { tenantId } } },
    include: { module: { select: { courseId: true } } },
  });
  if (!lesson) notFound();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        <main className="p-8 flex-1 overflow-y-auto">
          <div className="mb-6">
            <Link href={`/dashboard/lessons/${lesson.id}`} className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 font-semibold">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a la lección
            </Link>
          </div>
          <LessonBlockEditor
            lessonId={lesson.id}
            courseId={lesson.module.courseId}
            lessonTitle={lesson.title}
            initialContentJson={lesson.content}
            initialLiveUrl={lesson.liveUrl}
            initialTeacherPlan={(lesson.teacherPlan as never) ?? null}
            tenantSlug={academy.slug}
            previewHref={`/dashboard/lessons/${lesson.id}`}
            accentColor={academy.primaryColor || "#2563eb"}
          />
        </main>
      </div>
    </div>
  );
}

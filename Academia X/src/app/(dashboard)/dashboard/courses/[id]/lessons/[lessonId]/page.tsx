import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { LessonBlockEditor } from "@/components/dashboard/LessonBlockEditor";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";

interface LessonPageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function LessonEditorPage({ params }: LessonPageProps) {
  const { id: courseId, lessonId } = await params;
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  // La lección debe pertenecer al curso indicado y a la academia de la sesión
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { courseId, course: { tenantId } } },
  });

  if (!lesson) {
    notFound();
  }

  const lessonTitle = lesson.title;
  const activeLessonId = lesson.id;
  const initialContentJson = lesson.content;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          <div className="mb-6">
            <Link
              href={`/dashboard/courses/${courseId}/builder`}
              className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 font-semibold"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al constructor de currículo
            </Link>
          </div>

          <LessonBlockEditor
            lessonId={activeLessonId}
            courseId={courseId}
            lessonTitle={lessonTitle}
            initialContentJson={initialContentJson}
            initialLiveUrl={lesson.liveUrl}
            tenantSlug={tenantSlug}
          />
        </main>
      </div>
    </div>
  );
}

// Las Server Actions de IA pueden tardar (generación de cursos): ampliar el límite de la función serverless
export const maxDuration = 60;

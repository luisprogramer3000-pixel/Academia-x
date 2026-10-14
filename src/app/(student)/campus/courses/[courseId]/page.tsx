import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDashboardContext } from "@/lib/session";
import { CourseService } from "@/modules/course/course.service";
import { PublicLMSViewer } from "@/components/public/PublicLMSViewer";
import { StudentAIPanel } from "@/components/student/StudentAIPanel";
import { stripQuizAnswers } from "@/modules/course/quiz.service";
import { BrandScope } from "@/lib/brand-theme";

interface CampusCoursePageProps {
  params: Promise<{ courseId: string }>;
}

/**
 * Visor del curso para alumnos inscritos (o staff de la academia) con progreso real.
 */
export default async function CampusCoursePage({ params }: CampusCoursePageProps) {
  const { courseId } = await params;
  const ctx = await getDashboardContext(["OWNER", "TEACHER", "STUDENT"]);
  const { tenantId, userId, role, tenant } = ctx;

  const course = await CourseService.getCourseWithCurriculum(tenantId, courseId);
  if (!course) notFound();

  if (role === "STUDENT") {
    if (course.status !== "PUBLISHED") notFound();
    const enrollment = await prisma.enrollment.findFirst({
      where: { courseId, membership: { userId, tenantId } },
      select: { id: true },
    });
    if (!enrollment) {
      redirect(`/campus?error=${encodeURIComponent("No estás inscrito en este curso.")}`);
    }
  }

  const progress = await CourseService.getUserCourseProgress(userId, courseId);

  // El Tutor IA solo aparece si el propietario lo activó: su consumo sale de
  // los créditos del profesor (Configuración → Tutor IA para alumnos).
  const wallet = await prisma.aICreditWallet.findUnique({
    where: { tenantId },
    select: { allowTeacherCreditsForStudents: true },
  });
  const tutorEnabled = wallet?.allowTeacherCreditsForStudents ?? false;

  return (
    <>
    <PublicLMSViewer
      id={course.id}
      title={course.title}
      tenantSlug={tenant.slug}
      courseSlug={course.slug}
      academyName={tenant.name}
      primaryColor={tenant.primaryColor || "#2563eb"}
      backgroundColor={tenant.secondaryColor}
      modules={course.modules.map((m) => ({
        id: m.id,
        title: m.title,
        // Las respuestas correctas NO viajan al navegador del alumno
        lessons: m.lessons.map((l) => ({
          id: l.id,
          title: l.title,
          content: stripQuizAnswers(l.content),
          liveUrl: l.liveUrl,
        })),
      }))}
      completedLessonIds={progress.completedLessonIds}
      mode="student"
      backHref={
        role === "STUDENT"
          ? "/campus"
          : course.contentType === "STANDALONE_LESSON"
          ? "/dashboard/lessons"
          : `/dashboard/courses/${course.id}/builder`
      }
    />

      {tutorEnabled && (
        <BrandScope color={tenant.secondaryColor} className="border-t border-slate-800">
          <div className="max-w-4xl mx-auto px-8 py-8">
            <StudentAIPanel context={course.title} language={course.language || "es"} />
          </div>
        </BrandScope>
      )}
    </>
  );
}

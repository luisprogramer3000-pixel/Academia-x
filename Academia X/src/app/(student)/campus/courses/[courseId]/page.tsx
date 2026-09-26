import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDashboardContext } from "@/lib/session";
import { CourseService } from "@/modules/course/course.service";
import { PublicLMSViewer } from "@/components/public/PublicLMSViewer";

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

  return (
    <PublicLMSViewer
      id={course.id}
      title={course.title}
      tenantSlug={tenant.slug}
      courseSlug={course.slug}
      academyName={tenant.name}
      primaryColor={tenant.primaryColor || "#2563eb"}
      modules={course.modules.map((m) => ({
        id: m.id,
        title: m.title,
        lessons: m.lessons.map((l) => ({ id: l.id, title: l.title, content: l.content, liveUrl: l.liveUrl })),
      }))}
      completedLessonIds={progress.completedLessonIds}
      mode="student"
      backHref="/campus"
    />
  );
}

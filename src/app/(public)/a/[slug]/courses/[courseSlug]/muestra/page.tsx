import { notFound, redirect } from "next/navigation";
import { Metadata } from "next";
import { CourseService } from "@/modules/course/course.service";
import { stripQuizAnswers } from "@/modules/course/quiz.service";
import { PublicLMSViewer } from "@/components/public/PublicLMSViewer";
import { BrandScope } from "@/lib/brand-theme";

interface Props {
  params: Promise<{ slug: string; courseSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, courseSlug } = await params;
  const course = await CourseService.getPublicCourseBySlug(slug, courseSlug);
  return { title: course ? `Lección de muestra — ${course.title}` : "Curso no encontrado" };
}

/**
 * Lección de muestra gratis: la primera lección completa y el resto del temario
 * con candado. Separada de la landing, que es solo de promoción. Solo existe si
 * el profesor dejó activada la lección de muestra en los ajustes del curso.
 */
export default async function CourseSamplePage({ params }: Props) {
  const { slug, courseSlug } = await params;
  const course = await CourseService.getPublicCourseBySlug(slug, courseSlug);
  if (!course) notFound();

  const landingHref = `/a/${slug}/courses/${courseSlug}`;
  if (!course.freePreview) redirect(landingHref);

  const enrollHref = `${landingHref}/inscripcion`;
  const isPaid = Number(course.priceAmount) > 0;
  let isFirstLesson = true;
  const modules = course.modules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => {
      const content = isFirstLesson
        ? stripQuizAnswers(l.content)
        : JSON.stringify({
            blocks: [{
              id: "locked",
              type: "text",
              content: isPaid
                ? "🔒 Esta lección está disponible para alumnos inscritos. Inscríbete y, cuando la academia confirme tu pago, tendrás acceso a todo el curso."
                : "🔒 Esta lección está disponible para alumnos inscritos. La inscripción es gratuita.",
            }],
          });
      isFirstLesson = false;
      return { id: l.id, title: l.title, content, liveUrl: l.liveUrl };
    }),
  }));

  return (
    <BrandScope color={course.tenant.secondaryColor}>
      <PublicLMSViewer
        id={course.id}
        title={course.title}
        tenantSlug={slug}
        courseSlug={courseSlug}
        academyName={course.tenant.name}
        primaryColor={course.tenant.primaryColor || "#2563eb"}
        backgroundColor={course.tenant.secondaryColor}
        modules={modules}
        mode="preview"
        joinHref={enrollHref}
        backHref={landingHref}
      />
    </BrandScope>
  );
}

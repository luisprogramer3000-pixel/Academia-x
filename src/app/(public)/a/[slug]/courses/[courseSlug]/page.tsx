import { CourseService } from "@/modules/course/course.service";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { CourseLandingView, type CourseLandingContent } from "@/components/landing/course-landing/CourseLandingView";
import { courseLandingProps } from "@/components/landing/course-landing/landing-props";

interface PublicCourseViewProps {
  params: Promise<{ slug: string; courseSlug: string }>;
}

export async function generateMetadata({ params }: PublicCourseViewProps): Promise<Metadata> {
  const { slug, courseSlug } = await params;
  const dbCourse = await CourseService.getPublicCourseBySlug(slug, courseSlug);

  return {
    title: dbCourse ? `${dbCourse.title} — ${dbCourse.tenant.name}` : "Curso no encontrado | Mentor Studio Global",
    description: dbCourse?.description || "Aprende idiomas de forma estructurada e interactiva en Mentor Studio Global.",
  };
}

/**
 * Landing pública de un curso: SOLO promoción, con el modelo que eligió el
 * profesor. El contenido no se muestra aquí: la lección de muestra tiene su
 * propia página (/muestra) y el curso completo se ve en el campus tras inscribirse.
 */
export default async function PublicCourseLandingPage({ params }: PublicCourseViewProps) {
  const { slug, courseSlug } = await params;

  const dbCourse = await CourseService.getPublicCourseBySlug(slug, courseSlug);
  if (!dbCourse) {
    notFound();
  }

  const props = courseLandingProps(dbCourse, slug);
  return <CourseLandingView {...props} landing={(dbCourse.landing as CourseLandingContent | null) ?? null} />;
}

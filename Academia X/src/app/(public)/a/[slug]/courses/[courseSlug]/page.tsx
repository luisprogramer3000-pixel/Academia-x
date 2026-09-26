import { CourseService } from "@/modules/course/course.service";
import { PublicLMSViewer } from "@/components/public/PublicLMSViewer";
import { notFound } from "next/navigation";
import { Metadata } from "next";

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
 * Vista pública (previsualización) de un curso publicado.
 * Solo la primera lección muestra su contenido; el resto requiere inscripción
 * y se consume desde el campus del alumno (/campus).
 */
export default async function PublicCourseViewerPage({ params }: PublicCourseViewProps) {
  const { slug, courseSlug } = await params;

  const dbCourse = await CourseService.getPublicCourseBySlug(slug, courseSlug);
  if (!dbCourse) {
    notFound();
  }

  let isFirstLesson = true;
  const modules = dbCourse.modules.map((m) => ({
    id: m.id,
    title: m.title,
    lessons: m.lessons.map((l) => {
      const content = isFirstLesson ? l.content : JSON.stringify({
        blocks: [{ id: "locked", type: "text", content: "🔒 Esta lección está disponible para alumnos inscritos." }],
      });
      isFirstLesson = false;
      return { id: l.id, title: l.title, content, liveUrl: l.liveUrl };
    }),
  }));

  return (
    <PublicLMSViewer
      id={dbCourse.id}
      title={dbCourse.title}
      tenantSlug={slug}
      courseSlug={courseSlug}
      academyName={dbCourse.tenant.name}
      primaryColor={dbCourse.tenant.primaryColor || "#2563eb"}
      modules={modules}
      mode="preview"
      joinHref={`/a/${slug}/join`}
    />
  );
}

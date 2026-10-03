import { notFound } from "next/navigation";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { CourseService } from "@/modules/course/course.service";
import { courseLandingProps } from "@/components/landing/course-landing/landing-props";
import type { CourseLandingContent } from "@/components/landing/course-landing/CourseLandingView";
import { LandingPreviewClient } from "./LandingPreviewClient";

export const metadata = { title: "Vista previa de la landing", robots: { index: false } };

/**
 * Vista previa de la landing para el profesor (también de cursos en borrador).
 * Muestra el borrador que el panel guarda en el navegador, sin publicarlo.
 */
export default async function LandingPreviewPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const ctx = await getDashboardContext(STAFF_ROLES, { requirePlan: false });
  const course = await CourseService.getCourseWithCurriculum(ctx.tenantId, courseId);
  if (!course) notFound();

  const props = courseLandingProps({ ...course, tenant: ctx.tenant }, ctx.tenant.slug);
  // En la vista previa los enlaces no navegan (el curso puede estar en borrador)
  const links = { academy: "#", enroll: "#", sample: props.links.sample ? "#" : null };

  return (
    <LandingPreviewClient
      courseId={course.id}
      saved={(course.landing as CourseLandingContent | null) ?? null}
      view={{ ...props, links }}
    />
  );
}

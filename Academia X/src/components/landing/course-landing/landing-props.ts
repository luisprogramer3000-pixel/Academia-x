import type { CourseLandingViewProps } from "./CourseLandingView";

const LANGUAGE_NAMES: Record<string, string> = {
  es: "Español", en: "Inglés", fr: "Francés", pt: "Portugués", it: "Italiano", de: "Alemán",
};

/** Datos del curso que necesita la landing (página pública y vista previa). */
export function courseLandingProps(
  course: {
    title: string;
    slug: string;
    description: string | null;
    level: string;
    language: string;
    priceAmount: unknown;
    currency: string;
    imageUrl: string | null;
    freePreview: boolean;
    tenant: { name: string; primaryColor: string | null; secondaryColor: string | null };
    modules: Array<{ id: string; title: string; lessons: Array<{ id: string; title: string }> }>;
  },
  tenantSlug: string
): Omit<CourseLandingViewProps, "landing"> {
  const price = Number(course.priceAmount);
  const base = `/a/${tenantSlug}/courses/${course.slug}`;
  return {
    course: {
      title: course.title,
      description: course.description,
      level: course.level,
      languageName: LANGUAGE_NAMES[course.language] ?? course.language,
      priceLabel: price > 0 ? `${price} ${course.currency}` : "Gratis",
      isPaid: price > 0,
      imageUrl: course.imageUrl,
      modules: course.modules.map((m) => ({ id: m.id, title: m.title, lessons: m.lessons.map((l) => ({ id: l.id, title: l.title })) })),
    },
    academy: {
      name: course.tenant.name,
      primaryColor: course.tenant.primaryColor || "#2563eb",
      secondaryColor: course.tenant.secondaryColor,
    },
    links: {
      academy: `/a/${tenantSlug}`,
      enroll: `${base}/inscripcion`,
      sample: course.freePreview ? `${base}/muestra` : null,
    },
  };
}

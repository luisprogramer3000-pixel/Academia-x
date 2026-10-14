import { notFound } from "next/navigation";
import { Metadata } from "next";
import { AcademyService } from "@/modules/academy/academy.service";
import { getAcademyLanding } from "@/modules/academy/academy-landing";
import { prisma } from "@/lib/db";
import { AcademyLandingView } from "@/components/landing/academy-landing/AcademyLandingView";

interface TenantPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { slug } = await params;
  const dbAcademy = await AcademyService.getAcademyBySlug(slug);
  if (!dbAcademy) return { title: "Academia de Idiomas | Mentor Studio Global" };
  const landing = await getAcademyLanding(dbAcademy.id);
  return {
    title: `${dbAcademy.name} — ${landing.headline || "Cursos de Idiomas"}`,
    description: landing.subheadline || `Página oficial de ${dbAcademy.name}. Explora la oferta académica de cursos interactivos de idiomas.`,
  };
}

/** Página pública de la academia, con el modelo de diseño elegido en Configuración & Branding. */
export default async function TenantPublicPage({ params }: TenantPageProps) {
  const { slug } = await params;
  const dbAcademy = await AcademyService.getAcademyBySlug(slug);
  if (!dbAcademy) notFound();

  const [landing, lessonCounts] = await Promise.all([
    getAcademyLanding(dbAcademy.id),
    prisma.course.findMany({
      where: { tenantId: dbAcademy.id, status: "PUBLISHED" },
      select: { id: true, modules: { select: { _count: { select: { lessons: true } } } } },
    }),
  ]);
  const lessonsByCourse = new Map(lessonCounts.map((c) => [c.id, c.modules.reduce((sum, m) => sum + m._count.lessons, 0)]));
  const appHost = process.env.NEXT_PUBLIC_APP_HOST || "mentorstudioglobal.com";

  return (
    <AcademyLandingView
      landing={landing}
      academy={{ name: dbAcademy.name, primaryColor: dbAcademy.primaryColor, secondaryColor: dbAcademy.secondaryColor, logoUrl: dbAcademy.logoUrl, host: `${appHost}/a/${slug}` }}
      courses={dbAcademy.courses.map((c) => ({
        id: c.id,
        title: c.title,
        level: c.level,
        lessonsCount: lessonsByCourse.get(c.id) || 0,
        price: Number(c.priceAmount) > 0 ? `$${c.priceAmount.toString()} ${c.currency}` : "Gratis",
        imageUrl: c.imageUrl,
        href: `/a/${slug}/courses/${c.slug}`,
      }))}
      links={{ login: "/login", join: `/a/${slug}/join` }}
    />
  );
}

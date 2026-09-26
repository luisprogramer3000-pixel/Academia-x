import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";
import { AcademyService } from "@/modules/academy/academy.service";
import { prisma } from "@/lib/db";
import { BookOpen, Award, CheckCircle, Sparkles, Globe, User } from "lucide-react";

interface TenantPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: TenantPageProps): Promise<Metadata> {
  const { slug } = await params;
  const dbAcademy = await AcademyService.getAcademyBySlug(slug);

  const title = dbAcademy ? `${dbAcademy.name} — Cursos de Idiomas` : "Academia de Idiomas | Mentor Studio Global";
  const description = dbAcademy
    ? `Página oficial de ${dbAcademy.name}. Explora la oferta académica de cursos interactivos de idiomas.`
    : "Aprende idiomas con profesores expertos e Inteligencia Artificial en Mentor Studio Global.";

  return {
    title,
    description,
  };
}

// Public Tenant Page component
export default async function TenantPublicPage({ params }: TenantPageProps) {
  const { slug } = await params;

  // Consultar tenant desde base de datos
  const dbAcademy = await AcademyService.getAcademyBySlug(slug);

  if (!dbAcademy) {
    notFound();
  }

  const lessonCounts = await prisma.course.findMany({
    where: { tenantId: dbAcademy.id, status: "PUBLISHED" },
    select: { id: true, modules: { select: { _count: { select: { lessons: true } } } } },
  });
  const lessonsByCourse = new Map(
    lessonCounts.map((c) => [c.id, c.modules.reduce((sum, m) => sum + m._count.lessons, 0)])
  );

  const academy = {
    name: dbAcademy.name,
    primaryColor: dbAcademy.primaryColor,
    tagline: "Formación de excelencia en enseñanza de idiomas",
    description: `Bienvenido a la página oficial de ${dbAcademy.name}. Explora nuestros cursos interactivos y potencia tu aprendizaje.`,
    courses: dbAcademy.courses.map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      level: c.level,
      lessonsCount: lessonsByCourse.get(c.id) || 0,
      price: Number(c.priceAmount) > 0 ? `$${c.priceAmount.toString()} ${c.currency}` : "Gratis",
    })),
  };
  const appHost = process.env.NEXT_PUBLIC_APP_HOST || "mentorstudioglobal.com";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header público de la Academia */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-xl text-white shadow-md"
              style={{ backgroundColor: academy.primaryColor || "#2563eb" }}
            >
              {academy.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">{academy.name}</h1>
              <span className="text-xs text-blue-400 flex items-center gap-1 font-mono">
                <Globe className="w-3 h-3" /> {slug}.{appHost}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors">Acceso Alumnos</Link>
            <Link
              href={`/a/${slug}/join`}
              className="px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors shadow-lg"
              style={{ backgroundColor: academy.primaryColor || "#2563eb" }}
            >
              Inscribirse
            </Link>
          </div>
        </div>
      </header>

      {/* Hero de la Academia */}
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <span className="inline-block px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-6">
            Academia Certificada
          </span>
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            {academy.tagline}
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-2xl mx-auto">
            {academy.description}
          </p>
        </div>
      </section>

      {/* Catálogo de Cursos */}
      <section className="py-16 max-w-7xl mx-auto px-6">
        <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-400" /> Cursos Disponibles
        </h3>

        {academy.courses.length > 0 ? (
          <div className="grid md:grid-cols-2 gap-8">
            {academy.courses.map((course) => (
              <div key={course.id} className="p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="px-3 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-semibold">{course.level}</span>
                  </div>
                  <h4 className="text-xl font-bold text-white mb-3">{course.title}</h4>
                  <p className="text-sm text-slate-400 mb-6">{course.lessonsCount} lecciones interactivas + certificado final.</p>
                </div>

                <div className="pt-6 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="text-2xl font-bold text-white">{course.price}</div>
                  <Link
                    href={`/a/${slug}/courses/${course.slug}`}
                    className="px-5 py-2.5 rounded-xl text-white font-medium text-sm transition-colors shadow-md"
                    style={{ backgroundColor: academy.primaryColor || "#2563eb" }}
                  >
                    Ver Detalles del Curso
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
            Próximamente se publicarán cursos en esta academia.
          </div>
        )}
      </section>
    </div>
  );
}

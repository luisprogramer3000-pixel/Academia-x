import type { CSSProperties } from "react";
import { ArrowRight, Award, BookOpen, Layers, Sparkles } from "lucide-react";
import { getLandingTemplate, landingVars } from "../course-landing/templates";

/**
 * Página pública principal de la academia con los mismos modelos de diseño que
 * las landings de curso. Sin dependencias de servidor: la usan la página
 * pública y la vista previa del panel (el profesor ve lo mismo que el visitante).
 */

export interface AcademyLandingContent {
  template?: string;
  headline?: string;
  subheadline?: string;
  callToAction?: string;
  heroImageUrl?: string;
}

export interface AcademyLandingCourse {
  id: string;
  title: string;
  level: string;
  lessonsCount: number;
  price: string;
  imageUrl?: string | null;
  href: string;
}

export interface AcademyLandingViewProps {
  landing: AcademyLandingContent | null;
  academy: { name: string; primaryColor: string; secondaryColor?: string | null; logoUrl?: string | null; host: string };
  courses: AcademyLandingCourse[];
  links: { login: string; join: string };
}

export function AcademyLandingView({ landing, academy, courses, links }: AcademyLandingViewProps) {
  const template = getLandingTemplate(landing?.template);
  const heroImageUrl = landing?.heroImageUrl || courses.find((c) => c.imageUrl)?.imageUrl || null;
  const vars = landingVars(template, { accent: academy.primaryColor, brandBg: academy.secondaryColor, heroImageUrl });
  const headline = landing?.headline || "Formación de excelencia en enseñanza de idiomas";
  const subheadline = landing?.subheadline || `Bienvenido a la página oficial de ${academy.name}. Explora nuestros cursos interactivos y potencia tu aprendizaje.`;
  const cta = landing?.callToAction || "Ver cursos";
  const centered = template.heroAlign === "center";
  const heading = template.serif ? "font-serif" : "";
  const card = "rounded-2xl border bg-[var(--lp-surface)] border-[var(--lp-border)]";
  const initials = academy.name.slice(0, 2).toUpperCase();
  const softBorder: CSSProperties = { borderColor: "color-mix(in srgb, var(--lp-hero-text) 30%, transparent)" };

  return (
    <div style={vars as CSSProperties} className="min-h-screen bg-[var(--lp-bg)] text-[var(--lp-text)]">
      {/* Portada con la barra superior */}
      <div style={{ background: "var(--lp-hero-bg)" }} className="text-[var(--lp-hero-text)]">
        <header className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {academy.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={academy.logoUrl} alt={academy.name} className="h-11 w-11 rounded-xl object-cover bg-white" />
            ) : (
              <div className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-lg bg-[var(--lp-accent)] text-[var(--lp-accent-text)] shrink-0">{initials}</div>
            )}
            <div className="min-w-0">
              <p className={`font-bold text-lg leading-tight truncate ${heading}`}>{academy.name}</p>
              <p className="text-[11px] font-mono truncate text-[var(--lp-hero-muted)]">{academy.host}</p>
            </div>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3 shrink-0">
            <a href={links.login} className="px-3 py-2 text-sm font-medium hover:opacity-80 text-[var(--lp-hero-muted)]">Acceso alumnos</a>
            <a href={links.join} className="px-4 py-2 rounded-xl text-sm font-bold shadow-lg bg-[var(--lp-hero-btn)] text-[var(--lp-hero-btn-text)]">Inscribirse</a>
          </nav>
        </header>

        <section className={`max-w-5xl mx-auto px-4 sm:px-6 ${template.usesImage ? "pt-20 pb-28 sm:pt-28 sm:pb-36" : "pt-14 pb-20 sm:pt-20 sm:pb-24"} ${centered ? "text-center" : ""}`}>
          <span style={softBorder} className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.18em] mb-6 border opacity-90">
            <Award className="w-3.5 h-3.5" /> Academia certificada
          </span>
          <h1 className={`text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] mb-6 ${heading} ${centered ? "max-w-4xl mx-auto" : "max-w-3xl"}`}>{headline}</h1>
          <p className={`text-base sm:text-lg leading-relaxed mb-9 text-[var(--lp-hero-muted)] ${centered ? "max-w-2xl mx-auto" : "max-w-2xl"}`}>{subheadline}</p>
          <div className={`flex flex-col sm:flex-row gap-3 ${centered ? "items-center justify-center" : "items-start"}`}>
            <a href="#cursos" className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold shadow-lg text-center transition-transform hover:scale-[1.02] bg-[var(--lp-hero-btn)] text-[var(--lp-hero-btn-text)] inline-flex items-center justify-center gap-2">
              {cta} <ArrowRight className="w-4 h-4" />
            </a>
            <a href={links.join} style={softBorder} className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-center border hover:opacity-80">
              Inscribirme
            </a>
          </div>
        </section>
      </div>

      {/* Catálogo de cursos */}
      <section id="cursos" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 scroll-mt-4">
        <h2 className={`text-2xl sm:text-3xl font-extrabold mb-2 flex items-center gap-2 ${heading}`}>
          <BookOpen className="w-6 h-6 text-[var(--lp-accent)]" /> Cursos disponibles
        </h2>
        <p className="text-sm text-[var(--lp-muted)] mb-8">Elige tu curso y empieza hoy. Cada curso incluye lecciones interactivas y certificado final.</p>

        {courses.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((c) => (
              <a key={c.id} href={c.href} className={`${card} overflow-hidden flex flex-col group transition-transform hover:-translate-y-1`}>
                <div className="h-40 relative bg-[var(--lp-border)]">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--lp-hero-bg)" }}>
                      <Sparkles className="w-10 h-10 text-[var(--lp-hero-text)] opacity-70" />
                    </div>
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md text-xs font-bold bg-[var(--lp-accent)] text-[var(--lp-accent-text)]">{c.level}</span>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className={`text-lg font-bold mb-2 ${heading}`}>{c.title}</h3>
                  <p className="text-sm text-[var(--lp-muted)] mb-5 flex items-center gap-1.5">
                    <Layers className="w-4 h-4" /> {c.lessonsCount} lecciones + certificado
                  </p>
                  <div className="mt-auto pt-4 border-t border-[var(--lp-border)] flex items-center justify-between">
                    <span className="text-xl font-extrabold">{c.price}</span>
                    <span className="text-sm font-bold text-[var(--lp-accent)] inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                      Ver curso <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className={`${card} p-12 text-center text-[var(--lp-muted)]`}>Próximamente se publicarán cursos en esta academia.</div>
        )}
      </section>

      <footer className="border-t border-[var(--lp-border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-[var(--lp-muted)] flex flex-col sm:flex-row gap-2 justify-between">
          <span>© {new Date().getFullYear()} {academy.name}</span>
          <span className="font-mono text-xs">{academy.host}</span>
        </div>
      </footer>
    </div>
  );
}

import type { CSSProperties } from "react";
import { ArrowLeft, BookOpen, CheckCircle, Eye, Globe, Layers, Lock, PlayCircle, Signal, Users } from "lucide-react";
import { getLandingTemplate, landingVars } from "./templates";

/**
 * Landing de curso (solo promoción). Sin dependencias de servidor: la usan la
 * página pública y la vista previa del builder, así el profesor ve exactamente
 * lo que verá el alumno.
 */

export interface CourseLandingContent {
  template?: string;
  headline?: string;
  subheadline?: string;
  benefits?: string[];
  callToAction?: string;
  /** Público al que va dirigido (sección "¿A quién está dirigido?") */
  audience?: string;
  heroImageUrl?: string;
}

export interface CourseLandingViewProps {
  landing: CourseLandingContent | null;
  course: {
    title: string;
    description?: string | null;
    level: string;
    languageName: string;
    priceLabel: string;
    isPaid: boolean;
    imageUrl?: string | null;
    modules: Array<{ id: string; title: string; lessons: Array<{ id: string; title: string }> }>;
  };
  academy: { name: string; primaryColor: string; secondaryColor?: string | null };
  links: { academy: string; enroll: string; sample: string | null };
}

export function CourseLandingView({ landing, course, academy, links }: CourseLandingViewProps) {
  const template = getLandingTemplate(landing?.template);
  const heroImageUrl = landing?.heroImageUrl || course.imageUrl || null;
  const vars = landingVars(template, { accent: academy.primaryColor, brandBg: academy.secondaryColor, heroImageUrl });

  const headline = landing?.headline || course.title;
  const subheadline = landing?.subheadline || course.description;
  const benefits = (landing?.benefits ?? []).filter((b) => b.trim());
  const audience = (landing?.audience ?? "").trim();
  const cta = landing?.callToAction || (course.isPaid ? "Inscribirme en el curso" : "Inscribirme gratis");
  const modules = course.modules.filter((m) => m.lessons.length);
  const lessonCount = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const firstLessonId = modules[0]?.lessons[0]?.id;

  const centered = template.heroAlign === "center";
  const heading = template.serif ? "font-serif" : "";
  const card = "rounded-2xl border bg-[var(--lp-surface)] border-[var(--lp-border)]";
  const accentBtn = "rounded-xl font-bold shadow-lg transition-transform hover:scale-[1.02] bg-[var(--lp-accent)] text-[var(--lp-accent-text)]";

  return (
    <div style={vars as CSSProperties} className="min-h-screen bg-[var(--lp-bg)] text-[var(--lp-text)]">
      {/* Portada (incluye la barra superior) */}
      <div style={{ background: "var(--lp-hero-bg)" }} className="text-[var(--lp-hero-text)]">
        <header className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href={links.academy} className="flex items-center gap-2 text-sm font-bold hover:opacity-80 min-w-0">
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="truncate">{academy.name}</span>
          </a>
          <a href={links.enroll} className="px-4 py-2 rounded-xl text-sm font-bold shrink-0 bg-[var(--lp-hero-btn)] text-[var(--lp-hero-btn-text)]">
            Inscribirme
          </a>
        </header>

        <section className={`max-w-4xl mx-auto px-4 sm:px-6 ${template.usesImage ? "pt-20 pb-24 sm:pt-28 sm:pb-32" : "pt-12 pb-16 sm:pt-16 sm:pb-20"} ${centered ? "text-center" : ""}`}>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-5 opacity-80">{academy.name}</p>
          <h1 className={`text-3xl sm:text-5xl font-extrabold leading-tight mb-5 ${heading} ${centered ? "" : "max-w-3xl"}`}>{headline}</h1>
          {subheadline && (
            <p className={`text-base sm:text-lg mb-8 text-[var(--lp-hero-muted)] ${centered ? "max-w-2xl mx-auto" : "max-w-2xl"}`}>{subheadline}</p>
          )}
          <div className={`flex flex-col sm:flex-row gap-3 ${centered ? "items-center justify-center" : "items-start"}`}>
            <a href={links.enroll} className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold shadow-lg text-center transition-transform hover:scale-[1.02] bg-[var(--lp-hero-btn)] text-[var(--lp-hero-btn-text)]">
              {cta}
            </a>
            {links.sample && (
              <a href={links.sample} className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 border border-[var(--lp-hero-muted)] hover:bg-white/10">
                <Eye className="w-4 h-4" /> Ver lección de muestra gratis
              </a>
            )}
          </div>
        </section>
      </div>

      {/* Detalles del programa */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        <h2 className={`text-2xl font-extrabold text-center mb-8 ${heading}`}>Detalles del programa</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { icon: Signal, label: "Nivel", value: course.level },
            { icon: Globe, label: "Idioma", value: course.languageName },
            { icon: Layers, label: "Módulos", value: String(modules.length) },
            { icon: BookOpen, label: "Lecciones", value: String(lessonCount) },
            { icon: CheckCircle, label: "Precio", value: course.priceLabel },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className={`${card} p-5 text-center last:col-span-2 lg:last:col-span-1`}>
              <Icon className="w-5 h-5 mx-auto mb-2 text-[var(--lp-accent)]" />
              <p className="text-[11px] uppercase tracking-wider text-[var(--lp-muted)]">{label}</p>
              <p className="font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* A quién va dirigido */}
      {audience && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-14">
          <div className={`${card} p-6 sm:p-8 flex gap-4`}>
            <Users className="w-7 h-7 shrink-0 text-[var(--lp-accent)]" />
            <div>
              <h2 className={`text-xl font-extrabold mb-2 ${heading}`}>¿A quién está dirigido?</h2>
              <p className="text-[var(--lp-muted)] whitespace-pre-line">{audience}</p>
            </div>
          </div>
        </section>
      )}

      {/* Beneficios */}
      {benefits.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-14">
          <h2 className={`text-2xl font-extrabold mb-6 text-center ${heading}`}>¿Por qué este curso?</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {benefits.map((benefit, idx) => (
              <li key={idx} className={`${card} flex items-start gap-3 p-4 text-sm`}>
                <CheckCircle className="w-5 h-5 shrink-0 text-[var(--lp-accent)]" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Temario: solo títulos */}
      {lessonCount > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-14">
          <h2 className={`text-2xl font-extrabold mb-2 text-center ${heading}`}>Lo que vas a aprender</h2>
          <p className="text-sm text-[var(--lp-muted)] text-center mb-6">
            {modules.length} módulos · {lessonCount} lecciones
          </p>
          <div className="space-y-3">
            {modules.map((m, i) => (
              <div key={m.id} className={`${card} overflow-hidden`}>
                <div className="px-5 py-3.5 border-b border-[var(--lp-border)] flex items-center justify-between gap-3">
                  <h3 className="font-bold text-sm">Módulo {i + 1}: {m.title}</h3>
                  <span className="text-xs text-[var(--lp-muted)] shrink-0">{m.lessons.length} lecciones</span>
                </div>
                <ul>
                  {m.lessons.map((l) => {
                    const isSample = Boolean(links.sample) && l.id === firstLessonId;
                    return (
                      <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm border-t border-[var(--lp-border)] first:border-t-0">
                        <span className="flex items-center gap-2.5 min-w-0 text-[var(--lp-muted)]">
                          {isSample ? <PlayCircle className="w-4 h-4 shrink-0 text-[var(--lp-accent)]" /> : <Lock className="w-4 h-4 shrink-0 opacity-60" />}
                          <span className="truncate">{l.title}</span>
                        </span>
                        {isSample && (
                          <a href={links.sample!} className="text-xs font-bold shrink-0 hover:underline text-[var(--lp-accent)]">
                            Muestra gratis
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Llamada final */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <div className={`${card} p-8 text-center`}>
          <h2 className={`text-2xl font-extrabold mb-2 ${heading}`}>¿Listo para empezar?</h2>
          <p className="text-sm text-[var(--lp-muted)] mb-6">
            {course.isPaid
              ? `Inscríbete por ${course.priceLabel}. Tendrás acceso a todo el curso cuando la academia confirme tu pago.`
              : "La inscripción es gratuita y puedes empezar de inmediato."}
          </p>
          <a href={links.enroll} className={`inline-block px-8 py-3.5 ${accentBtn}`}>
            {cta}
          </a>
        </div>
      </section>

      <footer className="text-center text-xs text-[var(--lp-muted)] pb-8">
        Powered by <span className="font-bold">Mentor Studio Global</span>
      </footer>
    </div>
  );
}

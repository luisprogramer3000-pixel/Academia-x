import { brandTheme } from "@/lib/brand-theme";

/**
 * Modelos de landing de curso. Cada modelo es una paleta (variables CSS --lp-*)
 * más un estilo de portada; el contenido (titular, beneficios, temario...) es el
 * mismo en todos. No usan clases slate-* para que BrandScope no las recoloree.
 */

export type LandingTemplateId = "marca" | "impacto" | "portada" | "minimal" | "elegante" | "horizonte";

export interface LandingTemplate {
  id: LandingTemplateId;
  name: string;
  description: string;
  /** Fondo de la tarjeta del selector */
  thumb: (accent: string) => string;
  /** Portada centrada o alineada a la izquierda */
  heroAlign: "center" | "left";
  serif?: boolean;
  /** La portada usa la imagen de portada del curso */
  usesImage?: boolean;
}

export const LANDING_TEMPLATES: LandingTemplate[] = [
  {
    id: "marca",
    name: "Mi marca",
    description: "Los colores de tu academia (Configuración y Branding).",
    thumb: (a) => `linear-gradient(135deg, #f1f5f9 0%, #f1f5f9 55%, ${a} 55%, ${a} 100%)`,
    heroAlign: "center",
  },
  {
    id: "impacto",
    name: "Impacto",
    description: "Portada con degradado de tu color principal y texto blanco.",
    thumb: (a) => `radial-gradient(circle at 20% 30%, ${shade(a, 0.25)} 0 18%, transparent 19%), linear-gradient(135deg, ${a}, ${shade(a, -0.45)})`,
    heroAlign: "center",
  },
  {
    id: "portada",
    name: "Con imagen",
    description: "Foto a pantalla completa detrás del título, como una revista.",
    thumb: () => "linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), linear-gradient(120deg, #a16207, #be123c 45%, #1d4ed8)",
    heroAlign: "center",
    usesImage: true,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Blanco, tipografía grande y mucho aire. Sobrio y moderno.",
    thumb: (a) => `linear-gradient(90deg, #ffffff 0 62%, ${a} 62% 64%, #ffffff 64%)`,
    heroAlign: "left",
  },
  {
    id: "elegante",
    name: "Elegante",
    description: "Negro y dorado con letra serif. Para cursos premium.",
    thumb: () => "linear-gradient(150deg, transparent 40%, rgba(212,175,55,.55) 41%, transparent 43%), radial-gradient(circle at 70% 20%, #2a2418, #0b0b0c 60%)",
    heroAlign: "center",
    serif: true,
  },
  {
    id: "horizonte",
    name: "Horizonte",
    description: "Verde bosque con un sol suave. Cálido y natural.",
    thumb: () => "radial-gradient(circle at 50% 115%, #e7eedc 0 22%, #9fb48f 34%, #2b3d2e 62%)",
    heroAlign: "center",
  },
];

export function getLandingTemplate(id?: string | null): LandingTemplate {
  return LANDING_TEMPLATES.find((t) => t.id === id) ?? LANDING_TEMPLATES[0];
}

/** Aclara (amount > 0) u oscurece (amount < 0) un color hex. */
function shade(hex: string, amount: number): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return hex;
  const rgb = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return `#${rgb.map((v) => Math.round(v + (target - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

const LIGHT = { "--lp-bg": "#ffffff", "--lp-surface": "#f8fafc", "--lp-border": "#e2e8f0", "--lp-text": "#0f172a", "--lp-muted": "#475569" };

/** Variables CSS del modelo. */
export function landingVars(
  template: LandingTemplate,
  opts: { accent: string; brandBg?: string | null; heroImageUrl?: string | null }
): Record<string, string> {
  const accent = /^#[0-9a-f]{6}$/i.test(opts.accent) ? opts.accent : "#2563eb";
  switch (template.id) {
    case "impacto":
      return {
        ...LIGHT,
        "--lp-accent": accent, "--lp-accent-text": "#ffffff",
        "--lp-hero-bg": `radial-gradient(circle at 15% 20%, ${shade(accent, 0.18)} 0, transparent 35%), linear-gradient(135deg, ${accent}, ${shade(accent, -0.5)})`,
        "--lp-hero-text": "#ffffff", "--lp-hero-muted": "rgba(255,255,255,.85)",
        "--lp-hero-btn": "#ffffff", "--lp-hero-btn-text": accent,
      };
    case "portada": {
      const overlay = "linear-gradient(rgba(10,12,20,.55), rgba(10,12,20,.6))";
      const image = opts.heroImageUrl
        ? `${overlay}, url("${opts.heroImageUrl.replace(/"/g, "")}") center / cover no-repeat`
        : `${overlay}, linear-gradient(120deg, ${shade(accent, -0.3)}, #111827)`;
      return {
        ...LIGHT,
        "--lp-accent": accent, "--lp-accent-text": "#ffffff",
        "--lp-hero-bg": image,
        "--lp-hero-text": "#ffffff", "--lp-hero-muted": "rgba(255,255,255,.88)",
        "--lp-hero-btn": "#ffffff", "--lp-hero-btn-text": accent,
      };
    }
    case "minimal":
      return {
        "--lp-bg": "#ffffff", "--lp-surface": "#ffffff", "--lp-border": "#e5e7eb", "--lp-text": "#111827", "--lp-muted": "#6b7280",
        "--lp-accent": accent, "--lp-accent-text": "#ffffff",
        "--lp-hero-bg": "#ffffff", "--lp-hero-text": "#111827", "--lp-hero-muted": "#6b7280",
        "--lp-hero-btn": accent, "--lp-hero-btn-text": "#ffffff",
      };
    case "elegante":
      return {
        "--lp-bg": "#0b0b0c", "--lp-surface": "#141416", "--lp-border": "#2a2a2e", "--lp-text": "#f5f5f4", "--lp-muted": "#a8a29e",
        "--lp-accent": "#d4af37", "--lp-accent-text": "#111111",
        "--lp-hero-bg": "radial-gradient(circle at 75% 15%, rgba(212,175,55,.18), transparent 45%), linear-gradient(160deg, #16140f, #0b0b0c 60%)",
        "--lp-hero-text": "#f5f5f4", "--lp-hero-muted": "#d6d3d1",
        "--lp-hero-btn": "#d4af37", "--lp-hero-btn-text": "#111111",
      };
    case "horizonte":
      return {
        "--lp-bg": "#f6f4ee", "--lp-surface": "#ffffff", "--lp-border": "#e4e0d4", "--lp-text": "#1f2a22", "--lp-muted": "#5b6658",
        "--lp-accent": "#2f4a35", "--lp-accent-text": "#f6f4ee",
        "--lp-hero-bg": "radial-gradient(circle at 50% 120%, #e7eedc 0, #b8c9a8 18%, #6e8a62 34%, #2b3d2e 62%)",
        "--lp-hero-text": "#f6f4ee", "--lp-hero-muted": "rgba(246,244,238,.85)",
        "--lp-hero-btn": "#f6f4ee", "--lp-hero-btn-text": "#2b3d2e",
      };
    case "marca":
    default: {
      const v = brandTheme(opts.brandBg).style as Record<string, string>;
      return {
        "--lp-bg": v["--brand-bg"], "--lp-surface": v["--brand-surface"], "--lp-border": v["--brand-border"],
        "--lp-text": v["--brand-text"], "--lp-muted": v["--brand-muted"],
        "--lp-accent": accent, "--lp-accent-text": "#ffffff",
        "--lp-hero-bg": v["--brand-bg"], "--lp-hero-text": v["--brand-text"], "--lp-hero-muted": v["--brand-muted"],
        "--lp-hero-btn": accent, "--lp-hero-btn-text": "#ffffff",
      };
    }
  }
}

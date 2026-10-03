/**
 * Modelos de diseño para las presentaciones de lección.
 *
 * Las decoraciones se describen en pulgadas sobre la diapositiva 16:9
 * (10 × 5.625 in), así el mismo modelo se dibuja igual en PPTX y en PDF.
 */

export type TextDensity = "minimo" | "estandar" | "detallado";

export interface Deco {
  shape: "rect" | "ellipse";
  x: number;
  y: number;
  w: number;
  h: number;
  /** hex sin # */
  color: string;
  /** 0 = opaco, 100 = invisible */
  transparency?: number;
}

export interface DeckTheme {
  id: string;
  name: string;
  /** hex sin # */
  background: string;
  title: string;
  text: string;
  accent: string;
  font: string;
  decorations: Deco[];
  coverDecorations?: Deco[];
  coverBackground?: string;
  coverTitle?: string;
  /** Imagen de fondo (modelo subido o traído de la web) */
  backgroundImage?: { data: Uint8Array; mime: "image/png" | "image/jpeg" };
}

export const SLIDE_W = 10;
export const SLIDE_H = 5.625;

const rings: Deco[] = Array.from({ length: 11 }, (_, i) => ({
  shape: "ellipse" as const, x: 0.18, y: 0.35 + i * 0.47, w: 0.2, h: 0.2, color: "1E3A8A",
}));

const gridLines: Deco[] = [
  ...Array.from({ length: 21 }, (_, i) => ({ shape: "rect" as const, x: i * 0.5, y: 0, w: 0.01, h: SLIDE_H, color: "E2E8F0" })),
  ...Array.from({ length: 12 }, (_, i) => ({ shape: "rect" as const, x: 0, y: i * 0.5, w: SLIDE_W, h: 0.01, color: "E2E8F0" })),
];

export const PRESET_THEMES: DeckTheme[] = [
  {
    id: "cuaderno", name: "Cuaderno",
    background: "FFFFFF", title: "2563EB", text: "1E293B", accent: "2563EB", font: "Calibri",
    decorations: [{ shape: "rect", x: 0, y: 0, w: 0.55, h: SLIDE_H, color: "DBEAFE" }, ...rings, { shape: "rect", x: 0.85, y: 0, w: 0.03, h: SLIDE_H, color: "93C5FD" }],
  },
  {
    id: "cuadricula", name: "Cuadrícula",
    background: "F8FAFC", title: "0F172A", text: "334155", accent: "6366F1", font: "Calibri",
    decorations: [
      ...gridLines,
      { shape: "ellipse", x: 8.7, y: -0.6, w: 1.8, h: 1.8, color: "FDE68A" },
      { shape: "ellipse", x: -0.7, y: 4.4, w: 2, h: 2, color: "99F6E4" },
    ],
  },
  {
    id: "confeti", name: "Confeti",
    background: "FFFFFF", title: "0F172A", text: "334155", accent: "0EA5E9", font: "Calibri",
    decorations: [
      { shape: "ellipse", x: 0.3, y: 0.25, w: 0.35, h: 0.35, color: "A7F3D0" },
      { shape: "ellipse", x: 1.1, y: 0.15, w: 0.2, h: 0.2, color: "FBCFE8" },
      { shape: "rect", x: 8.9, y: 0.3, w: 0.3, h: 0.3, color: "FDE68A" },
      { shape: "ellipse", x: 9.4, y: 1.1, w: 0.25, h: 0.25, color: "BAE6FD" },
      { shape: "ellipse", x: 0.2, y: 4.9, w: 0.45, h: 0.45, color: "C4B5FD" },
      { shape: "rect", x: 9.2, y: 4.9, w: 0.35, h: 0.35, color: "A7F3D0" },
      { shape: "ellipse", x: 8.4, y: 5.1, w: 0.2, h: 0.2, color: "FBCFE8" },
    ],
  },
  {
    id: "despertar", name: "Despertar y aprender",
    background: "FFFFFF", title: "0F172A", text: "334155", accent: "F59E0B", font: "Calibri",
    decorations: [{ shape: "rect", x: 0, y: 0, w: 0.25, h: SLIDE_H, color: "F59E0B" }],
    coverDecorations: [
      { shape: "ellipse", x: 6.6, y: 1.6, w: 4.2, h: 4.2, color: "FDE68A" },
      { shape: "ellipse", x: 7.6, y: 2.6, w: 2.2, h: 2.2, color: "F59E0B" },
    ],
  },
  {
    id: "organico", name: "Orgánico brillante",
    background: "DBEAFE", title: "0F172A", text: "1E293B", accent: "2563EB", font: "Calibri",
    decorations: [
      { shape: "ellipse", x: -1.2, y: -1.2, w: 3.4, h: 2.6, color: "FACC15" },
      { shape: "ellipse", x: 7.9, y: -1, w: 3.2, h: 2.4, color: "F472B6" },
      { shape: "ellipse", x: -1, y: 4.1, w: 3, h: 2.4, color: "2563EB" },
      { shape: "ellipse", x: 8, y: 4.3, w: 3, h: 2.2, color: "FACC15" },
      { shape: "rect", x: 0.7, y: 0.45, w: 8.6, h: 4.75, color: "FFFFFF" },
    ],
  },
  {
    id: "simple", name: "Simple",
    background: "EEF2FF", title: "0F172A", text: "334155", accent: "4F46E5", font: "Calibri",
    decorations: [{ shape: "rect", x: 0.35, y: 0.3, w: 9.3, h: 5.05, color: "FFFFFF" }],
  },
];

export function brandTheme(primaryHex: string): DeckTheme {
  return {
    id: "marca", name: "Marca de la academia",
    background: "FFFFFF", title: primaryHex, text: "1E293B", accent: primaryHex, font: "Calibri",
    decorations: [{ shape: "rect", x: 0, y: 0, w: SLIDE_W, h: 0.12, color: primaryHex }],
    coverBackground: "0F172A",
    coverTitle: "FFFFFF",
    coverDecorations: [{ shape: "rect", x: 0, y: 5.4, w: SLIDE_W, h: 0.225, color: primaryHex }],
  };
}

export function getPresetTheme(id: string, primaryHex: string): DeckTheme {
  if (id === "marca") return brandTheme(primaryHex);
  return PRESET_THEMES.find((t) => t.id === id) ?? brandTheme(primaryHex);
}

/**
 * Tema a partir de una imagen de fondo (modelo subido o de la web). El texto
 * va sobre un panel blanco semitransparente para que se lea sobre cualquier fondo.
 */
export function imageTheme(
  image: { data: Uint8Array; mime: "image/png" | "image/jpeg" },
  colors?: { title?: string; text?: string; accent?: string; font?: string }
): DeckTheme {
  const accent = colors?.accent ?? "2563EB";
  return {
    id: "personalizado", name: "Modelo personalizado",
    background: "FFFFFF",
    title: colors?.title ?? accent,
    text: colors?.text ?? "1E293B",
    accent,
    font: colors?.font ?? "Calibri",
    backgroundImage: image,
    decorations: [{ shape: "rect", x: 0.45, y: 0.35, w: 9.1, h: 4.95, color: "FFFFFF", transparency: 12 }],
    coverDecorations: [{ shape: "rect", x: 0.45, y: 1.45, w: 9.1, h: 2.7, color: "FFFFFF", transparency: 10 }],
  };
}

/** Tema a partir de los colores y la fuente de un .pptx sin imagen de fondo. */
export function paletteTheme(colors: { background?: string; title?: string; text?: string; accent?: string; font?: string }): DeckTheme {
  const accent = colors.accent ?? "2563EB";
  return {
    id: "personalizado", name: "Modelo personalizado",
    background: colors.background ?? "FFFFFF",
    title: colors.title ?? accent,
    text: colors.text ?? "1E293B",
    accent,
    font: colors.font ?? "Calibri",
    decorations: [{ shape: "rect", x: 0, y: 0, w: SLIDE_W, h: 0.12, color: accent }],
  };
}

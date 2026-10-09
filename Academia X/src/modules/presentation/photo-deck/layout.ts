import type { ScriptSlide } from "./script";

/**
 * Medidas y cálculos del diseño "foto + texto", compartidos por el PowerPoint
 * (render.ts) y la vista previa del navegador: así lo que el profesor revisa es
 * lo que descarga. Unidades en pulgadas (diapositiva 16:9 de 13,333 × 7,5).
 */

export const SLIDE_W = 13.333;
export const SLIDE_H = 7.5;
export const PHOTO_X = 7.95;
export const TEXT_X = 0.6;
export const TEXT_W = PHOTO_X - TEXT_X - 0.45;
export const FONT = "Segoe UI";
export const INK = "1F2937";
export const MUTED = "6B7280";

// ─── Color ───────────────────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  const v = m ? m[1] : "2563EB";
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}
const toHex = (c: number[]) => c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t);
function luminance([r, g, b]: number[]) {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export interface DeckColors {
  /** Resaltado de palabras clave (legible sobre blanco) */
  accent: string;
  /** Títulos: casi azul marino con un toque del color de la academia */
  title: string;
  /** Relleno suave cuando aún no hay foto */
  tint: string;
}

/** Colores de la presentación a partir del color principal de la academia (hex sin #). */
export function deckPalette(primary: string): DeckColors {
  let accent: number[] = rgb(primary);
  // Sobre fondo blanco el resaltado necesita contraste (≥ 3:1)
  while (luminance(accent) > 0.32) accent = mix(accent, [0, 0, 0], 0.12);
  const title = mix(accent, [15, 27, 45], 0.8);
  const tint = mix(rgb(primary), [255, 255, 255], 0.85);
  return { accent: toHex(accent), title: toHex(title), tint: toHex(tint) };
}

// ─── Texto ───────────────────────────────────────────────────────────────────

/** "Hola **mundo**" → [{ text: "Hola ", hl: false }, { text: "mundo", hl: true }] */
export function splitHighlights(text: string): Array<{ text: string; hl: boolean }> {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p) => (p.startsWith("**") && p.endsWith("**") ? { text: p.slice(2, -2), hl: true } : { text: p, hl: false }));
}

/** Mayor tamaño de letra (pt) con el que el texto cabe en la caja (estimación por caracteres). */
export function fitFont(paragraphs: string[], boxW: number, boxH: number, sizes: number[]): number {
  for (const size of sizes) {
    const charsPerLine = (boxW * 72) / (size * 0.48);
    const lines = paragraphs.reduce((acc, p) => acc + Math.max(1, Math.ceil(p.replace(/\*\*/g, "").length / charsPerLine)), 0);
    const height = (lines * size * 1.22 + paragraphs.length * size * 0.45) / 72;
    if (height <= boxH) return size;
  }
  return sizes[sizes.length - 1];
}

/** Tamaño (pt) y alto (in) del título: el mayor tamaño con el que cabe en dos líneas. */
export function titleLayout(t: string): { size: number; h: number } {
  for (const size of [34, 31, 28, 25, 22]) {
    const lines = Math.ceil(t.length / ((TEXT_W * 72) / (size * 0.52)));
    if (lines <= 2) return { size, h: (lines * size * 1.18) / 72 + 0.08 };
  }
  return { size: 22, h: (3 * 22 * 1.18) / 72 + 0.08 };
}

/** Todo lo que necesita una diapositiva de contenido para dibujarse. */
export function contentLayout(s: ScriptSlide) {
  const title = titleLayout(s.title);
  const bodyY = 0.5 + title.h + 0.3;
  const bodyH = SLIDE_H - bodyY - 0.6;
  const paragraphs = s.text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const isReading = s.type === "reading";
  const numbered = isReading || s.type === "exercise" || s.type === "objectives";
  const listHeading = isReading && s.items.length ? "Comprensión de lectura" : "";
  const sizes = isReading ? [20, 19, 18, 17, 16, 15, 14, 13, 12, 11] : [24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12];
  const size = fitFont([...paragraphs, ...(listHeading ? [listHeading] : []), ...s.items], TEXT_W, bodyH, sizes);
  return { titleSize: title.size, titleH: title.h, bodyY, bodyH, paragraphs, numbered, listHeading, size };
}

/** Tamaño del título de la portada (pt). */
export const coverTitleSize = (t: string) => (t.length > 50 ? 38 : 46);

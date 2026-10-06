import { averageCharWidth } from "../design/fonts";

/**
 * Motor de ajuste de texto. Estima cuántas líneas ocupa un texto en una caja
 * (ancho, fuente, tamaño, interlineado, negrita) y busca el mayor tamaño que
 * cabe sin bajar del mínimo legible. Si no cabe ni con el mínimo, lo indica
 * (`fits: false`) para que el motor resuma, divida o cambie de layout en vez
 * de dejar texto diminuto o cortado.
 */

/** Margen interior de los cuadros de texto (pt), igual que el que usa el renderizador */
export const TEXT_INSET_PT = 5;

export interface FitOptions {
  font: string;
  max: number;
  min: number;
  bold?: boolean;
  lineSpacing?: number;
  bullets?: boolean;
}

export interface FitResult {
  fontSize: number;
  lines: number;
  fits: boolean;
  heightIn: number;
}

/** Líneas que ocupa `text` con ajuste por palabras en un ancho dado (pulgadas). */
export function estimateLines(text: string, widthIn: number, fontSize: number, font: string, bold = false, bullets = false): number {
  const usable = Math.max(0.2, widthIn - (TEXT_INSET_PT * 2) / 72 - (bullets ? 0.3 : 0));
  const charW = (averageCharWidth(font) * (bold ? 1.07 : 1) * fontSize) / 72;
  const perLine = Math.max(1, Math.floor(usable / charW));
  let lines = 0;
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines += 1;
      continue;
    }
    let current = 0;
    let count = 1;
    for (const w of words) {
      // Emojis y CJK ocupan ~2 caracteres
      const len = [...w].reduce((a, ch) => a + (/\p{Extended_Pictographic}|[　-鿿]/u.test(ch) ? 2 : 1), 0);
      if (len > perLine) {
        // Palabra más larga que la línea: se parte
        count += Math.ceil((current + len) / perLine) - 1;
        current = (current + len) % perLine;
        continue;
      }
      if (current === 0) current = len;
      else if (current + 1 + len <= perLine) current += 1 + len;
      else {
        count++;
        current = len;
      }
    }
    lines += count;
  }
  return lines;
}

export function estimateTextHeight(text: string, widthIn: number, fontSize: number, font: string, opts: { bold?: boolean; lineSpacing?: number; bullets?: boolean } = {}): number {
  const lines = estimateLines(text, widthIn, fontSize, font, opts.bold, opts.bullets);
  const paragraphs = text.split(/\n/).length;
  const lineH = (fontSize * (opts.lineSpacing ?? 1.15) * 1.2) / 72;
  // Espacio entre párrafos de viñetas
  const extra = opts.bullets ? ((paragraphs - 1) * fontSize * 0.35) / 72 : 0;
  return lines * lineH + extra + (TEXT_INSET_PT * 2) / 72;
}

export function fitText(text: string, widthIn: number, heightIn: number, opts: FitOptions): FitResult {
  const step = 1;
  for (let size = opts.max; size >= opts.min; size -= step) {
    const h = estimateTextHeight(text, widthIn, size, opts.font, opts);
    if (h <= heightIn) return { fontSize: size, lines: estimateLines(text, widthIn, size, opts.font, opts.bold, opts.bullets), fits: true, heightIn: h };
  }
  const h = estimateTextHeight(text, widthIn, opts.min, opts.font, opts);
  return { fontSize: opts.min, lines: estimateLines(text, widthIn, opts.min, opts.font, opts.bold, opts.bullets), fits: false, heightIn: h };
}

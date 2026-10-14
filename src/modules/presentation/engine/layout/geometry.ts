import type { NormBox, ResolvedDesignSystem } from "../types";

/**
 * Geometría normalizada (0-1). Los layouts trabajan siempre en esta escala y
 * el renderizador convierte a pulgadas al final: nada de constantes mágicas
 * en pulgadas repartidas por el código.
 */

/** Márgenes seguros: el contenido no puede acercarse más al borde. La decoración sí. */
export const SAFE = { x: 0.05, y: 0.06 };
export const CONTENT = { x: SAFE.x, y: SAFE.y, w: 1 - SAFE.x * 2, h: 1 - SAFE.y * 2 };
/** Zona del título y zona de contenido debajo */
export const TITLE_ZONE: NormBox = { x: SAFE.x, y: SAFE.y, w: 1 - SAFE.x * 2, h: 0.14 };
export const BODY_ZONE: NormBox = { x: SAFE.x, y: SAFE.y + 0.18, w: 1 - SAFE.x * 2, h: 1 - SAFE.y * 2 - 0.18 };

export const toSlideX = (d: ResolvedDesignSystem, x: number) => x * d.slide.widthIn;
export const toSlideY = (d: ResolvedDesignSystem, y: number) => y * d.slide.heightIn;
export const toSlideWidth = (d: ResolvedDesignSystem, w: number) => w * d.slide.widthIn;
export const toSlideHeight = (d: ResolvedDesignSystem, h: number) => h * d.slide.heightIn;

export function box(x: number, y: number, w: number, h: number): NormBox {
  return { x, y, w, h };
}

export function inset(b: NormBox, dx: number, dy = dx): NormBox {
  return { x: b.x + dx, y: b.y + dy, w: Math.max(0, b.w - dx * 2), h: Math.max(0, b.h - dy * 2) };
}

/** Divide una caja en `n` columnas iguales con separación `gap`. */
export function columns(b: NormBox, n: number, gap: number): NormBox[] {
  const w = (b.w - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x: b.x + i * (w + gap), y: b.y, w, h: b.h }));
}

/** Divide una caja en `n` filas iguales. */
export function rows(b: NormBox, n: number, gap: number): NormBox[] {
  const h = (b.h - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x: b.x, y: b.y + i * (h + gap), w: b.w, h }));
}

/** Rejilla de `count` celdas en `cols` columnas, centrando la última fila incompleta. */
export function grid(b: NormBox, count: number, cols: number, gapX: number, gapY: number): NormBox[] {
  const rowsN = Math.ceil(count / cols);
  const cellW = (b.w - gapX * (cols - 1)) / cols;
  const cellH = (b.h - gapY * (rowsN - 1)) / rowsN;
  const out: NormBox[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const inRow = r === rowsN - 1 ? count - r * cols : cols;
    const offset = ((cols - inRow) * (cellW + gapX)) / 2;
    const c = i % cols;
    out.push({ x: b.x + offset + c * (cellW + gapX), y: b.y + r * (cellH + gapY), w: cellW, h: cellH });
  }
  return out;
}

export function split(b: NormBox, ratio: number, gap: number, direction: "h" | "v" = "h"): [NormBox, NormBox] {
  if (direction === "h") {
    const w1 = (b.w - gap) * ratio;
    return [{ ...b, w: w1 }, { x: b.x + w1 + gap, y: b.y, w: b.w - w1 - gap, h: b.h }];
  }
  const h1 = (b.h - gap) * ratio;
  return [{ ...b, h: h1 }, { x: b.x, y: b.y + h1 + gap, w: b.w, h: b.h - h1 - gap }];
}

export function rectIntersects(a: NormBox, b: NormBox, tolerance = 0.002): boolean {
  return a.x + a.w - tolerance > b.x && b.x + b.w - tolerance > a.x && a.y + a.h - tolerance > b.y && b.y + b.h - tolerance > a.y;
}

export function intersectionArea(a: NormBox, b: NormBox): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function contains(outer: NormBox, inner: NormBox, tolerance = 0.002): boolean {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance && inner.x + inner.w <= outer.x + outer.w + tolerance && inner.y + inner.h <= outer.y + outer.h + tolerance;
}

export function insideSlide(b: NormBox, tolerance = 0.001): boolean {
  return b.x >= -tolerance && b.y >= -tolerance && b.x + b.w <= 1 + tolerance && b.y + b.h <= 1 + tolerance;
}

export function insideSafeArea(b: NormBox, tolerance = 0.005): boolean {
  return b.x >= SAFE.x - tolerance && b.y >= SAFE.y - tolerance && b.x + b.w <= 1 - SAFE.x + tolerance && b.y + b.h <= 1 - SAFE.y + tolerance;
}

/** Caja de una imagen ajustada dentro de `area` sin deformarla (contain), centrada. */
export function fitImageContain(area: NormBox, imgW: number, imgH: number, d: ResolvedDesignSystem): NormBox {
  const areaRatio = (area.w * d.slide.widthIn) / (area.h * d.slide.heightIn);
  const imgRatio = imgW / imgH;
  if (imgRatio > areaRatio) {
    const h = (area.w * d.slide.widthIn) / imgRatio / d.slide.heightIn;
    return { x: area.x, y: area.y + (area.h - h) / 2, w: area.w, h };
  }
  const w = (area.h * d.slide.heightIn * imgRatio) / d.slide.widthIn;
  return { x: area.x + (area.w - w) / 2, y: area.y, w, h: area.h };
}

/**
 * Recorte (fracciones 0-1 por lado) para que la imagen LLENE `area` sin
 * deformarse (cover). El renderizador lo traduce a srcRect de PowerPoint.
 */
export function fitImageCover(area: NormBox, imgW: number, imgH: number, d: ResolvedDesignSystem): { l: number; r: number; t: number; b: number } {
  const areaRatio = (area.w * d.slide.widthIn) / (area.h * d.slide.heightIn);
  const imgRatio = imgW / imgH;
  if (imgRatio > areaRatio) {
    const side = (1 - areaRatio / imgRatio) / 2;
    return { l: side, r: side, t: 0, b: 0 };
  }
  const side = (1 - imgRatio / areaRatio) / 2;
  // Recorte vertical sesgado hacia arriba: en fotos e ilustraciones lo importante suele estar arriba
  return { l: 0, r: 0, t: side * 0.6, b: side * 1.4 };
}

/** Utilidades de color (hex sin "#", mayúsculas). Contraste según WCAG 2.1. */

export function cleanHex(value: string | undefined | null, fallback = "000000"): string {
  const v = (value ?? "").replace("#", "").trim();
  if (/^[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^[0-9a-f]{3}$/i.test(v)) return v.split("").map((c) => c + c).join("").toUpperCase();
  return fallback;
}

function channels(hex: string): [number, number, number] {
  const h = cleanHex(hex);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG (1-21). ≥4.5 texto normal, ≥3 texto grande. */
export function getContrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Color resultante de poner `fg` con transparencia (0-100) sobre `bg`. */
export function blend(fg: string, bg: string, transparency: number): string {
  return mix(fg, bg, Math.max(0, Math.min(100, transparency)) / 100);
}

export function isDark(hex: string): boolean {
  return relativeLuminance(hex) < 0.22;
}

export function saturation(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const l = (max + min) / 2;
  return l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/**
 * Elige el primer color de `candidates` legible sobre `bg`; si ninguno llega,
 * oscurece/aclara el mejor hasta alcanzar el contraste mínimo.
 */
export function readableOn(bg: string, candidates: string[], min = 4.5): string {
  for (const c of candidates) if (c && getContrastRatio(c, bg) >= min) return cleanHex(c);
  // Ningún candidato llega: se acerca el primero al extremo (blanco o negro) que más contrasta
  const base = cleanHex(candidates.find(Boolean), "1E293B");
  const target = getContrastRatio("FFFFFF", bg) >= getContrastRatio("000000", bg) ? "FFFFFF" : "000000";
  for (let i = 1; i <= 10; i++) {
    const c = mix(base, target, i / 10);
    if (getContrastRatio(c, bg) >= min) return c;
  }
  return target;
}

/** Versión suave (para fondos de tarjeta) de un color fuerte. */
export function soft(hex: string, amount = 0.85): string {
  return mix(hex, "FFFFFF", amount);
}

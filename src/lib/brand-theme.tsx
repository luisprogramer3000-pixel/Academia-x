import type { CSSProperties, ReactNode } from "react";

/**
 * Tema de marca de la academia a partir de su color de fondo (secondaryColor).
 *
 * Las páginas públicas, el campus y el visor usan clases fijas de Tailwind
 * (bg-slate-950, border-slate-800, text-slate-300...). Dentro de <BrandScope>
 * esas clases se remapean a variables CSS (ver globals.css), así que un solo
 * color recolorea fondo, tarjetas y bordes. Si el color es claro, el texto
 * pasa a oscuro para mantener el contraste.
 */

/** Color de fondo con el que nace cada academia (gris claro); el dueño lo cambia en Branding. */
export const DEFAULT_BRAND_BACKGROUND = "#F1F5F9";
const DEFAULT_BG = DEFAULT_BRAND_BACKGROUND;

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: number[], b: number[], t: number) => toHex(a.map((v, i) => v + (b[i] - v) * t));

function luminance([r, g, b]: number[]) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export type BrandTone = "light" | "dark";

export function brandTheme(color?: string | null): { tone: BrandTone; style: CSSProperties } {
  const rgb = parseHex(color || "") ?? parseHex(DEFAULT_BG)!;
  const white = [255, 255, 255];
  const black = [0, 0, 0];
  const tone: BrandTone = luminance(rgb) > 0.45 ? "light" : "dark";

  const vars =
    tone === "dark"
      ? {
          "--brand-bg": toHex(rgb),
          "--brand-surface": mix(rgb, white, 0.05),
          "--brand-surface-2": mix(rgb, white, 0.11),
          "--brand-border": mix(rgb, white, 0.15),
          "--brand-text": "#f8fafc",
          "--brand-muted": "#cbd5e1",
          "--brand-subtle": "#94a3b8",
        }
      : {
          "--brand-bg": toHex(rgb),
          "--brand-surface": mix(rgb, white, 0.6),
          "--brand-surface-2": mix(rgb, black, 0.06),
          "--brand-border": mix(rgb, black, 0.13),
          "--brand-text": "#0f172a",
          "--brand-muted": "#334155",
          "--brand-subtle": "#64748b",
        };

  return { tone, style: vars as CSSProperties };
}

export function BrandScope({
  color,
  className = "",
  children,
}: {
  color?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const { tone, style } = brandTheme(color);
  return (
    <div className={`brand-scope ${className}`} data-tone={tone} style={style}>
      {children}
    </div>
  );
}

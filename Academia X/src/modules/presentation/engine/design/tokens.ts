import type { DecoShape, DesignMode, EducationTone, ResolvedDesignSystem, ResolvedImage } from "../types";
import { SLIDE_H, SLIDE_W, type DeckTheme } from "../../presentation.themes";
import { cleanHex, getContrastRatio, mix, readableOn, relativeLuminance, saturation, soft } from "./color";
import { EMOJI_FONT, mapFont } from "./fonts";

/**
 * Tokens de diseño comunes. Todos los diseños (básicos, inteligente o
 * inspirados en un modelo) terminan en un ResolvedDesignSystem con la misma
 * forma: los layouts nunca leen estilos sueltos.
 */

export const WIDE = { widthIn: 13.333, heightIn: 7.5 };
export const STANDARD = { widthIn: 10, heightIn: 7.5 };

/** Tamaños de letra por tono (pt, para una diapositiva de 13.33 in). */
export function sizesFor(tone: EducationTone): ResolvedDesignSystem["sizes"] {
  if (tone === "kids") return { hero: 54, title: 40, subtitle: 28, body: 24, small: 16 };
  if (tone === "corporate" || tone === "professional" || tone === "academic") return { hero: 46, title: 34, subtitle: 24, body: 20, small: 14 };
  return { hero: 50, title: 36, subtitle: 26, body: 22, small: 15 };
}

export const SPACING = { xs: 0.008, sm: 0.016, md: 0.028, lg: 0.045, xl: 0.07 };

/** Colores de apoyo con buen contraste con texto blanco, de tonos bien distintos. */
const COMPANIONS = ["0D9488", "D97706", "DB2777", "0284C7", "7C3AED", "16A34A"];

export function hue(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(cleanHex(hex).slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const hueDistance = (a: string, b: string) => {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
};

/** Acento complementario vivo para un color principal. */
export function companionAccent(primary: string): string {
  return COMPANIONS.slice().sort((a, b) => hueDistance(b, primary) - hueDistance(a, primary))[0];
}

/**
 * Tonos de tarjeta: primero los colores del diseño; después colores de apoyo
 * solo si su tono se distingue (>35°) de los ya elegidos. Sin marrones apagados.
 */
export function buildTones(primary: string, secondary: string, accent: string, background?: string): Array<{ soft: string; strong: string }> {
  const picked: string[] = [];
  for (const c of [primary, accent, secondary, ...COMPANIONS].map((x) => cleanHex(x))) {
    if (saturation(c) < 0.3 || relativeLuminance(c) < 0.03 || relativeLuminance(c) > 0.6) continue;
    // Una pieza del color del fondo "desaparece" (p. ej. una rama del mapa)
    if (background && (getContrastRatio(c, background) < 1.6 || hueDistance(c, background) < 20 && Math.abs(relativeLuminance(c) - relativeLuminance(background)) < 0.15)) continue;
    if (picked.every((p) => hueDistance(p, c) > 35)) picked.push(c);
    if (picked.length >= 5) break;
  }
  return picked.map((strong) => ({ strong, soft: soft(strong, 0.86) }));
}

/** Convierte las decoraciones del tema (pulgadas sobre 10 × 5.625) a coordenadas normalizadas. */
function normDecos(decos: DeckTheme["decorations"] | undefined): DecoShape[] {
  return (decos ?? []).map((d) => ({
    shape: d.shape === "ellipse" ? "ellipse" : "rect",
    box: { x: d.x / SLIDE_W, y: d.y / SLIDE_H, w: d.w / SLIDE_W, h: d.h / SLIDE_H },
    color: d.color,
    transparency: d.transparency,
  }));
}

export function designFromTheme(theme: DeckTheme, opts: { mode: DesignMode; tone: EducationTone; backgroundImage?: ResolvedImage }): ResolvedDesignSystem {
  const background = cleanHex(theme.background, "FFFFFF");
  const accent = cleanHex(theme.accent, "2563EB");
  const title = readableOn(background, [cleanHex(theme.title), cleanHex(theme.text)], 3);
  const text = readableOn(background, [cleanHex(theme.text, "1E293B")]);
  const hasImage = Boolean(theme.backgroundImage ?? opts.backgroundImage);
  const font = mapFont(theme.font);
  return {
    id: theme.id,
    name: theme.name,
    mode: opts.mode,
    slide: WIDE,
    colors: {
      background,
      surface: "FFFFFF",
      surfaceAlt: soft(accent, 0.9),
      primary: accent,
      secondary: cleanHex(theme.title, accent),
      accent: companionAccent(accent),
      text,
      mutedText: readableOn(background, [mix(text, background, 0.35)], 4.5),
      onPrimary: readableOn(accent, ["FFFFFF", "111827"]),
      title,
      tones: buildTones(accent, cleanHex(theme.title, accent), companionAccent(accent), background),
    },
    fonts: { heading: font, body: font, emoji: EMOJI_FONT },
    sizes: sizesFor(opts.tone),
    radius: { small: 0.08, medium: 0.14, large: 0.22 },
    spacing: SPACING,
    surfaceTransparency: hasImage ? 8 : 0,
    backgroundImage: opts.backgroundImage ?? (theme.backgroundImage ? imageFromTheme(theme.backgroundImage) : undefined),
    decorations: { content: normDecos(theme.decorations), cover: normDecos(theme.coverDecorations ?? theme.decorations) },
    coverBackground: theme.coverBackground,
    coverTitleColor: theme.coverTitle,
    coverImages: [],
    mascots: [],
    fidelity: 0,
    titleAlign: "left",
    visualStyle: theme.id,
    tone: opts.tone,
  };
}

function imageFromTheme(img: NonNullable<DeckTheme["backgroundImage"]>): ResolvedImage {
  // Dimensiones desconocidas: como fondo se estira a la diapositiva (siempre 16:9)
  return { data: img.data, mime: img.mime, width: 1920, height: 1080 };
}

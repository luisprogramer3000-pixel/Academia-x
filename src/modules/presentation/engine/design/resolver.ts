import JSZip from "jszip";
import type { DesignMode, EducationTone, PresentationDesignDNA, ResolvedDesignSystem, ResolvedImage } from "../types";
import { getPresetTheme, type DeckTheme } from "../../presentation.themes";
import { lessonImageFromBytes } from "../../presentation.images";
import { cleanHex, getContrastRatio, isDark, mix, readableOn, relativeLuminance, saturation, soft } from "./color";
import { EMOJI_FONT, mapFont } from "./fonts";
import { buildTones, designFromTheme, SPACING, sizesFor, STANDARD, WIDE } from "./tokens";

/**
 * DesignStyleResolver: combina el modo de diseño, el ADN del modelo (si lo
 * hay), la marca de la academia y el público para producir UN sistema de
 * diseño resuelto. Los layouts solo leen este objeto.
 */

export interface DesignInput {
  mode: DesignMode;
  tone: EducationTone;
  brandPrimary: string;
  /** Diseño básico elegido (o el que elija el modo inteligente) */
  theme?: DeckTheme;
  /** Modelo .pptx: bytes + ADN ya analizado */
  template?: { bytes: Uint8Array; dna: PresentationDesignDNA };
  subject?: string;
}

/** Diseño inteligente: el estilo básico que mejor encaja con el público. */
export function smartPreset(tone: EducationTone): string {
  switch (tone) {
    case "kids": return "confeti";
    case "teen": return "cuadricula";
    case "school": return "despertar";
    case "academic": return "simple";
    default: return "marca";
  }
}

export async function resolveDesignStyle(input: DesignInput): Promise<ResolvedDesignSystem> {
  if (input.template) return fromDna(input.template.bytes, input.template.dna, input.mode, input.tone);
  const theme = input.mode === "SMART_DESIGN" ? getPresetTheme(smartPreset(input.tone), cleanHex(input.brandPrimary, "2563EB")) : input.theme ?? getPresetTheme("marca", cleanHex(input.brandPrimary, "2563EB"));
  const design = designFromTheme(theme, { mode: input.mode, tone: input.tone });
  if (input.mode === "SMART_DESIGN") design.name = `Diseño inteligente · ${theme.name}`;
  return design;
}

const isFullSlide = (b: { x: number; y: number; w: number; h: number }) => Math.abs(b.x) < 0.01 && Math.abs(b.y) < 0.01 && Math.abs(b.w - 1) < 0.01 && Math.abs(b.h - 1) < 0.01;

async function loadImages(zip: JSZip, paths: string[]): Promise<Map<string, ResolvedImage>> {
  const out = new Map<string, ResolvedImage>();
  for (const p of [...new Set(paths)]) {
    const data = await zip.file(p)?.async("uint8array");
    const img = data ? lessonImageFromBytes(data) : null;
    if (img) out.set(p, img);
  }
  return out;
}

async function fromDna(bytes: Uint8Array, dna: PresentationDesignDNA, mode: DesignMode, lessonTone: EducationTone): Promise<ResolvedDesignSystem> {
  const zip = await JSZip.loadAsync(bytes);
  const adapt = mode === "ADAPT_TEMPLATE";
  const paths = [
    ...(dna.backgroundImage ? [dna.backgroundImage.path] : []),
    ...dna.mascots.map((m) => m.path),
    ...(adapt ? dna.cover?.images.map((i) => i.path) ?? [] : []),
  ];
  const images = await loadImages(zip, paths);

  const background = cleanHex(dna.backgroundColor ?? dna.palette.background[0], "FFFFFF");
  const hasBgImage = Boolean(dna.backgroundImage && images.has(dna.backgroundImage.path));
  // Sobre un fondo con imagen se asume que es claro u oscuro según su color base
  const titleCandidates = [...dna.palette.secondary, ...dna.palette.text, ...dna.palette.neutral];
  const title = readableOn(background, titleCandidates, 3);
  const text = readableOn(background, [...dna.palette.text, ...dna.palette.neutral, title]);
  const primary = cleanHex(
    dna.palette.primary.find((c) => getContrastRatio(c, background) >= 2) ?? dna.palette.primary[0] ?? (saturation(title) > 0.3 ? title : "2563EB")
  );
  const accent = cleanHex(dna.palette.accent.find((c) => c !== primary) ?? mix(primary, "F59E0B", 0.45));
  const secondary = cleanHex(dna.palette.secondary.find((c) => c !== primary) ?? title);
  // Tarjetas: color claro del modelo o blanco; con texto oscuro legible
  const surfaceBase = dna.shapes.cardFill && relativeLuminance(dna.shapes.cardFill) > 0.75 ? dna.shapes.cardFill : isDark(background) ? mix(background, "FFFFFF", 0.12) : "FFFFFF";
  const surface = cleanHex(surfaceBase);
  const tone = lessonTone === "school" && dna.educationTone !== "mixed" ? dna.educationTone : lessonTone;
  const size = dna.aspectRatio === "4:3" ? STANDARD : WIDE;
  const radiusScale = dna.shapes.borderRadiusStyle === "square" ? 0.3 : dna.shapes.borderRadiusStyle === "rounded" ? 1.3 : 1;

  return {
    id: `dna:${dna.id}`,
    name: dna.id,
    mode,
    slide: size,
    colors: {
      background,
      surface,
      surfaceAlt: soft(primary, 0.88),
      primary,
      secondary,
      accent,
      text: readableOn(surface, [text, "1E293B"]),
      mutedText: readableOn(surface, [mix(text, surface, 0.3)]),
      onPrimary: readableOn(primary, ["FFFFFF", "111827"]),
      title,
      tones: buildTones(primary, secondary, accent, background),
    },
    fonts: { heading: mapFont(dna.typography.headingFonts[0]), body: mapFont(dna.typography.bodyFonts[0] ?? dna.typography.headingFonts[0]), emoji: EMOJI_FONT },
    sizes: sizesFor(tone),
    radius: { small: 0.08 * radiusScale, medium: 0.14 * radiusScale, large: 0.22 * radiusScale },
    spacing: SPACING,
    surfaceTransparency: hasBgImage ? 6 : 0,
    backgroundImage: hasBgImage ? images.get(dna.backgroundImage!.path) : undefined,
    backgroundPlacement: hasBgImage && (dna.backgroundImage!.rotation || !isFullSlide(dna.backgroundImage!.box))
      ? { box: dna.backgroundImage!.box, rotation: dna.backgroundImage!.rotation ?? 0 }
      : undefined,
    decorations: { content: [], cover: [] },
    // Con fondo de imagen, la portada lo comparte (el color sólido de debajo no es la identidad)
    coverBackground: !hasBgImage && dna.cover?.backgroundColor ? cleanHex(dna.cover.backgroundColor) : undefined,
    coverImages: adapt ? (dna.cover?.images ?? []).filter((i) => images.has(i.path)).map((i) => ({ image: images.get(i.path)!, box: i.box })) : [],
    coverTitleBox: adapt ? dna.cover?.titleBox : undefined,
    mascots: dna.mascots.map((m) => images.get(m.path)).filter((m): m is ResolvedImage => Boolean(m)),
    fidelity: adapt ? 0.9 : 0.78,
    titleAlign: dna.composition.titleAlign,
    visualStyle: `${dna.imageStyle.type}/${dna.mood.join("-")}`,
    tone,
  };
}

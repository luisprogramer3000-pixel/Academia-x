import JSZip from "jszip";
import { createHash } from "crypto";
import type { DnaImageAsset, EducationTone, NormBox, PresentationDesignDNA } from "../types";
import { TemplateAnalysisError } from "../errors";
import { lessonImageFromBytes } from "../../presentation.images";
import { cleanHex, isDark, relativeLuminance, saturation } from "./color";
import { dominantColors } from "./png-colors";

function colorDistance(a: string, b: string): number {
  const ca = [0, 2, 4].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [0, 2, 4].map((i) => parseInt(b.slice(i, i + 2), 16));
  return Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]);
}

/**
 * DesignAnalyzer: lee un .pptx (ZIP + XML) UNA vez y extrae su "ADN de
 * diseño": proporciones, paleta, tipografías, composición, fondo base,
 * personajes/ilustraciones recurrentes, adornos y la composición de la
 * portada. El resultado se cachea por hash del archivo (dna-cache.ts).
 */

export const ANALYZER_VERSION = 5;
const EMU_PER_IN = 914400;

interface RawPicture {
  path: string;
  box: NormBox;
  area: number;
  cropped: boolean;
  rotation: number;
}

/** Colores del tema por defecto de Office: Canva los deja en el tema, pero no son la paleta del diseño. */
const OFFICE_DEFAULTS = new Set([
  "4F81BD", "C0504D", "9BBB59", "8064A2", "4BACC6", "F79646", "1F497D", "EEECE1",
  "4472C4", "ED7D31", "A5A5A5", "FFC000", "5B9BD5", "70AD47", "44546A", "E7E6E6", "0563C1", "954F72",
]);

interface RawText {
  text: string;
  size: number;
  font?: string;
  color?: string;
  bold: boolean;
  box: NormBox;
}

interface RawSlide {
  pictures: RawPicture[];
  texts: RawText[];
  fills: string[];
  roundRects: number;
  rects: number;
  bgColor?: string;
  bgImage?: string;
}

interface Xfrm {
  offX: number;
  offY: number;
  sx: number;
  sy: number;
  chOffX: number;
  chOffY: number;
}

const IDENTITY: Xfrm = { offX: 0, offY: 0, sx: 1, sy: 1, chOffX: 0, chOffY: 0 };

/** Aplica la pila de transformaciones de grupo a una coordenada hija. */
function toSlide(stack: Xfrm[], x: number, y: number, w: number, h: number) {
  let r = { x, y, w, h };
  for (let i = stack.length - 1; i >= 0; i--) {
    const t = stack[i];
    r = { x: t.offX + (r.x - t.chOffX) * t.sx, y: t.offY + (r.y - t.chOffY) * t.sy, w: r.w * t.sx, h: r.h * t.sy };
  }
  return r;
}

function relTarget(rels: string, rid: string): string | undefined {
  const t = rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
  return t ? `ppt/${t.replace(/^(\.\.\/)+/, "").replace(/^\/?ppt\//, "")}` : undefined;
}

function parseSlide(xml: string, rels: string, slideW: number, slideH: number): RawSlide {
  const slide: RawSlide = { pictures: [], texts: [], fills: [], roundRects: 0, rects: 0 };
  const bg = xml.match(/<p:bg>([\s\S]*?)<\/p:bg>/)?.[1];
  if (bg) {
    slide.bgColor = bg.match(/srgbClr val="([0-9A-Fa-f]{6})"/)?.[1]?.toUpperCase();
    const rid = bg.match(/r:embed="([^"]+)"/)?.[1];
    if (rid) slide.bgImage = relTarget(rels, rid);
  }

  const stack: Xfrm[] = [];
  const token = /<p:grpSp>|<\/p:grpSp>|<p:(pic|sp)\b[^>]*>[\s\S]*?<\/p:\1>/g;
  for (const m of xml.matchAll(token)) {
    const tag = m[0];
    if (tag === "<p:grpSp>") {
      const rest = xml.slice(m.index! + tag.length, m.index! + tag.length + 1500);
      const x = rest.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\/>\s*<a:chOff x="(-?\d+)" y="(-?\d+)"\/>\s*<a:chExt cx="(\d+)" cy="(\d+)"\/>/);
      stack.push(x
        ? { offX: +x[1], offY: +x[2], sx: +x[7] ? +x[3] / +x[7] : 1, sy: +x[8] ? +x[4] / +x[8] : 1, chOffX: +x[5], chOffY: +x[6] }
        : IDENTITY);
      continue;
    }
    if (tag === "</p:grpSp>") {
      stack.pop();
      continue;
    }
    const off = tag.match(/<a:off x="(-?\d+)" y="(-?\d+)"/);
    const ext = tag.match(/<a:ext cx="(\d+)" cy="(\d+)"/);
    if (!off || !ext) continue;
    const r = toSlide(stack, +off[1], +off[2], +ext[1], +ext[2]);
    const box: NormBox = { x: r.x / slideW, y: r.y / slideH, w: r.w / slideW, h: r.h / slideH };
    const rid = tag.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1];
    const text = [...tag.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((t) => t[1]).join(" ").replace(/\s+/g, " ").trim();
    if (rid && !text) {
      const path = relTarget(rels, rid);
      if (path && /\.(png|jpe?g)$/i.test(path)) {
        const rot = Number(tag.match(/<a:xfrm\b[^>]*\brot="(-?\d+)"/)?.[1] ?? 0) / 60000;
        const quarter = Math.abs(Math.round(rot / 90)) % 2 === 1;
        // Con giro de 90°, el área visible es la de la caja girada
        const visible = quarter ? { w: (box.h * slideH) / slideW, h: (box.w * slideW) / slideH } : box;
        slide.pictures.push({ path, box, area: Math.max(0, Math.min(1, visible.w) * Math.min(1, visible.h)), cropped: /<a:srcRect\b[^>]*[ltrb]="[1-9]/.test(tag), rotation: rot });
      }
      continue;
    }
    const geom = tag.match(/<a:prstGeom prst="(\w+)"/)?.[1];
    if (geom === "roundRect") slide.roundRects++;
    else if (geom === "rect" && !text) slide.rects++;
    const spFill = tag.match(/<p:spPr>[\s\S]*?<a:solidFill>\s*<a:srgbClr val="([0-9A-Fa-f]{6})"/)?.[1];
    if (spFill) slide.fills.push(spFill.toUpperCase());
    if (text) {
      const sizes = [...tag.matchAll(/ sz="(\d+)"/g)].map((s) => +s[1] / 100);
      const runColor = tag.match(/<a:rPr[^>]*>[\s\S]*?<a:srgbClr val="([0-9A-Fa-f]{6})"/)?.[1];
      slide.texts.push({
        text,
        size: sizes.length ? Math.max(...sizes) : 18,
        font: tag.match(/<a:latin typeface="([^"]+)"/)?.[1],
        color: runColor?.toUpperCase(),
        bold: / b="1"/.test(tag),
        box,
      });
    }
  }
  return slide;
}

function tally<T>(values: T[]): Array<[T, number]> {
  const map = new Map<T, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function mime(path: string): "image/png" | "image/jpeg" {
  return /\.png$/i.test(path) ? "image/png" : "image/jpeg";
}

export function hashBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function analyzeDesign(bytes: Uint8Array, id: string): Promise<PresentationDesignDNA> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (cause) {
    throw new TemplateAnalysisError("No se pudo leer la presentación.", { cause });
  }
  const pres = await zip.file("ppt/presentation.xml")?.async("string");
  const presRels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  if (!pres || !presRels) throw new TemplateAnalysisError("El archivo no es una presentación de PowerPoint.");

  const sz = pres.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
  const slideW = sz ? +sz[1] : 12192000;
  const slideH = sz ? +sz[2] : 6858000;
  const ratio = slideW / slideH;
  const aspectRatio = Math.abs(ratio - 16 / 9) < 0.05 ? "16:9" : Math.abs(ratio - 4 / 3) < 0.05 ? "4:3" : "custom";

  const order = [...pres.matchAll(/<p:sldId [^>]*r:id="([^"]+)"/g)].map((m) => m[1]);
  const slides: RawSlide[] = [];
  for (const rid of order.slice(0, 40)) {
    const path = relTarget(presRels, rid);
    if (!path) continue;
    const xml = await zip.file(path)?.async("string");
    if (!xml) continue;
    const rels = (await zip.file(path.replace("slides/", "slides/_rels/") + ".rels")?.async("string")) ?? "";
    slides.push(parseSlide(xml, rels, slideW, slideH));
  }
  if (!slides.length) throw new TemplateAnalysisError("La presentación no tiene diapositivas.");

  // Recurrencia de cada imagen (en cuántas diapositivas aparece)
  const recurrence = new Map<string, number>();
  for (const s of slides) for (const p of new Set(s.pictures.map((x) => x.path))) recurrence.set(p, (recurrence.get(p) ?? 0) + 1);

  const dims = new Map<string, { width: number; height: number } | null>();
  const dimsOf = async (path: string) => {
    if (!dims.has(path)) {
      const data = await zip.file(path)?.async("uint8array");
      const img = data ? lessonImageFromBytes(data) : null;
      dims.set(path, img ? { width: img.width, height: img.height } : null);
    }
    return dims.get(path) ?? null;
  };
  const asset = async (p: RawPicture): Promise<DnaImageAsset | null> => {
    const d = await dimsOf(p.path);
    return d ? { path: p.path, mime: mime(p.path), width: d.width, height: d.height, box: p.box, recurrence: recurrence.get(p.path) ?? 1, rotation: p.rotation || undefined } : null;
  };

  // Fondo base: imagen a pantalla completa que más se repite (o el fondo de diapositiva)
  const allPictures = slides.flatMap((s) => s.pictures);
  const fullBleed = allPictures.filter((p) => p.area >= 0.8);
  const bgCandidate = tally(fullBleed.map((p) => p.path))[0]?.[0] ?? tally(slides.map((s) => s.bgImage).filter((x): x is string => Boolean(x)))[0]?.[0];
  let backgroundImage: DnaImageAsset | undefined;
  if (bgCandidate) {
    const pic = fullBleed.find((p) => p.path === bgCandidate) ?? { path: bgCandidate, box: { x: 0, y: 0, w: 1, h: 1 }, area: 1, cropped: false, rotation: 0 };
    const d = await dimsOf(bgCandidate);
    if (d) backgroundImage = { path: bgCandidate, mime: mime(bgCandidate), width: d.width, height: d.height, box: pic.box, rotation: pic.rotation || undefined, recurrence: recurrence.get(bgCandidate) ?? slides.filter((s) => s.bgImage === bgCandidate).length };
  }
  const isBackground = (p: RawPicture) => p.area >= 0.8 || p.path === bgCandidate;

  // Personajes / ilustraciones de marca: PNG medianos que se repiten (o que están en la portada)
  const mascotCandidates = allPictures.filter((p) => !isBackground(p) && /\.png$/i.test(p.path) && p.area >= 0.03 && p.area <= 0.35 && !p.cropped);
  const mascotPaths = tally(mascotCandidates.map((p) => p.path))
    .filter(([path, n]) => n >= 2 || (recurrence.get(path) ?? 0) >= 2 || slides[0].pictures.some((p) => p.path === path && p.area >= 0.06))
    .map(([path]) => path);
  const mascots: DnaImageAsset[] = [];
  for (const path of mascotPaths.slice(0, 6)) {
    const a = await asset(mascotCandidates.find((p) => p.path === path)!);
    // Muy apaisadas (bandas, títulos dibujados) o de baja resolución: no sirven como personaje
    if (!a || a.height / a.width < 0.6 || Math.max(a.width, a.height) < 300) continue;
    const data = await zip.file(path)?.async("uint8array");
    const colorful = data ? dominantColors(data).reduce((s, c) => s + c.weight, 0) > 0.08 : false;
    if (colorful) mascots.push(a);
    if (mascots.length >= 3) break;
  }

  const ornamentPaths = tally(allPictures.filter((p) => !isBackground(p) && /\.png$/i.test(p.path) && p.area > 0.002 && p.area < 0.03).map((p) => p.path))
    .filter(([, n]) => n >= 2)
    .map(([path]) => path);
  const ornaments: DnaImageAsset[] = [];
  for (const path of ornamentPaths.slice(0, 4)) {
    const a = await asset(allPictures.find((p) => p.path === path)!);
    if (a) ornaments.push(a);
  }

  // Tipografía: el texto más grande de cada diapositiva es su título
  const texts = slides.flatMap((s) => s.texts);
  const titles = slides.map((s) => [...s.texts].sort((a, b) => b.size - a.size)[0]).filter((t): t is RawText => Boolean(t));
  const scale = 13.333 / (slideW / EMU_PER_IN);
  const titleSet = new Set(titles);
  const bodies = texts.filter((t) => !titleSet.has(t));
  const headingFonts = tally(titles.map((t) => t.font).filter((f): f is string => Boolean(f))).map(([f]) => f);
  const bodyFonts = tally(bodies.map((t) => t.font).filter((f): f is string => Boolean(f))).map(([f]) => f);

  const titleAligns = titles.map((t) => (Math.abs(t.box.x + t.box.w / 2 - 0.5) < 0.08 && t.box.w > 0.45 ? "center" : "left"));
  const titleAlign = tally(titleAligns)[0]?.[0] === "center" ? "center" : "left";
  const titlePosition = tally(titles.map((t) => (t.box.y < 0.25 ? "top" : "middle")))[0]?.[0] === "middle" ? "middle" : "top";

  // Paleta
  const bgColors = tally(slides.map((s) => s.bgColor).filter((c): c is string => Boolean(c))).map(([c]) => c);
  const textColors = tally(bodies.map((t) => t.color).filter((c): c is string => Boolean(c))).map(([c]) => c);
  const titleColors = tally(titles.map((t) => t.color).filter((c): c is string => Boolean(c))).map(([c]) => c);
  const fills = tally(slides.flatMap((s) => s.fills)).map(([c]) => c);
  const accents = [...fills, ...titleColors, ...textColors].filter((c) => !OFFICE_DEFAULTS.has(c) && saturation(c) > 0.3 && relativeLuminance(c) > 0.04 && relativeLuminance(c) < 0.75);
  const themeXml = (await zip.file("ppt/theme/theme1.xml")?.async("string")) ?? "";
  const themeAccents = [...themeXml.matchAll(/<a:accent\d>[\s\S]*?val="([0-9A-Fa-f]{6})"/g)].map((m) => m[1].toUpperCase()).filter((c) => !OFFICE_DEFAULTS.has(c));
  // Colores reales de las ilustraciones (personajes, adornos, portada), ponderados por superficie
  const weights = new Map<string, number>();
  const sampled = new Set<string>();
  for (const p of allPictures.filter((x) => !isBackground(x) && /\.png$/i.test(x.path)).sort((a, b) => b.area - a.area).slice(0, 12)) {
    if (sampled.has(p.path)) continue;
    sampled.add(p.path);
    const data = await zip.file(p.path)?.async("uint8array");
    if (!data || data.length > 8_000_000) continue;
    for (const { color, weight } of dominantColors(data)) {
      const key = [...weights.keys()].find((k) => colorDistance(k, color) < 60) ?? color;
      weights.set(key, (weights.get(key) ?? 0) + weight * p.area * (recurrence.get(p.path) ?? 1));
    }
  }
  const imageColors = [...weights.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).filter((c) => relativeLuminance(c) < 0.8);

  // Composición
  const textArea = texts.reduce((a, t) => a + Math.min(1, t.box.w * t.box.h), 0);
  const imageArea = allPictures.filter((p) => !isBackground(p)).reduce((a, p) => a + p.area, 0);
  const avgObjects = slides.reduce((a, s) => a + s.pictures.length + s.texts.length, 0) / slides.length;
  const jpegs = allPictures.filter((p) => !isBackground(p) && /\.jpe?g$/i.test(p.path)).length;
  const pngs = allPictures.filter((p) => !isBackground(p) && /\.png$/i.test(p.path)).length;

  const cover = slides[0];
  const coverTitle = [...cover.texts].sort((a, b) => b.size - a.size)[0];
  const coverImages: DnaImageAsset[] = [];
  for (const p of cover.pictures) {
    if (isBackground(p) || /\.jpe?g$/i.test(p.path)) continue;
    const a = await asset(p);
    if (a) coverImages.push(a);
    if (coverImages.length >= 14) break;
  }

  const roundness = slides.reduce((a, s) => a + s.roundRects, 0) - slides.reduce((a, s) => a + s.rects, 0) * 0.5;
  const tone: EducationTone = pngs > jpegs * 2 && accents.some((c) => saturation(c) > 0.6) ? "kids" : jpegs > pngs ? "professional" : "mixed";

  return {
    id,
    fileHash: hashBytes(bytes),
    analyzerVersion: ANALYZER_VERSION,
    aspectRatio,
    slideWidthIn: slideW / EMU_PER_IN,
    slideHeightIn: slideH / EMU_PER_IN,
    palette: {
      primary: [...new Set([...accents, ...imageColors, ...themeAccents])].slice(0, 3),
      secondary: [...new Set(titleColors)].slice(0, 3),
      neutral: [...new Set([...textColors, ...titleColors].filter((c) => saturation(c) <= 0.3))].slice(0, 3),
      accent: [...new Set([...accents, ...imageColors].slice(1))].slice(0, 3),
      background: bgColors.slice(0, 3),
      text: textColors.slice(0, 3),
    },
    typography: {
      headingFonts: headingFonts.slice(0, 3),
      bodyFonts: bodyFonts.slice(0, 3),
      titleSizes: [...new Set(titles.map((t) => Math.round(t.size * scale)))].sort((a, b) => b - a).slice(0, 4),
      bodySizes: [...new Set(bodies.map((t) => Math.round(t.size * scale)))].sort((a, b) => b - a).slice(0, 4),
      weights: [...new Set(texts.map((t) => (t.bold ? 700 : 400)))],
    },
    shapes: { borderRadiusStyle: roundness > 2 ? "rounded" : roundness > 0 ? "soft" : roundness < -2 ? "square" : "mixed", cardFill: fills.find((c) => relativeLuminance(c) > 0.7) },
    imageStyle: { type: jpegs > pngs * 1.5 ? "photography" : pngs > jpegs * 1.5 ? "illustration" : "mixed" },
    composition: {
      visualDensity: avgObjects > 12 ? "high" : avgObjects > 6 ? "medium" : "low",
      whitespace: textArea / slides.length > 0.35 ? "low" : textArea / slides.length > 0.15 ? "medium" : "high",
      titleAlign,
      titlePosition,
      textImageRatio: textArea / Math.max(0.01, textArea + imageArea),
      avgObjectsPerSlide: Math.round(avgObjects * 10) / 10,
    },
    backgroundImage,
    backgroundColor: bgColors[0] ? cleanHex(bgColors[0]) : undefined,
    mascots,
    ornaments,
    cover: { images: coverImages, titleBox: coverTitle?.box, backgroundColor: cover.bgColor },
    mood: [
      isDark(bgColors[0] ?? "FFFFFF") ? "dark" : "light",
      accents.some((c) => saturation(c) > 0.6) ? "vibrant" : "calm",
      mascots.length ? "character-driven" : "clean",
    ],
    educationTone: tone,
  };
}

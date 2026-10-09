import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import type { DeckScript, ScriptSlide } from "./script";

/**
 * PowerPoint "foto + texto" (16:9): foto a sangre en la mitad derecha y texto
 * real a la izquierda, con los colores de la academia. La portada es la foto a
 * pantalla completa con el título encima. El texto de cada diapositiva también
 * va en las notas del orador.
 */

export interface DeckPhoto {
  data: Buffer;
  mime: string;
  width: number;
  height: number;
}

export interface RenderBrand {
  academyName: string;
  /** Color principal de la academia (#RRGGBB) */
  primary: string;
}

const W = 13.333;
const H = 7.5;
const PHOTO_X = 7.95;
const TEXT_X = 0.6;
const TEXT_W = PHOTO_X - TEXT_X - 0.45;
const FONT = "Segoe UI";
const INK = "1F2937";
const MUTED = "6B7280";

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

/** Títulos: el color de la academia oscurecido; resaltados: el color, legible sobre blanco. */
function palette(primary: string) {
  let accent: number[] = rgb(primary);
  // Sobre fondo blanco el resaltado necesita contraste (≥ 3:1)
  while (luminance(accent) > 0.32) accent = mix(accent, [0, 0, 0], 0.12);
  // Casi azul marino con un toque del color de la academia (como un título editorial)
  const title = mix(accent, [15, 27, 45], 0.8);
  const tint = mix(rgb(primary), [255, 255, 255], 0.85);
  return { accent: toHex(accent), title: toHex(title), tint: toHex(tint) };
}

// ─── Texto ───────────────────────────────────────────────────────────────────

type Run = { text: string; options?: PptxGenJS.TextPropsOptions };

/** "Hola **mundo**" → tramos con el resaltado en negrita y color. */
function runsOf(text: string, base: PptxGenJS.TextPropsOptions, accent: string): Run[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p) =>
    p.startsWith("**") && p.endsWith("**")
      ? { text: p.slice(2, -2), options: { ...base, bold: true, color: accent } }
      : { text: p, options: { ...base } }
  );
}

/** Mayor tamaño de letra con el que el texto cabe en la caja (estimación por caracteres). */
function fitFont(paragraphs: string[], boxW: number, boxH: number, sizes: number[]): number {
  for (const size of sizes) {
    const charsPerLine = (boxW * 72) / (size * 0.48);
    const lines = paragraphs.reduce((acc, p) => acc + Math.max(1, Math.ceil(p.replace(/\*\*/g, "").length / charsPerLine)), 0);
    const height = (lines * size * 1.22 + paragraphs.length * size * 0.45) / 72;
    if (height <= boxH) return size;
  }
  return sizes[sizes.length - 1];
}

/** Tamaño y alto del título: el mayor tamaño con el que cabe en dos líneas. */
function titleLayout(t: string): { size: number; h: number } {
  for (const size of [34, 31, 28, 25, 22]) {
    const lines = Math.ceil(t.length / ((TEXT_W * 72) / (size * 0.52)));
    if (lines <= 2) return { size, h: (lines * size * 1.18) / 72 + 0.08 };
  }
  return { size: 22, h: (3 * 22 * 1.18) / 72 + 0.08 };
}

/** Portada: degradado oscuro a la izquierda pintado en la propia foto (sin bordes duros). */
async function withCoverGradient(photo: DeckPhoto): Promise<DeckPhoto> {
  const w = photo.width;
  const h = photo.height;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0B1220" stop-opacity="0.82"/><stop offset="0.45" stop-color="#0B1220" stop-opacity="0.6"/><stop offset="0.75" stop-color="#0B1220" stop-opacity="0.12"/><stop offset="1" stop-color="#0B1220" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  try {
    const data = await sharp(photo.data).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 88 }).toBuffer();
    return { ...photo, data, mime: "image/jpeg" };
  } catch {
    return photo;
  }
}

function addPhoto(slide: PptxGenJS.Slide, photo: DeckPhoto | undefined, x: number, y: number, w: number, h: number, tint: string) {
  if (!photo) {
    slide.addShape("rect", { x, y, w, h, fill: { color: tint }, line: { color: tint, width: 0 } });
    return;
  }
  // "Cubrir" la caja recortando lo que sobra (como object-fit: cover)
  const scale = Math.max(w / photo.width, h / photo.height);
  const iw = photo.width * scale;
  const ih = photo.height * scale;
  slide.addImage({
    data: `${photo.mime};base64,${photo.data.toString("base64")}`,
    x, y, w: iw, h: ih,
    sizing: { type: "crop", x: (iw - w) / 2, y: (ih - h) / 2, w, h },
  });
}

function notesFor(s: ScriptSlide): string {
  return [s.title, s.text.replace(/\*\*/g, ""), ...s.items.map((i, n) => `${n + 1}. ${i.replace(/\*\*/g, "")}`), s.notes ? `\n${s.notes}` : ""]
    .filter(Boolean)
    .join("\n");
}

// ─── Diapositivas ────────────────────────────────────────────────────────────

function coverSlide(pptx: PptxGenJS, s: ScriptSlide, photo: DeckPhoto | undefined, brand: RenderBrand, colors: ReturnType<typeof palette>) {
  const slide = pptx.addSlide();
  // Sin foto: fondo del color de la academia (el degradado va dentro de la foto)
  addPhoto(slide, photo, 0, 0, W, H, colors.title);
  slide.addShape("rect", { x: TEXT_X, y: 2.35, w: 1.1, h: 0.09, fill: { color: colors.accent }, line: { color: colors.accent, width: 0 } });
  slide.addText(brand.academyName.toUpperCase(), { x: TEXT_X, y: 0.55, w: 7, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: "FFFFFF", charSpacing: 3, margin: 0 });
  slide.addText(s.title, { x: TEXT_X, y: 2.6, w: 7.4, h: 2.6, fontFace: FONT, fontSize: s.title.length > 50 ? 38 : 46, bold: true, color: "FFFFFF", valign: "top", margin: 0, fit: "shrink" });
  if (s.text) slide.addText(s.text.replace(/\*\*/g, ""), { x: TEXT_X, y: 5.35, w: 7.2, h: 0.8, fontFace: FONT, fontSize: 20, color: "E5E7EB", margin: 0 });
  slide.addNotes(notesFor(s));
}

function contentSlide(pptx: PptxGenJS, s: ScriptSlide, photo: DeckPhoto | undefined, brand: RenderBrand, colors: ReturnType<typeof palette>, index: number) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  addPhoto(slide, photo, PHOTO_X, 0, W - PHOTO_X, H, colors.tint);

  const { size: tSize, h: titleH } = titleLayout(s.title);
  slide.addText(s.title, { x: TEXT_X, y: 0.5, w: TEXT_W, h: titleH, fontFace: FONT, fontSize: tSize, bold: true, color: colors.title, valign: "top", margin: 0, lineSpacingMultiple: 0.95 });

  const bodyY = 0.5 + titleH + 0.3;
  const bodyH = H - bodyY - 0.6;
  const paragraphs = s.text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const isReading = s.type === "reading";
  const numbered = isReading || s.type === "exercise" || s.type === "objectives";
  const listHeading = isReading && s.items.length ? "Comprensión de lectura" : "";
  const all = [...paragraphs, ...(listHeading ? [listHeading] : []), ...s.items];
  const sizes = isReading ? [20, 19, 18, 17, 16, 15, 14, 13, 12, 11] : [24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12];
  const size = fitFont(all, TEXT_W, bodyH, sizes);

  const runs: Run[] = [];
  const base: PptxGenJS.TextPropsOptions = { fontFace: FONT, fontSize: size, color: INK, paraSpaceAfter: Math.round(size * 0.45) };
  paragraphs.forEach((p) => {
    const r = runsOf(p, base, colors.accent);
    r[r.length - 1].options = { ...r[r.length - 1].options, breakLine: true };
    runs.push(...r);
  });
  if (listHeading) runs.push({ text: listHeading, options: { ...base, bold: true, color: colors.title, fontSize: size + 1, breakLine: true } });
  s.items.forEach((item) => {
    const bullet = numbered ? { type: "number" as const, indent: Math.round(size * 1.1) } : { indent: Math.round(size * 0.9) };
    // La viñeta va solo en el primer tramo: si cada tramo la lleva, PowerPoint
    // abre un párrafo nuevo en cada palabra resaltada
    const r = runsOf(item, { ...base, paraSpaceAfter: Math.round(size * 0.3) }, colors.accent);
    r[0].options = { ...r[0].options, bullet };
    r[r.length - 1].options = { ...r[r.length - 1].options, breakLine: true };
    runs.push(...r);
  });
  if (runs.length) {
    slide.addText(runs, { x: TEXT_X, y: bodyY, w: TEXT_W, h: bodyH, valign: "top", margin: 0, lineSpacingMultiple: 1.08, fit: "shrink" });
  }

  slide.addText(`${brand.academyName}  ·  ${index}`, { x: TEXT_X, y: H - 0.5, w: TEXT_W, h: 0.3, fontFace: FONT, fontSize: 9, color: MUTED, margin: 0 });
  slide.addNotes(notesFor(s));
}

export async function renderPhotoDeck(script: DeckScript, photos: Map<string, DeckPhoto>, brand: RenderBrand): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PHOTO_16x9", width: W, height: H });
  pptx.layout = "PHOTO_16x9";
  pptx.title = script.title;
  pptx.company = brand.academyName;
  const colors = palette(brand.primary);

  for (const [i, s] of script.slides.entries()) {
    const photo = photos.get(s.id);
    if (s.type === "cover") coverSlide(pptx, s, photo ? await withCoverGradient(photo) : undefined, brand, colors);
    else contentSlide(pptx, s, photo, brand, colors, i + 1);
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

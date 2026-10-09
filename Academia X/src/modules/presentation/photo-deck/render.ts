import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import type { DeckScript, ScriptSlide } from "./script";
import { FONT, INK, MUTED, PHOTO_X, SLIDE_H, SLIDE_W, TEXT_W, TEXT_X, contentLayout, coverTitleSize, deckPalette, splitHighlights, type DeckColors } from "./layout";

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

const W = SLIDE_W;
const H = SLIDE_H;

type Run = { text: string; options?: PptxGenJS.TextPropsOptions };

/** "Hola **mundo**" → tramos con el resaltado en negrita y color. */
function runsOf(text: string, base: PptxGenJS.TextPropsOptions, accent: string): Run[] {
  return splitHighlights(text).map((p) => (p.hl ? { text: p.text, options: { ...base, bold: true, color: accent } } : { text: p.text, options: { ...base } }));
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

function coverSlide(pptx: PptxGenJS, s: ScriptSlide, photo: DeckPhoto | undefined, brand: RenderBrand, colors: DeckColors) {
  const slide = pptx.addSlide();
  // Sin foto: fondo del color de la academia (el degradado va dentro de la foto)
  addPhoto(slide, photo, 0, 0, W, H, colors.title);
  slide.addShape("rect", { x: TEXT_X, y: 2.35, w: 1.1, h: 0.09, fill: { color: colors.accent }, line: { color: colors.accent, width: 0 } });
  slide.addText(brand.academyName.toUpperCase(), { x: TEXT_X, y: 0.55, w: 7, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: "FFFFFF", charSpacing: 3, margin: 0 });
  slide.addText(s.title, { x: TEXT_X, y: 2.6, w: 7.4, h: 2.6, fontFace: FONT, fontSize: coverTitleSize(s.title), bold: true, color: "FFFFFF", valign: "top", margin: 0, fit: "shrink" });
  if (s.text) slide.addText(s.text.replace(/\*\*/g, ""), { x: TEXT_X, y: 5.35, w: 7.2, h: 0.8, fontFace: FONT, fontSize: 20, color: "E5E7EB", margin: 0 });
  slide.addNotes(notesFor(s));
}

function contentSlide(pptx: PptxGenJS, s: ScriptSlide, photo: DeckPhoto | undefined, brand: RenderBrand, colors: DeckColors, index: number) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };
  addPhoto(slide, photo, PHOTO_X, 0, W - PHOTO_X, H, colors.tint);

  const { titleSize: tSize, titleH, bodyY, bodyH, paragraphs, numbered, listHeading, size } = contentLayout(s);
  slide.addText(s.title, { x: TEXT_X, y: 0.5, w: TEXT_W, h: titleH, fontFace: FONT, fontSize: tSize, bold: true, color: colors.title, valign: "top", margin: 0, lineSpacingMultiple: 0.95 });

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
  const colors = deckPalette(brand.primary);

  for (const [i, s] of script.slides.entries()) {
    const photo = photos.get(s.id);
    if (s.type === "cover") coverSlide(pptx, s, photo ? await withCoverGradient(photo) : undefined, brand, colors);
    else contentSlide(pptx, s, photo, brand, colors, i + 1);
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

import PptxGenJS from "pptxgenjs";
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, type RGB } from "pdf-lib";
import { SLIDE_H, SLIDE_W, type Deco, type DeckTheme, type TextDensity } from "./presentation.themes";
import type { LessonImage } from "./presentation.images";
import { drawOptionBoxes } from "./rich-pptx";

/**
 * Convierte una lección en una presentación descargable (PPTX y PDF).
 *
 * El PPTX es el formato que más usan los profesores en clase: se puede editar,
 * proyectar y anotar encima. El PDF sirve para repartir a los alumnos.
 * La densidad decide cuánto texto va en cada diapositiva y el tema, el diseño.
 */

import { DENSITY, type DeckInput, type DeckSlide } from "./presentation.deck";
export { buildDeck, normalizeHex, type DeckInput, type DeckSlide } from "./presentation.deck";

/** Margen izquierdo del texto: el cuaderno deja sitio a la espiral */
const leftOf = (theme: DeckTheme) => (theme.id === "cuaderno" ? 1.15 : theme.id === "despertar" ? 0.75 : 0.8);

/** Rectángulo que ocupa una imagen dentro de un hueco sin deformarla (encaje completo). */
function containIn(img: LessonImage, box: { x: number; y: number; w: number; h: number }) {
  const scale = Math.min(box.w / img.width, box.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

const IMAGE_W = 3.7;

/** Genera el archivo .pptx */
export async function renderPptx(
  deck: DeckSlide[],
  input: DeckInput,
  theme: DeckTheme,
  density: TextDensity = "estandar",
  images: Map<string, LessonImage> = new Map()
): Promise<Buffer> {
  const d = DENSITY[density];
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = input.academyName;
  pptx.title = input.lessonTitle;

  const bgImage = theme.backgroundImage
    ? { data: `${theme.backgroundImage.mime};base64,${Buffer.from(theme.backgroundImage.data).toString("base64")}` }
    : null;

  const decorate = (s: PptxGenJS.Slide, decos: Deco[]) => {
    for (const deco of decos) {
      s.addShape(deco.shape === "ellipse" ? pptx.ShapeType.ellipse : pptx.ShapeType.rect, {
        x: deco.x, y: deco.y, w: deco.w, h: deco.h,
        fill: { color: deco.color, transparency: deco.transparency ?? 0 },
        line: { color: deco.color, transparency: 100 },
      });
    }
  };

  const left = leftOf(theme);
  const fullWidth = SLIDE_W - left - 0.8;
  const font = theme.font;
  const addImage = (s: PptxGenJS.Slide, img: LessonImage, box: { x: number; y: number; w: number; h: number }) => {
    s.addImage({ data: `${img.mime};base64,${Buffer.from(img.data).toString("base64")}`, ...containIn(img, box) });
  };

  for (const slide of deck) {
    const s = pptx.addSlide();
    const isCover = slide.kind === "cover";
    s.background = bgImage ?? { color: (isCover ? theme.coverBackground : undefined) ?? theme.background };
    decorate(s, isCover ? theme.coverDecorations ?? theme.decorations : theme.decorations);
    const img = slide.image ? images.get(slide.image) : undefined;
    // Con imagen, el texto ocupa la parte izquierda y la imagen la derecha
    const width = img ? fullWidth - IMAGE_W - 0.3 : fullWidth;

    if (isCover) {
      const titleColor = theme.coverTitle ?? theme.title;
      if (img) addImage(s, img, { x: SLIDE_W - 0.6 - 4, y: 0.8, w: 4, h: 4 });
      s.addText(slide.title, { x: left, y: 1.7, w: Math.min(width, 6.4), h: 1.5, fontSize: 38, bold: true, color: titleColor, fontFace: font, valign: "bottom" });
      if (slide.body) s.addText(slide.body, { x: left, y: 3.25, w: Math.min(width, 6.4), h: 0.5, fontSize: 16, color: theme.coverTitle ? "CBD5E1" : theme.text, fontFace: font });
      if (slide.footnote) s.addText(slide.footnote, { x: left, y: 4.75, w: width, h: 0.35, fontSize: 11, color: theme.coverTitle ? "94A3B8" : theme.text, fontFace: font });
      continue;
    }
    if (img) addImage(s, img, { x: SLIDE_W - 0.6 - IMAGE_W, y: 1.3, w: IMAGE_W, h: 3.7 });

    if (slide.kind === "section") {
      if (slide.footnote) s.addText(slide.footnote.toUpperCase(), { x: left, y: 1.55, w: width, h: 0.4, fontSize: 14, bold: true, color: theme.accent, fontFace: font, charSpacing: 3 });
      s.addText(slide.title, { x: left, y: 2, w: width, h: 1.3, fontSize: 36, bold: true, color: theme.title, fontFace: font, valign: "top" });
      if (slide.body) s.addText(slide.body, { x: left, y: 3.35, w: width, h: 1, fontSize: 16, color: theme.text, fontFace: font, valign: "top" });
      continue;
    }

    const isAnswer = slide.kind === "answer";
    const isQuiz = slide.kind === "quiz";
    s.addText(slide.title, { x: left, y: 0.45, w: width, h: 0.8, fontSize: d.title, bold: true, color: isAnswer ? "16A34A" : theme.title, fontFace: font });

    let cursorY = 1.35;
    if (slide.body) {
      const lines = Math.ceil(slide.body.length / (density === "minimo" ? 55 : density === "detallado" ? 120 : 85));
      const h = Math.min(slide.bullets?.length ? 1.9 : 3.7, 0.35 + lines * (d.body / 55));
      s.addText(slide.body, { x: left, y: cursorY, w: width, h, fontSize: isQuiz || isAnswer ? d.body + 4 : d.body, color: theme.text, fontFace: font, valign: "top" });
      cursorY += h + 0.1;
    }

    if (slide.options?.length && (isQuiz || isAnswer)) {
      // Opciones como cajas de colores; en la corrección, ✓ la buena y ✕ las demás
      drawOptionBoxes(pptx, s, slide.options, { x: left, y: cursorY + 0.05, w: width, h: Math.max(1.6, 5.0 - cursorY) }, font, isAnswer ? slide.correct : undefined);
    } else if (slide.bullets?.length) {
      s.addText(
        // breakLine: sin él, PowerPoint pega los elementos sin viñeta en una sola línea
        slide.bullets.map((b) => ({ text: b, options: { bullet: isQuiz ? false : { indent: 18 }, breakLine: true } })),
        { x: left + 0.1, y: cursorY, w: width - 0.1, h: Math.max(1, 5.05 - cursorY), fontSize: d.bullet, color: theme.text, fontFace: font, lineSpacingMultiple: 1.25, valign: "top" }
      );
    }

    s.addText(input.academyName, { x: left, y: 5.15, w: fullWidth, h: 0.3, fontSize: 9, color: "94A3B8", fontFace: font });
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

/**
 * pdf-lib con las fuentes estándar solo admite WinAnsi. Los acentos y la eñe
 * entran; los emojis y otros símbolos harían fallar la generación, así que se
 * sustituyen en vez de reventar la descarga.
 */
function toWinAnsi(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[–—]/g, "-")
    .replace(/[^\x00-\xFF]/g, "");
}

/** Reparte un texto en líneas que quepan en el ancho dado. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

const hexToRgb = (hex: string): RGB => rgb(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);

/** Genera el archivo .pdf con las mismas diapositivas y el mismo diseño */
export async function renderPdf(
  deck: DeckSlide[],
  input: DeckInput,
  theme: DeckTheme,
  density: TextDensity = "estandar",
  images: Map<string, LessonImage> = new Map()
): Promise<Buffer> {
  const d = DENSITY[density];
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(input.lessonTitle));
  pdf.setAuthor(toWinAnsi(input.academyName));

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bgImage = theme.backgroundImage
    ? theme.backgroundImage.mime === "image/png"
      ? await pdf.embedPng(theme.backgroundImage.data)
      : await pdf.embedJpg(theme.backgroundImage.data)
    : null;

  const PT = 72;
  const WIDTH = SLIDE_W * PT;
  const HEIGHT = SLIDE_H * PT;
  const LEFT = leftOf(theme) * PT;
  const CONTENT_WIDTH = WIDTH - LEFT - 0.8 * PT;
  const titleColor = hexToRgb(theme.title);
  const textColor = hexToRgb(theme.text);
  const accent = hexToRgb(theme.accent);
  const muted = rgb(0.58, 0.64, 0.72);

  const decorate = (page: PDFPage, decos: Deco[]) => {
    for (const deco of decos) {
      const color = hexToRgb(deco.color);
      const opacity = 1 - (deco.transparency ?? 0) / 100;
      if (deco.shape === "ellipse") {
        page.drawEllipse({ x: (deco.x + deco.w / 2) * PT, y: HEIGHT - (deco.y + deco.h / 2) * PT, xScale: (deco.w / 2) * PT, yScale: (deco.h / 2) * PT, color, opacity });
      } else {
        page.drawRectangle({ x: deco.x * PT, y: HEIGHT - (deco.y + deco.h) * PT, width: deco.w * PT, height: deco.h * PT, color, opacity });
      }
    }
  };

  // Ancho del texto de la diapositiva actual (se reduce si lleva imagen)
  let textWidth = CONTENT_WIDTH;
  const embedded = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
  const drawLessonImage = async (page: PDFPage, url: string, box: { x: number; y: number; w: number; h: number }) => {
    const img = images.get(url);
    if (!img) return false;
    let pdfImg = embedded.get(url);
    if (!pdfImg) {
      pdfImg = img.mime === "image/png" ? await pdf.embedPng(img.data) : await pdf.embedJpg(img.data);
      embedded.set(url, pdfImg);
    }
    const r = containIn(img, box);
    page.drawImage(pdfImg, { x: r.x * PT, y: HEIGHT - (r.y + r.h) * PT, width: r.w * PT, height: r.h * PT });
    return true;
  };

  const drawLines = (page: PDFPage, text: string, font: PDFFont, size: number, color: RGB, y: number, minY: number, prefix = "") => {
    for (const [i, line] of wrapText(toWinAnsi(text), font, size, textWidth - (prefix ? 14 : 0)).entries()) {
      if (y < minY) break;
      page.drawText(prefix ? (i === 0 ? `${prefix} ${line}` : `   ${line}`) : line, { x: LEFT + (prefix ? 6 : 0), y, size, font, color });
      y -= size * 1.35;
    }
    return y;
  };

  for (const slide of deck) {
    const page = pdf.addPage([WIDTH, HEIGHT]);
    const isCover = slide.kind === "cover";
    const bg = (isCover ? theme.coverBackground : undefined) ?? theme.background;
    page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: hexToRgb(bg) });
    if (bgImage) page.drawImage(bgImage, { x: 0, y: 0, width: WIDTH, height: HEIGHT });
    decorate(page, isCover ? theme.coverDecorations ?? theme.decorations : theme.decorations);

    const hasImage = slide.image
      ? await drawLessonImage(page, slide.image, isCover ? { x: SLIDE_W - 0.6 - 4, y: 0.8, w: 4, h: 4 } : { x: SLIDE_W - 0.6 - IMAGE_W, y: 1.3, w: IMAGE_W, h: 3.7 })
      : false;
    textWidth = hasImage ? CONTENT_WIDTH - (IMAGE_W + 0.3) * PT : CONTENT_WIDTH;

    if (isCover) {
      const color = hexToRgb(theme.coverTitle ?? theme.title);
      let y = HEIGHT - 160;
      for (const line of wrapText(toWinAnsi(slide.title), bold, 32, Math.min(textWidth, 6.4 * PT))) {
        page.drawText(line, { x: LEFT, y, size: 32, font: bold, color });
        y -= 38;
      }
      if (slide.body) page.drawText(toWinAnsi(slide.body).slice(0, 90), { x: LEFT, y: y - 8, size: 15, font: regular, color: theme.coverTitle ? rgb(0.8, 0.84, 0.88) : textColor });
      if (slide.footnote) page.drawText(toWinAnsi(slide.footnote).slice(0, 90), { x: LEFT, y: 50, size: 11, font: regular, color: muted });
      continue;
    }

    if (slide.kind === "section") {
      let y = HEIGHT - 130;
      if (slide.footnote) {
        page.drawText(toWinAnsi(slide.footnote.toUpperCase()), { x: LEFT, y, size: 13, font: bold, color: accent });
        y -= 40;
      }
      y = drawLines(page, slide.title, bold, 32, titleColor, y, 90);
      if (slide.body) drawLines(page, slide.body, regular, 15, textColor, y - 10, 40);
      continue;
    }

    const isAnswer = slide.kind === "answer";
    let y = HEIGHT - 0.55 * PT - d.title * 0.6;
    y = drawLines(page, slide.title, bold, d.title - 2, isAnswer ? rgb(0.09, 0.64, 0.29) : titleColor, y, 60) - 12;

    if (slide.body) {
      y = drawLines(page, slide.body, regular, slide.kind === "quiz" || isAnswer ? d.body + 3 : d.body, textColor, y, 50) - 8;
    }
    for (const bullet of slide.bullets || []) {
      y = drawLines(page, bullet, regular, d.bullet, textColor, y, 50, slide.kind === "quiz" ? "" : "•");
      y -= 3;
    }

    page.drawText(toWinAnsi(input.academyName), { x: LEFT, y: 20, size: 9, font: regular, color: muted });
  }

  return Buffer.from(await pdf.save());
}

/** Nombre de archivo seguro para la descarga */
export function deckFileName(lessonTitle: string, extension: string): string {
  const base = toWinAnsi(lessonTitle)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `${base || "leccion"}.${extension}`;
}

import PptxGenJS from "pptxgenjs";
import type { RichSlide } from "./ai-deck.schema";
import type { LessonImage } from "./presentation.images";
import { SLIDE_H, SLIDE_W, type Deco, type DeckTheme } from "./presentation.themes";

/**
 * Renderiza la presentación inteligente (IA) en PowerPoint con diseños
 * visuales: tarjetas, columnas, tablas, pasos, procesos, debate, quiz con
 * corrección y relacionar columnas. Usa los colores y adornos del tema elegido.
 */

const LETTERS = ["A", "B", "C", "D", "E"];
/** Colores de las opciones (círculo fuerte + fondo suave) */
const OPTION_TONES = [
  { strong: "4F7CF7", soft: "EAF0FE" },
  { strong: "0F9488", soft: "E0F7F4" },
  { strong: "D4A017", soft: "FEF6E0" },
  { strong: "F97341", soft: "FEEBE2" },
  { strong: "8B5CF6", soft: "F1EBFE" },
];
const MATCH_TONES = ["D6E2FF", "C9ECE8", "FDEBB0", "FDD2B8", "E4D8FD"];

function mix(hex: string, withHex: string, t: number) {
  const a = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const b = [0, 2, 4].map((i) => parseInt(withHex.slice(i, i + 2), 16));
  return a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase();
}

type Ctx = {
  pptx: PptxGenJS;
  theme: DeckTheme;
  font: string;
  soft: string;
  left: number;
  width: number;
  images: Map<string, LessonImage>;
};

function newSlide(ctx: Ctx, cover = false) {
  const { pptx, theme } = ctx;
  const s = pptx.addSlide();
  s.background = theme.backgroundImage
    ? { data: `${theme.backgroundImage.mime};base64,${Buffer.from(theme.backgroundImage.data).toString("base64")}` }
    : { color: (cover ? theme.coverBackground : undefined) ?? theme.background };
  const decos: Deco[] = cover ? theme.coverDecorations ?? theme.decorations : theme.decorations;
  for (const d of decos) {
    s.addShape(d.shape === "ellipse" ? pptx.ShapeType.ellipse : pptx.ShapeType.rect, {
      x: d.x, y: d.y, w: d.w, h: d.h,
      fill: { color: d.color, transparency: d.transparency ?? 0 },
      line: { color: d.color, transparency: 100 },
    });
  }
  return s;
}

function title(ctx: Ctx, s: PptxGenJS.Slide, text: string, opts: { center?: boolean; y?: number; w?: number; size?: number } = {}) {
  s.addText(text, {
    x: opts.center ? 0.6 : ctx.left, y: opts.y ?? 0.45, w: opts.w ?? (opts.center ? SLIDE_W - 1.2 : ctx.width), h: 0.85,
    fontSize: opts.size ?? 28, bold: true, color: ctx.theme.title, fontFace: ctx.font, align: opts.center ? "center" : "left", valign: "middle",
    fit: "shrink",
  });
}

function image(ctx: Ctx, s: PptxGenJS.Slide, url: string | undefined, box: { x: number; y: number; w: number; h: number }) {
  const img = url ? ctx.images.get(url) : undefined;
  if (!img) return false;
  const scale = Math.min(box.w / img.width, box.h / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  s.addImage({ data: `${img.mime};base64,${Buffer.from(img.data).toString("base64")}`, x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h });
  return true;
}

/** Opciones de una pregunta como cajas de colores; con `correct`, marca ✓ la buena y ✕ las demás. */
export function drawOptionBoxes(
  pptx: PptxGenJS,
  s: PptxGenJS.Slide,
  options: string[],
  box: { x: number; y: number; w: number; h: number },
  font: string,
  correct?: number
) {
  const gap = 0.14;
  const rowH = Math.min(0.72, (box.h - gap * (options.length - 1)) / options.length);
  options.forEach((opt, i) => {
    const y = box.y + i * (rowH + gap);
    const tone = OPTION_TONES[i % OPTION_TONES.length];
    const graded = correct !== undefined;
    const right = graded && i === correct;
    const fill = !graded ? tone.soft : right ? "DCFCE7" : "FEF2F2";
    const border = !graded ? tone.strong : right ? "22C55E" : "FCA5A5";
    s.addShape(pptx.ShapeType.roundRect, { x: box.x, y, w: box.w, h: rowH, fill: { color: fill }, line: { color: border, width: 1.25 }, rectRadius: 0.06 });
    const circle = !graded ? tone.strong : right ? "15803D" : "FCA5A5";
    s.addShape(pptx.ShapeType.ellipse, { x: box.x + 0.2, y: y + rowH / 2 - 0.19, w: 0.38, h: 0.38, fill: { color: circle }, line: { color: circle, width: 0 } });
    s.addText(!graded ? LETTERS[i] : right ? "✓" : "✕", {
      x: box.x + 0.2, y: y + rowH / 2 - 0.19, w: 0.38, h: 0.38, fontSize: 13, bold: true, color: "FFFFFF", align: "center", valign: "middle", fontFace: font,
    });
    s.addText(opt, { x: box.x + 0.75, y, w: box.w - 0.9, h: rowH, fontSize: 14, color: "1E293B", valign: "middle", fontFace: font, fit: "shrink" });
  });
}

function footer(ctx: Ctx, s: PptxGenJS.Slide, academy: string) {
  s.addText(academy, { x: ctx.left, y: SLIDE_H - 0.42, w: 5, h: 0.3, fontSize: 9, color: "94A3B8", fontFace: ctx.font });
}

export async function renderRichPptx(
  slides: RichSlide[],
  meta: { lessonTitle: string; academyName: string },
  theme: DeckTheme,
  images: Map<string, LessonImage> = new Map()
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.author = meta.academyName;
  pptx.title = meta.lessonTitle;

  const left = theme.id === "cuaderno" ? 1.15 : 0.7;
  const ctx: Ctx = { pptx, theme, font: theme.font, soft: mix(theme.accent, "FFFFFF", 0.82), left, width: SLIDE_W - left - 0.7, images };
  const { soft, font } = ctx;
  const text = theme.text;

  for (const slide of slides) {
    switch (slide.layout) {
      case "title": {
        const s = newSlide(ctx, true);
        const hasImg = image(ctx, s, slide.imageUrl, { x: 5.9, y: 0.8, w: 3.6, h: 4 });
        const w = hasImg ? 5 : 7.6;
        s.addText(slide.title, { x: left, y: 1.4, w, h: 1.9, fontSize: 40, bold: true, color: theme.coverTitle ?? theme.title, fontFace: font, valign: "bottom", fit: "shrink" });
        if (slide.subtitle) s.addText(slide.subtitle, { x: left, y: 3.4, w, h: 0.9, fontSize: 16, color: theme.coverTitle ? "CBD5E1" : text, fontFace: font, valign: "top" });
        footer(ctx, s, meta.academyName);
        break;
      }

      case "agenda": {
        const s = newSlide(ctx);
        s.addText(slide.title, { x: left, y: 0.7, w: 3.6, h: 1, fontSize: 36, bold: true, color: theme.title, fontFace: font });
        s.addText(slide.items.map((t) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: true, paraSpaceAfter: 10 } })), {
          x: 4.9, y: 0.9, w: SLIDE_W - 4.9 - 0.7, h: 4, fontSize: 17, color: text, fontFace: font, valign: "top",
        });
        footer(ctx, s, meta.academyName);
        break;
      }

      case "cards": {
        const s = newSlide(ctx);
        title(ctx, s, slide.title, { center: true });
        const n = slide.cards.length;
        const cols = n === 3 ? 3 : 2;
        const rows = Math.ceil(n / cols);
        const gap = 0.25;
        const areaX = 0.9, areaY = 1.45, areaW = SLIDE_W - 1.8, areaH = SLIDE_H - areaY - 0.55;
        const cw = (areaW - gap * (cols - 1)) / cols;
        const ch = (areaH - gap * (rows - 1)) / rows;
        slide.cards.forEach((c, i) => {
          const x = areaX + (i % cols) * (cw + gap);
          const y = areaY + Math.floor(i / cols) * (ch + gap);
          s.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: ch, fill: { color: soft }, line: { color: soft, width: 0 }, rectRadius: 0.12 });
          s.addText(c.icon, { x: x + 0.2, y: y + 0.18, w: 0.5, h: 0.5, fontSize: 22, fontFace: font });
          s.addText(c.heading, { x: x + 0.75, y: y + 0.18, w: cw - 0.95, h: 0.45, fontSize: 16, bold: true, color: theme.title, fontFace: font, valign: "middle", fit: "shrink" });
          s.addText(c.text, { x: x + 0.75, y: y + 0.65, w: cw - 0.95, h: ch - 0.8, fontSize: 12, color: text, fontFace: font, valign: "top", fit: "shrink" });
        });
        break;
      }

      case "two-columns": {
        const s = newSlide(ctx);
        let y = 0.55;
        if (slide.title) { title(ctx, s, slide.title); y = 1.35; }
        const colW = (ctx.width - 0.5) / 2;
        slide.columns.forEach((c, i) => {
          const x = left + i * (colW + 0.5);
          s.addText(c.heading, { x, y, w: colW, h: 0.75, fontSize: 24, bold: true, color: theme.title, fontFace: font, valign: "top", fit: "shrink" });
          s.addText(
            [
              { text: c.text, options: { breakLine: true, paraSpaceAfter: 12 } },
              ...c.bullets.map((b) => ({ text: b, options: { bullet: { indent: 14 }, breakLine: true, paraSpaceAfter: 6 } })),
            ],
            { x, y: y + 0.8, w: colW, h: SLIDE_H - y - 1.4, fontSize: 15, color: text, fontFace: font, valign: "top", fit: "shrink" }
          );
        });
        break;
      }

      case "text": {
        const s = newSlide(ctx);
        const hasImg = image(ctx, s, slide.imageUrl, { x: SLIDE_W - 0.7 - 3.6, y: 1.3, w: 3.6, h: 3.6 });
        const w = hasImg ? ctx.width - 3.9 : ctx.width;
        title(ctx, s, slide.title, { w });
        s.addText(
          [
            ...(slide.heading ? [{ text: slide.heading, options: { bold: true, fontSize: 18, color: theme.title, breakLine: true, paraSpaceAfter: 8 } }] : []),
            ...(slide.text ? [{ text: slide.text, options: { breakLine: true, paraSpaceAfter: 12 } }] : []),
            ...slide.bullets.map((b) => ({ text: b, options: { bullet: { indent: 16 }, breakLine: true, paraSpaceAfter: 6 } })),
          ],
          { x: left, y: 1.35, w, h: SLIDE_H - 1.35 - 0.6, fontSize: 16, color: text, fontFace: font, valign: "top", fit: "shrink" }
        );
        footer(ctx, s, meta.academyName);
        break;
      }

      case "table": {
        const s = newSlide(ctx);
        title(ctx, s, slide.title);
        let y = 1.3;
        if (slide.intro) {
          s.addText(slide.intro, { x: left, y, w: ctx.width, h: 0.65, fontSize: 13, color: text, fontFace: font, valign: "top", fit: "shrink" });
          y += 0.75;
        }
        const rows = [
          slide.headers.map((h) => ({ text: h, options: { bold: true, fill: { color: soft }, color: theme.title, align: "center" as const } })),
          ...slide.rows.map((r) => r.map((c) => ({ text: c, options: { color: "1E293B" } }))),
        ];
        s.addTable(rows, {
          x: left, y, w: ctx.width, colW: slide.headers.map(() => ctx.width / slide.headers.length),
          fontSize: 13, fontFace: font, border: { type: "solid", pt: 0.75, color: "94A3B8" }, rowH: 0.38, valign: "middle",
        });
        break;
      }

      case "steps": {
        const s = newSlide(ctx);
        let y = 0.5;
        if (slide.badge) {
          s.addShape(pptx.ShapeType.roundRect, { x: left, y, w: 3.2, h: 0.5, fill: { color: soft }, line: { color: soft, width: 0 }, rectRadius: 0.2 });
          s.addText(slide.badge, { x: left, y, w: 3.2, h: 0.5, fontSize: 14, bold: true, color: theme.title, align: "center", valign: "middle", fontFace: font });
          y += 0.75;
        } else {
          title(ctx, s, slide.title);
          y = 1.35;
        }
        const rowH = Math.min(0.95, (SLIDE_H - y - 0.5) / slide.steps.length);
        slide.steps.forEach((st, i) => {
          const ry = y + i * rowH;
          s.addShape(pptx.ShapeType.roundRect, { x: left, y: ry + 0.08, w: 0.55, h: 0.55, fill: { color: soft }, line: { color: soft, width: 0 }, rectRadius: 0.12 });
          s.addText(String(i + 1), { x: left, y: ry + 0.08, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: theme.title, align: "center", valign: "middle", fontFace: font });
          s.addText(
            [
              ...(st.heading ? [{ text: `${st.heading}. `, options: { bold: true } }] : []),
              { text: st.text, options: {} },
            ],
            // Alineado con la parte superior del número (no centrado en toda la fila)
            { x: left + 0.8, y: ry + 0.08, w: ctx.width - 0.8, h: Math.max(0.55, rowH - 0.12), fontSize: 14, color: text, fontFace: font, valign: "top", margin: [6, 4, 0, 4], fit: "shrink" }
          );
        });
        break;
      }

      case "process": {
        const s = newSlide(ctx);
        title(ctx, s, slide.title, { center: true });
        const n = slide.steps.length;
        const areaX = 0.6, areaW = SLIDE_W - 1.2;
        const w = areaW / n;
        slide.steps.forEach((st, i) => {
          const x = areaX + i * w;
          s.addShape(pptx.ShapeType.chevron, { x, y: 1.45, w: w - 0.05, h: 0.65, fill: { color: soft }, line: { color: soft, width: 0 } });
          s.addText(String(i + 1), { x, y: 1.45, w: w - 0.05, h: 0.65, fontSize: 18, bold: true, color: theme.title, align: "center", valign: "middle", fontFace: font });
          s.addText(st.heading, { x: x + 0.1, y: 2.3, w: w - 0.25, h: 0.6, fontSize: 15, bold: true, color: theme.title, fontFace: font, valign: "top", fit: "shrink" });
          s.addText(st.text, { x: x + 0.1, y: 2.95, w: w - 0.25, h: SLIDE_H - 2.95 - 0.5, fontSize: 12, color: text, fontFace: font, valign: "top", fit: "shrink" });
        });
        break;
      }

      case "discussion": {
        const s = newSlide(ctx);
        s.addText("?", { x: 6.2, y: 0.2, w: 3.6, h: 5, fontSize: 300, bold: true, color: mix(theme.accent, "FFFFFF", 0.9), align: "center", valign: "middle", fontFace: font });
        s.addShape(pptx.ShapeType.roundRect, { x: left, y: 0.55, w: 4.4, h: 0.5, fill: { color: soft }, line: { color: soft, width: 0 }, rectRadius: 0.2 });
        s.addText(slide.badge, { x: left, y: 0.55, w: 4.4, h: 0.5, fontSize: 13, bold: true, color: theme.title, align: "center", valign: "middle", fontFace: font });
        s.addText(slide.question, { x: left, y: 1.2, w: 6, h: 2.2, fontSize: 40, bold: true, color: theme.title, fontFace: font, valign: "middle", fit: "shrink" });
        s.addShape(pptx.ShapeType.rect, { x: left, y: 3.55, w: 0.05, h: 1.35, fill: { color: theme.title }, line: { color: theme.title, width: 0 } });
        s.addText(slide.prompt, { x: left + 0.2, y: 3.5, w: 6, h: 1.45, fontSize: 13, italic: true, color: text, fontFace: font, valign: "top", fit: "shrink" });
        break;
      }

      case "quiz": {
        for (const graded of [false, true]) {
          const s = newSlide(ctx);
          s.addText(slide.question, { x: 0.9, y: 0.45, w: SLIDE_W - 1.8, h: 1.35, fontSize: 20, bold: true, color: "0F172A", fontFace: font, valign: "middle", fit: "shrink" });
          drawOptionBoxes(pptx, s, slide.options, { x: 0.9, y: 1.95, w: SLIDE_W - 1.8, h: 3.2 }, font, graded ? slide.correctIndex : undefined);
          if (graded && slide.explanation) {
            s.addText(`💡 ${slide.explanation}`, { x: 0.9, y: SLIDE_H - 0.5, w: SLIDE_W - 1.8, h: 0.35, fontSize: 11, color: "166534", fontFace: font, fit: "shrink" });
          }
        }
        break;
      }

      case "matching": {
        for (const solved of [false, true]) {
          const s = newSlide(ctx);
          title(ctx, s, slide.title, { center: true, y: 0.5 });
          const n = slide.left.length;
          const rowH = Math.min(0.6, 3.4 / n);
          const gap = 0.14;
          const leftX = 1.2, leftW = 3.2, rightX = 4.7, rightW = 4.1;
          slide.left.forEach((item, i) => {
            const y = 1.5 + i * (rowH + gap);
            s.addShape(pptx.ShapeType.roundRect, { x: leftX, y, w: leftW, h: rowH, fill: { color: "FFFFFF" }, line: { color: "CBD5E1", width: 1 }, rectRadius: 0.06 });
            s.addShape(pptx.ShapeType.roundRect, { x: leftX + 0.12, y: y + 0.08, w: rowH - 0.16, h: rowH - 0.16, fill: { color: MATCH_TONES[i % MATCH_TONES.length] }, line: { color: "FFFFFF", width: 0 }, rectRadius: 0.05 });
            s.addText(String(i + 1), { x: leftX + 0.12, y: y + 0.08, w: rowH - 0.16, h: rowH - 0.16, fontSize: 13, bold: true, color: "0F172A", align: "center", valign: "middle", fontFace: font });
            s.addText(item, { x: leftX + rowH + 0.05, y, w: leftW - rowH - 0.15, h: rowH, fontSize: 14, color: "1E293B", valign: "middle", fontFace: font, fit: "shrink" });
          });
          slide.right.forEach((item, i) => {
            const y = 1.5 + i * (rowH + gap);
            const match = slide.answers[i];
            s.addShape(pptx.ShapeType.roundRect, { x: rightX, y, w: rightW, h: rowH, fill: { color: "FFFFFF" }, line: { color: "CBD5E1", width: 1 }, rectRadius: 0.06 });
            s.addShape(pptx.ShapeType.roundRect, {
              x: rightX + 0.12, y: y + 0.08, w: rowH - 0.16, h: rowH - 0.16,
              fill: { color: solved ? MATCH_TONES[match % MATCH_TONES.length] : "F1F5F9" }, line: { color: "FFFFFF", width: 0 }, rectRadius: 0.05,
            });
            s.addText(solved ? String(match + 1) : "( )", { x: rightX + 0.12, y: y + 0.08, w: rowH - 0.16, h: rowH - 0.16, fontSize: 12, bold: true, color: "0F172A", align: "center", valign: "middle", fontFace: font });
            s.addText(item, { x: rightX + rowH + 0.05, y, w: rightW - rowH - 0.15, h: rowH, fontSize: 13, color: "1E293B", valign: "middle", fontFace: font, fit: "shrink" });
          });
        }
        break;
      }

      case "conclusion": {
        const s = newSlide(ctx);
        s.addText(slide.title, { x: left, y: 0.7, w: 3.6, h: 1, fontSize: 36, bold: true, color: theme.title, fontFace: font });
        s.addText(slide.bullets.map((t) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: true, paraSpaceAfter: 10 } })), {
          x: 4.6, y: 0.6, w: SLIDE_W - 4.6 - 0.7, h: SLIDE_H - 1.2, fontSize: 16, color: text, fontFace: font, valign: "top", fit: "shrink",
        });
        footer(ctx, s, meta.academyName);
        break;
      }
    }
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

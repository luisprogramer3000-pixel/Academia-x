import PptxGenJS from "pptxgenjs";
import type { DecoShape, ImageElement, LineElement, ResolvedDesignSystem, ResolvedSlide, ShapeElement, TextElement } from "../types";
import { PptxExportError, SlideRenderError } from "../errors";
import { TEXT_INSET_PT } from "../layout/text-fit";
import { toSlideHeight, toSlideWidth, toSlideX, toSlideY } from "../layout/geometry";

/**
 * Exportador PPTX: SlideElement[] (ya validados) → PowerPoint editable.
 * Texto, formas y tarjetas quedan editables; solo las imágenes son ráster.
 * El fondo y las decoraciones van en patrones de diapositiva (masters): la
 * imagen de fondo del modelo se guarda una sola vez en el archivo.
 */

const MASTER_CONTENT = "V2_CONTENT";
const MASTER_COVER = "V2_COVER";

const dataUri = (img: { mime: string; data: Uint8Array }) => `${img.mime};base64,${Buffer.from(img.data).toString("base64")}`;

function decoObjects(d: ResolvedDesignSystem, decos: DecoShape[]) {
  return decos.map((x) => ({
    [x.shape === "ellipse" ? "ellipse" : "rect"]: {
      x: toSlideX(d, x.box.x), y: toSlideY(d, x.box.y), w: toSlideWidth(d, x.box.w), h: toSlideHeight(d, x.box.h),
      fill: { color: x.color, transparency: x.transparency ?? 0 },
      line: { color: x.color, transparency: 100 },
    },
  }));
}

/** Fondo del modelo colocado como en el original (Canva lo gira 90° o lo desborda): imagen en el patrón. */
function placedBackground(d: ResolvedDesignSystem) {
  if (!d.backgroundImage || !d.backgroundPlacement) return [];
  const p = d.backgroundPlacement;
  return [{
    image: {
      data: dataUri(d.backgroundImage),
      x: toSlideX(d, p.box.x), y: toSlideY(d, p.box.y), w: toSlideWidth(d, p.box.w), h: toSlideHeight(d, p.box.h),
      rotate: p.rotation || undefined,
    },
  }];
}

function defineMasters(pptx: PptxGenJS, d: ResolvedDesignSystem) {
  const placed = placedBackground(d);
  const background = d.backgroundImage && !placed.length ? { data: dataUri(d.backgroundImage) } : { color: d.colors.background };
  const objects = (decos: DecoShape[]) => [...placed, ...decoObjects(d, decos)] as PptxGenJS.SlideMasterProps["objects"];
  pptx.defineSlideMaster({ title: MASTER_CONTENT, background, objects: objects(d.decorations.content) });
  pptx.defineSlideMaster({
    title: MASTER_COVER,
    background: d.coverBackground ? { color: d.coverBackground } : background,
    objects: d.coverBackground ? decoObjects(d, d.decorations.cover) as PptxGenJS.SlideMasterProps["objects"] : objects(d.decorations.cover),
  });
}

function renderText(slide: PptxGenJS.Slide, d: ResolvedDesignSystem, e: TextElement) {
  const base = {
    x: toSlideX(d, e.box.x), y: toSlideY(d, e.box.y), w: toSlideWidth(d, e.box.w), h: toSlideHeight(d, e.box.h),
    fontFace: e.font, fontSize: e.fontSize, color: e.color, bold: e.bold, italic: e.italic,
    align: e.align, valign: e.valign, margin: TEXT_INSET_PT, lineSpacingMultiple: e.lineSpacing ?? (e.role === "icon" ? 1 : 1.1),
    paraSpaceAfter: e.bullets ? Math.round(e.fontSize * 0.35) : 0,
  } satisfies PptxGenJS.TextPropsOptions;

  if (e.bullets) {
    const lines = e.text.split("\n").filter((l) => l.trim());
    slide.addText(lines.map((l) => ({ text: l, options: { bullet: { indent: Math.round(e.fontSize * 0.9) }, breakLine: true } })), base);
    return;
  }
  if (e.runs?.length) {
    slide.addText(e.runs.map((r) => ({ text: r.text, options: { bold: r.bold ?? e.bold, italic: r.italic ?? e.italic, color: r.color ?? e.color, breakLine: r.breakLine } })), base);
    return;
  }
  slide.addText(e.text, base);
}

function renderShape(pptx: PptxGenJS, slide: PptxGenJS.Slide, d: ResolvedDesignSystem, e: ShapeElement) {
  const type = {
    rect: pptx.ShapeType.rect, roundRect: pptx.ShapeType.roundRect, ellipse: pptx.ShapeType.ellipse,
    triangle: pptx.ShapeType.triangle, rightArrow: pptx.ShapeType.rightArrow, chevron: pptx.ShapeType.chevron,
  }[e.shape];
  const w = toSlideWidth(d, e.box.w);
  const h = toSlideHeight(d, e.box.h);
  slide.addShape(type, {
    x: toSlideX(d, e.box.x), y: toSlideY(d, e.box.y), w, h,
    fill: { color: e.fill, transparency: e.transparency ?? 0 },
    line: e.line ? { color: e.line.color, width: e.line.width, dashType: e.line.dash === "dash" ? "dash" : "solid" } : { color: e.fill, transparency: 100, width: 0 },
    // rectRadius: proporción 0-1 del lado corto
    rectRadius: e.shape === "roundRect" ? Math.min(0.5, (e.radius ?? 0.12) / Math.max(0.01, Math.min(w, h))) : undefined,
    shadow: e.shadow ? { type: "outer", blur: 6, offset: 2, angle: 90, color: "0F172A", opacity: 0.12 } : undefined,
    flipV: e.shape === "triangle" ? true : undefined,
  });
}

function renderImage(slide: PptxGenJS.Slide, d: ResolvedDesignSystem, e: ImageElement) {
  const x = toSlideX(d, e.box.x);
  const y = toSlideY(d, e.box.y);
  const w = toSlideWidth(d, e.box.w);
  const h = toSlideHeight(d, e.box.h);
  const data = dataUri(e.image);
  if (e.fit === "contain") {
    slide.addImage({ data, x, y, w, h, altText: e.altText });
    return;
  }
  // Cover: la imagen escalada para cubrir la caja y recortada (sesgo hacia arriba), nunca deformada
  const scale = Math.max(w / e.image.width, h / e.image.height);
  const iw = e.image.width * scale;
  const ih = e.image.height * scale;
  slide.addImage({ data, x, y, w: iw, h: ih, altText: e.altText, sizing: { type: "crop", x: (iw - w) / 2, y: (ih - h) * 0.3, w, h } });
}

function renderLine(pptx: PptxGenJS, slide: PptxGenJS.Slide, d: ResolvedDesignSystem, e: LineElement) {
  const x1 = toSlideX(d, e.from.x);
  const y1 = toSlideY(d, e.from.y);
  const x2 = toSlideX(d, e.to.x);
  const y2 = toSlideY(d, e.to.y);
  slide.addShape(pptx.ShapeType.line, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(0.001, Math.abs(x2 - x1)), h: Math.max(0.001, Math.abs(y2 - y1)),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: e.color, width: e.width, endArrowType: e.arrow ? "triangle" : undefined },
  });
}

export async function renderPptx(slides: ResolvedSlide[], meta: { title: string; author: string; design: ResolvedDesignSystem }): Promise<Buffer> {
  const d = meta.design;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "V2", width: d.slide.widthIn, height: d.slide.heightIn });
  pptx.layout = "V2";
  pptx.author = meta.author;
  pptx.company = meta.author;
  pptx.title = meta.title;
  pptx.theme = { headFontFace: d.fonts.heading, bodyFontFace: d.fonts.body };
  defineMasters(pptx, d);

  for (const s of slides) {
    try {
      const slide = pptx.addSlide({ masterName: s.plan.pedagogicalRole === "cover" ? MASTER_COVER : MASTER_CONTENT });
      for (const e of s.elements) {
        if (e.kind === "text") renderText(slide, d, e);
        else if (e.kind === "shape") renderShape(pptx, slide, d, e);
        else if (e.kind === "image") renderImage(slide, d, e);
        else renderLine(pptx, slide, d, e);
      }
      if (s.notes) slide.addNotes(s.notes);
    } catch (cause) {
      throw new SlideRenderError(s.plan.id, `No se pudo dibujar la diapositiva ${s.plan.order}.`, { cause });
    }
  }

  try {
    return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  } catch (cause) {
    throw new PptxExportError("No se pudo generar el archivo PowerPoint.", { cause });
  }
}

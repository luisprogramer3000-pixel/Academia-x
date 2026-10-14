import type { ImageElement, ResolvedDesignSystem, SlideElement, SlideQualityMetrics, SlidePlan, TextElement } from "../types";
import { getContrastRatio } from "../design/color";
import { insideSafeArea, insideSlide, intersectionArea, TITLE_ZONE } from "../layout/geometry";
import { similarity } from "../text";

/**
 * Validación estructural de una diapositiva ANTES de escribir el PPTX:
 * fuera de lienzo, área segura, letra pequeña, texto que no cabe, choques
 * ilegales, imágenes deformadas, huecos vacíos, contraste y densidad.
 */

export interface SlideIssue {
  code: "REDUNDANT" | "OUT_OF_CANVAS" | "OUTSIDE_SAFE_AREA" | "FONT_TOO_SMALL" | "TEXT_OVERFLOW" | "ILLEGAL_OVERLAP" | "IMAGE_DISTORTED" | "EMPTY_TEXT" | "EMPTY_SLIDE" | "LOW_CONTRAST" | "TEXT_HEAVY" | "TOO_EMPTY";
  severity: "error" | "warning";
  detail: string;
}

export interface SlideAnalysis {
  issues: SlideIssue[];
  metrics: SlideQualityMetrics;
  score: number;
  textRatio: number;
  visualRatio: number;
}

const MIN_FONT: Record<TextElement["role"], number> = { title: 24, subtitle: 18, body: 14, label: 12, caption: 9, icon: 12 };

const area = (b: { w: number; h: number }) => Math.max(0, b.w) * Math.max(0, b.h);
const describe = (e: SlideElement) => (e.kind === "text" ? `texto "${e.text.slice(0, 20)}"` : e.kind === "shape" ? `forma ${e.shape}${e.group ? `(${e.group})` : ""}` : e.kind);

function overlapIsLegal(a: SlideElement, b: SlideElement): boolean {
  if (a.decorative || b.decorative) return true;
  if (a.kind === "line" || b.kind === "line") return true;
  if (a.group && a.group === b.group) return true;
  return false;
}

export function analyzeSlide(
  elements: SlideElement[],
  plan: SlidePlan,
  design: ResolvedDesignSystem,
  context: { repeatedLayout: boolean; sameFamilyAsPrevious: boolean }
): SlideAnalysis {
  const issues: SlideIssue[] = [];
  const texts = elements.filter((e): e is TextElement => e.kind === "text");
  const content = elements.filter((e) => !e.decorative);

  for (const e of content) {
    if (!insideSlide(e.box)) issues.push({ code: "OUT_OF_CANVAS", severity: "error", detail: `${e.kind} fuera de la diapositiva` });
    else if (e.kind === "text" && e.role !== "icon" && !insideSafeArea(e.box)) issues.push({ code: "OUTSIDE_SAFE_AREA", severity: "warning", detail: `texto "${e.text.slice(0, 30)}" cerca del borde` });
  }

  for (const t of texts) {
    if (!t.text.trim()) issues.push({ code: "EMPTY_TEXT", severity: "error", detail: "cuadro de texto vacío" });
    if (!t.decorative && t.role !== "icon" && t.fontSize < MIN_FONT[t.role]) issues.push({ code: "FONT_TOO_SMALL", severity: "error", detail: `${t.fontSize} pt en "${t.text.slice(0, 30)}"` });
    if (t.overflow && !t.decorative) issues.push({ code: "TEXT_OVERFLOW", severity: "error", detail: `no cabe: "${t.text.slice(0, 40)}"` });
    if (t.role !== "icon" && t.backgroundColor) {
      const ratio = getContrastRatio(t.color, t.backgroundColor);
      const large = t.fontSize >= 24 || (t.bold && t.fontSize >= 18.5);
      if (ratio < (large ? 3 : 4.5)) issues.push({ code: "LOW_CONTRAST", severity: "error", detail: `contraste ${ratio.toFixed(1)}:1 en "${t.text.slice(0, 30)}"` });
    }
  }

  // Choques: texto/imagen/forma de grupos distintos que se pisan
  const solid = content.filter((e) => e.kind !== "line");
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const a = solid[i];
      const b = solid[j];
      if (overlapIsLegal(a, b)) continue;
      // Una forma sin grupo bajo un texto de otro grupo sí es un choque; dos formas que se tocan no importan
      if (a.kind === "shape" && b.kind === "shape") continue;
      const inter = intersectionArea(a.box, b.box);
      if (inter > 0.15 * Math.min(area(a.box), area(b.box)) && inter > 0.0008) {
        issues.push({ code: "ILLEGAL_OVERLAP", severity: "error", detail: `${describe(a)} y ${describe(b)} se solapan` });
      }
    }
  }

  for (const img of elements.filter((e): e is ImageElement => e.kind === "image")) {
    if (img.fit !== "contain") continue;
    const boxRatio = (img.box.w * design.slide.widthIn) / (img.box.h * design.slide.heightIn);
    const imgRatio = img.image.width / img.image.height;
    if (Math.abs(boxRatio - imgRatio) / imgRatio > 0.03) issues.push({ code: "IMAGE_DISTORTED", severity: "error", detail: "imagen deformada" });
  }

  // Densidad (estimación geométrica): texto vs. visual vs. vacío, sin contar el título
  const contentTexts = texts.filter((t) => !t.decorative && t.role !== "title" && t.role !== "icon");
  const textArea = contentTexts.reduce((a, t) => a + area(t.box) * Math.min(1, (t.text.length * (t.fontSize / 20) ** 2) / 400), 0);
  const visualArea = elements.filter((e) => e.kind === "image" || (e.kind === "text" && e.role === "icon")).reduce((a, e) => a + Math.min(1, area(e.box)), 0)
    + elements.filter((e) => e.kind === "shape" && !e.decorative).reduce((a, e) => a + area(e.box) * 0.25, 0);
  const usable = 1 - TITLE_ZONE.h - 0.12;
  const textRatio = Math.min(1, textArea / usable);
  const visualRatio = Math.min(1, visualArea / usable);
  // Sin sentido: todo lo que se lee además del título repite el título
  const titleText = texts.find((t) => t.role === "title")?.text ?? plan.title;
  const bodyTexts = texts.filter((t) => !t.decorative && t.role !== "title" && t.role !== "icon");
  const norm = (x: string) => x.toLowerCase().replace(/[^a-záéíóúñü0-9]+/gi, " ").trim();
  if (plan.pedagogicalRole !== "cover" && bodyTexts.length && bodyTexts.every((t) => norm(t.text) === norm(titleText) || similarity(t.text, titleText) > 0.75)) {
    issues.push({ code: "REDUNDANT", severity: "error", detail: "el contenido solo repite el título" });
  }
  // Una lectura es texto por definición
  if (plan.pedagogicalRole !== "cover" && plan.pedagogicalRole !== "reading" && textRatio > 0.7) issues.push({ code: "TEXT_HEAVY", severity: "warning", detail: `${Math.round(textRatio * 100)} % de texto` });
  const meaningful = texts.filter((t) => !t.decorative && t.role !== "title" && t.role !== "icon");
  if (plan.pedagogicalRole !== "cover" && !meaningful.length && !elements.some((e) => e.kind === "image" && !e.decorative)) {
    issues.push({ code: "EMPTY_SLIDE", severity: "error", detail: "sin contenido además del título" });
  }
  if (plan.pedagogicalRole !== "cover" && textRatio + visualRatio < 0.08) issues.push({ code: "TOO_EMPTY", severity: "warning", detail: "demasiado espacio vacío" });

  const count = (code: SlideIssue["code"]) => issues.filter((x) => x.code === code).length;
  const imgs = elements.filter((e): e is ImageElement => e.kind === "image" && !e.decorative);
  const wantsVisual = plan.visualAssetRequests.length > 0;
  const iconsOnly = !imgs.length && texts.some((t) => t.role === "icon");
  const metrics: SlideQualityMetrics = {
    readability: Math.max(0, 1 - count("FONT_TOO_SMALL") * 0.4 - count("OUTSIDE_SAFE_AREA") * 0.1),
    contentFit: Math.max(0, 1 - count("TEXT_OVERFLOW") * 0.5 - count("OUT_OF_CANVAS") * 0.5 - count("EMPTY_TEXT") * 0.5 - count("REDUNDANT") * 0.6),
    visualBalance: Math.max(0, 1 - (textRatio > 0.7 ? (textRatio - 0.7) * 2 : 0) - count("TOO_EMPTY") * 0.3 - count("ILLEGAL_OVERLAP") * 0.35),
    imageRelevance: imgs.length ? imgs.reduce((a, i) => a + i.relevance, 0) / imgs.length : iconsOnly ? 0.7 : wantsVisual ? 0.5 : 0.8,
    contrast: Math.max(0, 1 - count("LOW_CONTRAST") * 0.35),
    layoutVariety: context.repeatedLayout ? 0.3 : context.sameFamilyAsPrevious ? 0.7 : 1,
    pedagogicalValue: Math.min(1, 0.5 + plan.importance * 0.1 + (plan.activity ? 0.1 : 0)),
    overflowPenalty: Math.min(1, count("TEXT_OVERFLOW") * 0.5 + count("OUT_OF_CANVAS") * 0.5 + count("EMPTY_SLIDE")),
  };
  return { issues, metrics, score: slideScore(metrics), textRatio, visualRatio };
}

/** Puntuación 0-100 de una diapositiva. */
export function slideScore(m: SlideQualityMetrics): number {
  const weighted =
    m.readability * 20 + m.contentFit * 22 + m.visualBalance * 14 + m.imageRelevance * 10 + m.contrast * 14 + m.layoutVariety * 8 + m.pedagogicalValue * 12;
  return Math.round(Math.max(0, Math.min(100, weighted - m.overflowPenalty * 30)));
}

export const SLIDE_QUALITY_THRESHOLD = 75;

import type { LayoutContext, LayoutDef } from "../types";
import { bulletsOf, firstOf, mainImage } from "../types";
import type { SlideBuilder } from "../components";
import type { NormBox } from "../../types";
import { box, inset } from "../geometry";
import { estimateTextHeight } from "../text-fit";
import { readableOn } from "../../design/color";
import { ROLE_EMOJI } from "../../icons";

/**
 * Concepto / explicación / ejemplo: una idea dominante, un visual y como
 * mucho 3-4 bloques. Varias composiciones de la misma familia para no repetir.
 */

const ROLES: LayoutDef["roles"] = ["concept", "explanation", "example", "grammar", "process"];

function hasTextContent(p: Parameters<LayoutDef["fit"]>[0]): boolean {
  // Varios elementos (tarjetas) no caben en una columna de texto
  if (p.contentBlocks.filter((b) => b.kind === "item").length >= 2 || p.contentBlocks.some((b) => b.kind === "table")) return false;
  return Boolean(firstOf(p, "text") || firstOf(p, "bullets") || firstOf(p, "example") || p.mainIdea);
}

/**
 * Bloque de texto: frase principal, viñetas y ejemplo destacado, en una
 * columna. Las alturas se reparten según lo que mide cada parte (motor de
 * ajuste), no con fracciones fijas.
 */
function textColumn(ctx: LayoutContext, b: SlideBuilder, area: NormBox, o: { on?: string; group?: string } = {}) {
  const d = ctx.design;
  const W = area.w * d.slide.widthIn;
  const lead = firstOf(ctx.plan, "text")?.text ?? ctx.plan.mainIdea;
  const bullets = bulletsOf(ctx, 3).filter((x) => x !== lead);
  const example = firstOf(ctx.plan, "example")?.text;
  const exampleText = example ? `${ctx.labels.example}: “${example}”` : "";
  const gap = 0.025;
  const toNorm = (inches: number) => inches / d.slide.heightIn;
  const leadH = lead ? toNorm(estimateTextHeight(lead, W, d.sizes.body + 4, d.fonts.body, { bold: true })) : 0;
  const bulletsH = bullets.length ? toNorm(estimateTextHeight(bullets.join("\n"), W, d.sizes.body, d.fonts.body, { bullets: true })) : 0;
  const exampleH = example ? toNorm(estimateTextHeight(exampleText, W - 0.5, d.sizes.body - 2, d.fonts.body)) + 0.03 : 0;
  const needed = leadH + bulletsH + exampleH + gap * 2;
  // Si sobra espacio se reparte; si falta, cada parte se encoge en proporción (el ajuste baja la letra)
  const scale = Math.min(1.1, area.h / Math.max(0.01, needed));
  let y = area.y + (scale > 1.15 && !example ? (area.h - needed * 1.1) / 3 : 0);
  if (lead) {
    const h = leadH * scale;
    b.text("body", lead, box(area.x, y, area.w, h), { max: d.sizes.body + 4, min: 18, bold: true, on: o.on, group: o.group, color: d.colors.text });
    y += h + gap;
  }
  if (bullets.length) {
    const h = Math.min(bulletsH * scale, area.y + area.h - y - exampleH * scale - gap);
    b.text("body", bullets.join("\n"), box(area.x, y, area.w, h), { bullets: true, on: o.on, group: o.group, max: d.sizes.body, min: 16 });
    y += h + gap;
  }
  if (example) {
    const h = Math.max(0.1, Math.min(exampleH * scale, area.y + area.h - y));
    const exBox = box(area.x, area.y + area.h - h, area.w, h);
    const g = o.group ?? b.newGroup("ex");
    const fill = d.colors.surfaceAlt;
    b.shape("roundRect", exBox, fill, { radius: d.radius.small, group: g });
    b.shape("rect", box(exBox.x, exBox.y, 0.008, exBox.h), d.colors.primary, { group: g });
    b.text("body", exampleText, inset(exBox, 0.018, 0.012), {
      on: fill, group: g, italic: true, valign: "middle", max: d.sizes.body - 2, min: 16,
      runs: [{ text: `${ctx.labels.example}: `, bold: true, color: readableOn(fill, [d.colors.primary, d.colors.text]) }, { text: `“${example}”`, italic: true }],
    });
  }
}

function sideVisual(ctx: LayoutContext, b: SlideBuilder, area: NormBox) {
  const img = mainImage(ctx);
  if (img?.image) b.image(img.image, area, { fit: "cover", rounding: true, relevance: img.relevance, alt: img.request.semanticQuery });
  else b.visual(ctx.assets[0] ?? { request: { type: "icon", semanticQuery: ctx.plan.title, purpose: "concept", importance: 0.5 }, kind: "emoji", emoji: ROLE_EMOJI[ctx.plan.pedagogicalRole] ?? "💡", source: "icon", relevance: 0.5 }, area, { circle: ctx.design.colors.surfaceAlt });
}

function textImage(id: string, imageLeft: boolean): LayoutDef {
  return {
    id,
    family: "text-image",
    roles: ROLES,
    image: "preferred",
    fit: (p) => (hasTextContent(p) ? 1 : 0),
    build(ctx, b) {
      b.title(ctx.plan.title);
      const visual = imageLeft ? box(0.05, 0.24, 0.38, 0.66) : box(0.57, 0.24, 0.38, 0.66);
      const text = imageLeft ? box(0.47, 0.25, 0.48, 0.64) : box(0.05, 0.25, 0.48, 0.64);
      sideVisual(ctx, b, visual);
      textColumn(ctx, b, text);
    },
  };
}

export const TITLE_IMAGE_RIGHT = textImage("TITLE_IMAGE_RIGHT", false);
export const TITLE_IMAGE_LEFT = textImage("TITLE_IMAGE_LEFT", true);

/** Tarjeta de concepto: visual grande arriba a la izquierda, término destacado y ejemplo en banda inferior. */
export const CONCEPT_CARD: LayoutDef = {
  id: "CONCEPT_CARD",
  family: "concept-card",
  roles: ["concept", "explanation"],
  image: "optional",
  fit: (p) => (hasTextContent(p) ? 0.95 : 0),
  toneBias: { kids: 0.4 },
  build(ctx, b) {
    const d = ctx.design;
    const card = box(0.05, 0.08, 0.9, 0.84);
    const g = b.newGroup("card");
    const on = b.card(card, { group: g });
    const visual = box(0.08, 0.14, 0.3, 0.5);
    const img = mainImage(ctx);
    if (img?.image) b.image(img.image, visual, { fit: "cover", rounding: true, relevance: img.relevance, group: g });
    else b.visual(ctx.assets[0], visual, { circle: d.colors.surfaceAlt, group: g });
    b.pill(ctx.labels.concept, box(0.42, 0.14, 0.15, 0.06), { fill: d.colors.primary, group: g });
    b.text("title", ctx.plan.title, box(0.42, 0.22, 0.5, 0.13), { bold: true, valign: "middle", on, group: g });
    textColumn(ctx, b, box(0.42, 0.37, 0.5, 0.5), { on, group: g });
  },
};

/** Imagen dominante: el visual ocupa más de la mitad; texto mínimo. */
export const IMAGE_DOMINANT: LayoutDef = {
  id: "IMAGE_DOMINANT",
  family: "image-dominant",
  roles: ["concept", "example", "explanation", "vocabulary"],
  image: "required",
  fit: (p) => (!hasTextContent(p) ? 0 : p.contentBlocks.length <= 3 ? 1 : 0.5),
  toneBias: { kids: 0.5 },
  build(ctx, b) {
    const d = ctx.design;
    const img = mainImage(ctx)!;
    b.image(img.image!, box(0, 0, 0.58, 1), { fit: "cover", relevance: img.relevance, decorative: false, alt: img.request.semanticQuery });
    b.text("title", ctx.plan.title, box(0.62, 0.1, 0.33, 0.18), { bold: true, valign: "bottom", max: d.sizes.title + 4 });
    b.shape("rect", box(0.62, 0.3, 0.08, 0.01), d.colors.accent, { decorative: true });
    textColumn(ctx, b, box(0.62, 0.34, 0.33, 0.58));
  },
};

/** Imagen a sangre con capa oscura para garantizar el contraste del texto. */
export const FULL_BLEED_IMAGE: LayoutDef = {
  id: "FULL_BLEED_IMAGE",
  family: "image-dominant",
  roles: ["example", "hook", "concept"],
  image: "required",
  fit: (p) => (!hasTextContent(p) ? 0 : p.contentBlocks.length <= 2 ? 0.9 : 0.3),
  toneBias: { adult: 0.3 },
  build(ctx, b) {
    const img = mainImage(ctx)!;
    b.image(img.image!, box(0, 0, 1, 1), { fit: "cover", relevance: img.relevance, decorative: true, alt: img.request.semanticQuery });
    const overlay = "0F172A";
    b.shape("rect", box(0, 0.52, 1, 0.48), overlay, { transparency: 25, decorative: true });
    const text = firstOf(ctx.plan, "example")?.text ?? firstOf(ctx.plan, "text")?.text ?? ctx.plan.mainIdea;
    // Fondo efectivo: la capa al 75 % sobre la foto ≈ casi negro
    b.text("title", ctx.plan.title, box(0.06, 0.56, 0.88, 0.14), { bold: true, on: "1E293B", color: "FFFFFF" });
    if (text) b.text("subtitle", text, box(0.06, 0.72, 0.88, 0.18), { on: "1E293B", color: "F1F5F9", max: ctx.design.sizes.subtitle });
  },
};

/** Sin imagen: enunciado grande + rasgos en chips (para cuando no hay visual útil). */
export const STATEMENT_CHIPS: LayoutDef = {
  id: "STATEMENT_CHIPS",
  family: "statement",
  roles: ["concept", "explanation", "example", "process", "grammar"],
  image: "none",
  fit: (p) => (hasTextContent(p) ? 0.8 : 0),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const lead = firstOf(ctx.plan, "text")?.text ?? ctx.plan.mainIdea;
    const g = b.newGroup("st");
    const on = b.card(box(0.05, 0.24, 0.9, 0.28), { fill: d.colors.surfaceAlt, group: g, shadow: false });
    b.icon(ctx.assets[0]?.emoji ?? ROLE_EMOJI[ctx.plan.pedagogicalRole] ?? "💡", box(0.08, 0.28, 0.08, 0.2), { group: g });
    b.text("subtitle", lead, box(0.18, 0.26, 0.74, 0.24), { bold: true, valign: "middle", on, group: g, max: d.sizes.subtitle + 2 });
    const bullets = bulletsOf(ctx, 3);
    const example = firstOf(ctx.plan, "example")?.text;
    const chips = [...bullets, ...(example ? [`${ctx.labels.example}: ${example}`] : [])].slice(0, 3);
    const chipW = (0.9 - 0.015 * (chips.length - 1)) / Math.max(1, chips.length);
    chips.forEach((c, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const cb = box(0.05 + i * (chipW + 0.015), 0.58, chipW, 0.3);
      const cg = b.newGroup("chip");
      const con = b.card(cb, { fill: tone.soft, group: cg, shadow: false });
      b.shape("rect", box(cb.x, cb.y, cb.w, 0.012), tone.strong, { group: cg });
      b.text("body", c, inset(cb, 0.02, 0.03), { on: con, group: cg, valign: "middle", max: d.sizes.body, min: 16 });
    });
  },
};

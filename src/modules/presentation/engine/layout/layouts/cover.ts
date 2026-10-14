import type { LayoutDef } from "../types";
import { firstOf, mainImage } from "../types";
import { box, inset } from "../geometry";
import { ROLE_EMOJI } from "../../icons";

/** Portadas: tema grande, nivel, marca y un visual relevante. */

/** Etiqueta corta de nivel ("Nivel A1"); un texto largo de la portada no cabe en la píldora. */
function levelText(ctx: Parameters<LayoutDef["build"]>[0]): string | undefined {
  const text = firstOf(ctx.plan, "text")?.text;
  if (text && text.length <= 24) return text;
  return ctx.level ? `${ctx.labels.level} ${ctx.level}` : undefined;
}

/** Subtítulo: la idea principal o, si la portada trae un texto largo, ese texto. */
function subtitleText(ctx: Parameters<LayoutDef["build"]>[0]): string {
  const text = firstOf(ctx.plan, "text")?.text;
  return ctx.plan.mainIdea || (text && text.length > 24 ? text : "");
}

export const COVER_HERO: LayoutDef = {
  id: "COVER_HERO",
  family: "cover",
  roles: ["cover"],
  image: "preferred",
  fit: () => 1,
  build(ctx, b) {
    const d = ctx.design;
    const hero = mainImage(ctx);
    const [textArea, visualArea] = [box(0.06, 0.16, 0.5, 0.68), box(0.58, 0.1, 0.37, 0.8)];
    // Banda de color detrás del visual
    b.shape("roundRect", box(0.6, 0.07, 0.37, 0.86), d.colors.surfaceAlt, { radius: d.radius.large, decorative: true });
    if (hero?.image) {
      b.image(hero.image, inset(visualArea, 0.012), { fit: "cover", rounding: true, relevance: hero.relevance, alt: hero.request.semanticQuery });
    } else if (ctx.mascot) {
      b.image(ctx.mascot, inset(visualArea, 0.01), { fit: "contain", decorative: true, relevance: 0.6 });
    } else {
      b.visual(ctx.assets[0], inset(visualArea, 0.05), { circle: d.colors.surface });
    }
    const level = levelText(ctx);
    if (level) b.pill(level, box(textArea.x, textArea.y, 0.16, 0.065), { fill: d.colors.primary });
    b.text("title", ctx.plan.title, box(textArea.x, textArea.y + 0.1, textArea.w, 0.4), { bold: true, max: d.sizes.hero, min: 30, valign: "middle", color: d.coverTitleColor ?? d.colors.title });
    b.shape("rect", box(textArea.x, textArea.y + 0.52, 0.12, 0.012), d.colors.accent, { decorative: true });
    const sub = subtitleText(ctx);
    if (sub) b.text("subtitle", sub, box(textArea.x, textArea.y + 0.55, textArea.w, 0.12), { max: d.sizes.subtitle - 2, min: 16, color: d.colors.mutedText });
    b.text("label", ctx.academyName, box(textArea.x, 0.84, textArea.w, 0.06), { max: 16, min: 13, color: d.colors.mutedText });
  },
};

export const COVER_MINIMAL: LayoutDef = {
  id: "COVER_MINIMAL",
  family: "cover",
  roles: ["cover"],
  image: "optional",
  fit: () => 0.85,
  build(ctx, b) {
    const d = ctx.design;
    const hero = mainImage(ctx);
    const icon = hero ? undefined : ctx.assets[0]?.emoji ?? ROLE_EMOJI.concept;
    if (hero?.image) b.image(hero.image, box(0.39, 0.1, 0.22, 0.3), { fit: "cover", rounding: true, relevance: hero.relevance });
    else if (icon) b.icon(icon, box(0.45, 0.12, 0.1, 0.18), { circle: d.colors.surfaceAlt });
    b.text("title", ctx.plan.title, box(0.1, 0.44, 0.8, 0.2), { bold: true, align: "center", valign: "middle", max: d.sizes.hero, min: 30, color: d.coverTitleColor ?? d.colors.title });
    b.shape("rect", box(0.45, 0.66, 0.1, 0.01), d.colors.accent, { decorative: true });
    const level = levelText(ctx);
    const sub = [subtitleText(ctx), level].filter(Boolean).join(" · ");
    if (sub) b.text("subtitle", sub, box(0.15, 0.69, 0.7, 0.08), { align: "center", max: d.sizes.subtitle - 4, color: d.colors.mutedText });
    b.text("label", ctx.academyName, box(0.2, 0.84, 0.6, 0.05), { align: "center", max: 15, min: 13, color: d.colors.mutedText });
    if (ctx.mascot) b.image(ctx.mascot, box(0.02, 0.5, 0.17, 0.5), { fit: "contain", decorative: true });
  },
};

/** Adaptar diseño original: la composición de la portada del modelo con el título de la clase en su sitio. */
export const COVER_TEMPLATE: LayoutDef = {
  id: "COVER_TEMPLATE",
  family: "cover",
  roles: ["cover"],
  image: "none",
  fit: () => 1,
  build(ctx, b) {
    const d = ctx.design;
    const title = d.coverTitleBox ?? box(0.1, 0.62, 0.8, 0.16);
    for (const ci of d.coverImages) {
      b.image(ci.image, ci.box, { fit: "contain", decorative: true, relevance: 0.6 });
    }
    // Panel bajo el título para garantizar el contraste sobre la ilustración
    const panel = inset(title, -0.012, -0.01);
    const on = b.card(panel, { fill: d.colors.surface, transparency: 10, shadow: false });
    b.text("title", ctx.plan.title, title, { bold: true, align: "center", valign: "middle", max: d.sizes.hero, min: 28, on });
    const level = levelText(ctx);
    if (level) b.pill(level, box(0.42, Math.min(0.9, panel.y + panel.h + 0.02), 0.16, 0.06), { fill: d.colors.primary });
  },
};

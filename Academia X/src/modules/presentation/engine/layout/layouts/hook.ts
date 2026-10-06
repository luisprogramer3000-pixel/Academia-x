import type { LayoutDef } from "../types";
import { blocksOf, firstOf, mainImage } from "../types";
import { box, inset } from "../geometry";
import { ROLE_EMOJI } from "../../icons";

/** Activación: pregunta grande o imagen para observar y predecir. */

export const HOOK_QUESTION: LayoutDef = {
  id: "HOOK_QUESTION",
  family: "statement",
  roles: ["hook", "reflection", "production"],
  image: "optional",
  fit: (p) => (firstOf(p, "question") ? 1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    const q = firstOf(ctx.plan, "question")!.text;
    const prompt = blocksOf(ctx.plan, "text")[0]?.text;
    b.title(ctx.plan.title, { box: box(0.05, 0.06, 0.6, 0.12) });
    const card = box(0.08, 0.24, ctx.mascot ? 0.6 : 0.84, 0.5);
    const g = b.newGroup("q");
    const on = b.card(card, { fill: d.colors.surface, group: g });
    b.icon(ctx.assets[0]?.emoji ?? ROLE_EMOJI.hook, box(card.x + 0.03, card.y + 0.06, 0.08, 0.14), { circle: d.colors.surfaceAlt, group: g });
    b.text("subtitle", q, box(card.x + 0.13, card.y + 0.05, card.w - 0.16, card.h - 0.1), { bold: true, valign: "middle", max: d.sizes.title, min: 22, on, group: g });
    if (prompt) {
      b.icon("⏱️", box(0.08, 0.79, 0.045, 0.08));
      b.text("body", prompt, box(0.135, 0.785, ctx.mascot ? 0.55 : 0.78, 0.09), { valign: "middle", color: d.colors.mutedText, max: d.sizes.body });
    }
    if (ctx.mascot) b.image(ctx.mascot, box(0.71, 0.18, 0.26, 0.82), { fit: "contain", decorative: true });
  },
};

export const HOOK_PICTURE: LayoutDef = {
  id: "HOOK_PICTURE",
  family: "image-dominant",
  roles: ["hook", "example"],
  activities: ["guess"],
  image: "required",
  fit: (p) => (p.contentBlocks.filter((x) => x.kind === "item").length >= 2 ? 0 : firstOf(p, "question") || p.mainIdea ? 1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    const hero = mainImage(ctx)!;
    const area = box(0.05, 0.08, 0.56, 0.84);
    b.image(hero.image!, area, { fit: "cover", rounding: true, relevance: hero.relevance, alt: hero.request.semanticQuery });
    b.title(ctx.plan.title, { box: box(0.65, 0.12, 0.3, 0.14) });
    const q = firstOf(ctx.plan, "question")?.text ?? ctx.plan.mainIdea;
    const g = b.newGroup("q");
    const on = b.card(box(0.65, 0.3, 0.3, 0.42), { group: g });
    b.text("subtitle", q, inset(box(0.65, 0.3, 0.3, 0.42), 0.02), { bold: true, valign: "middle", max: d.sizes.subtitle + 2, min: 18, on, group: g });
    const prompt = blocksOf(ctx.plan, "text")[0]?.text;
    if (prompt) b.text("label", prompt, box(0.65, 0.76, 0.3, 0.12), { color: d.colors.mutedText, max: 16 });
  },
};

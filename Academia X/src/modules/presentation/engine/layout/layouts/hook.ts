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
  // El reto completo (con escenario) va en CHALLENGE_SCENE: aquí perdería el escenario
  fit: (p) => (firstOf(p, "passage") ? 0 : firstOf(p, "question") ? 1 : 0),
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

const LETTERS = ["A", "B", "C", "D"];

/**
 * Reto práctico completo en una diapositiva: escenario y misión (izquierda),
 * pistas debajo, y a la derecha la imagen de la lección y la pregunta con sus
 * opciones. Nada queda fuera: el alumno tiene todo lo que necesita para responder.
 */
export const CHALLENGE_SCENE: LayoutDef = {
  id: "CHALLENGE_SCENE",
  family: "reading",
  roles: ["hook"],
  image: "optional",
  fit: (p) => (firstOf(p, "passage") && firstOf(p, "question") && firstOf(p, "options") ? 1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    const passage = firstOf(ctx.plan, "passage")!;
    const clues = firstOf(ctx.plan, "bullets")?.items ?? [];
    const q = firstOf(ctx.plan, "question")!.text;
    const opts = firstOf(ctx.plan, "options")!.options.slice(0, 4);
    const img = mainImage(ctx);

    b.pill(`🧩 ${ctx.labels.challenge}`, box(0.05, 0.065, 0.13, 0.065), { fill: d.colors.primary });
    b.text("title", ctx.plan.title, box(0.2, 0.065, 0.75, 0.09), { bold: true, valign: "middle", max: d.sizes.title - 6, min: 20 });

    // Escenario + misión
    const sceneH = clues.length ? 0.47 : 0.76;
    const sg = b.newGroup("scene");
    const scene = box(0.05, 0.17, 0.56, sceneH);
    const on = b.card(scene, { group: sg });
    b.text("body", passage.paragraphs.join("\n\n"), inset(scene, 0.02, 0.025), { on, group: sg, max: d.sizes.body, min: 14, lineSpacing: 1.2, color: d.colors.text });

    // Pistas
    if (clues.length) {
      const cg = b.newGroup("clues");
      const cbox = box(0.05, 0.17 + sceneH + 0.02, 0.56, 0.93 - (0.17 + sceneH + 0.02));
      const con = b.card(cbox, { group: cg, fill: d.colors.surfaceAlt, shadow: false });
      b.text("label", `🔎 ${ctx.labels.clues}`, box(cbox.x + 0.015, cbox.y + 0.012, cbox.w - 0.03, 0.065), { on: con, group: cg, bold: true, color: d.colors.primary, max: 18 });
      b.text("body", clues.map((c, i) => `${i + 1}. ${c}`).join("\n"), box(cbox.x + 0.015, cbox.y + 0.08, cbox.w - 0.03, cbox.h - 0.09), { on: con, group: cg, max: d.sizes.body - 2, min: 13 });
    }

    // Imagen + pregunta con opciones
    let y = 0.17;
    if (img?.image) {
      b.image(img.image, box(0.64, y, 0.31, 0.27), { fit: "cover", rounding: true, relevance: img.relevance, alt: img.request.semanticQuery });
      y += 0.29;
    }
    const qg = b.newGroup("q");
    const qbox = box(0.64, y, 0.31, 0.12);
    const qon = b.card(qbox, { group: qg, fill: d.colors.surface });
    b.text("body", q, inset(qbox, 0.012, 0.01), { on: qon, group: qg, bold: true, valign: "middle", max: d.sizes.body, min: 13 });
    y += 0.135;
    const rowH = Math.min(0.09, (0.93 - y) / opts.length - 0.012);
    opts.forEach((o, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const og = b.newGroup("opt");
      const ob = box(0.64, y + i * (rowH + 0.012), 0.31, rowH);
      const oon = b.card(ob, { fill: tone.soft, line: tone.strong, group: og, shadow: false });
      const s = Math.min(0.07, rowH * 0.75);
      b.badge(LETTERS[i], box(ob.x + 0.01, ob.y + (rowH - s) / 2, (s * d.slide.heightIn) / d.slide.widthIn, s), tone.strong, og);
      b.text("body", o, box(ob.x + 0.055, ob.y + 0.005, ob.w - 0.065, rowH - 0.01), { on: oon, group: og, valign: "middle", bold: true, max: d.sizes.body - 2, min: 13 });
    });
  },
};

export const HOOK_PICTURE: LayoutDef = {
  id: "HOOK_PICTURE",
  family: "image-dominant",
  roles: ["hook", "example"],
  activities: ["guess"],
  image: "required",
  fit: (p) => (firstOf(p, "passage") || p.contentBlocks.filter((x) => x.kind === "item").length >= 2 ? 0 : firstOf(p, "question") || p.mainIdea ? 1 : 0),
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

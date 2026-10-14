import type { LayoutDef } from "../types";
import { assetFor, blocksOf, countFit, items } from "../types";
import { box, columns, grid, inset } from "../geometry";
import { emojiFor, STEP_EMOJI } from "../../icons";
import { normalize } from "../../text";

/** Tarjetas: objetivos, conceptos agrupados, pasos, vocabulario y resumen. */

export const OBJECTIVES_CARDS: LayoutDef = {
  id: "OBJECTIVES_CARDS",
  family: "cards",
  roles: ["objectives"],
  image: "none",
  fit: (p) => countFit(items(p).length, 1, 4, 3),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const list = items(ctx.plan).slice(0, 4);
    const width = list.length === 1 ? 0.5 : 0.9;
    const cells = columns(box(0.05 + (0.9 - width) / 2, 0.27, width, 0.6), list.length, 0.03);
    list.forEach((it, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const g = b.newGroup("obj");
      const c = cells[i];
      const on = b.card(c, { group: g });
      b.shape("rect", box(c.x, c.y, c.w, 0.018), tone.strong, { group: g });
      b.badge(String(i + 1), box(c.x + 0.025, c.y + 0.06, 0.055, 0.098), tone.strong, g);
      b.icon(it.emoji ?? "🎯", box(c.x + c.w - 0.1, c.y + 0.05, 0.075, 0.13), { group: g });
      b.text("body", it.term, box(c.x + 0.02, c.y + 0.22, c.w - 0.04, c.h - 0.26), { on, group: g, bold: true, max: d.sizes.body + 2, min: 16 });
    });
  },
};

export const CARDS_ROW: LayoutDef = {
  id: "THREE_CARDS",
  family: "cards",
  roles: ["concept", "example", "summary", "explanation", "vocabulary"],
  image: "optional",
  fit: (p) => (items(p).some((i) => i.translation) ? 0.4 : countFit(items(p).length, 2, 4, 3)),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const list = items(ctx.plan).slice(0, 4);
    const cells = columns(box(0.05, 0.25, 0.9, 0.66), list.length, 0.025);
    list.forEach((it, i) => {
      const c = cells[i];
      const g = b.newGroup("card");
      const on = b.card(c, { group: g });
      const visual = box(c.x + 0.02, c.y + 0.03, c.w - 0.04, c.h * 0.42);
      const asset = assetFor(ctx, it.term);
      if (!(asset && b.visual(asset, visual, { group: g, circle: d.colors.tones[i % d.colors.tones.length].soft }))) {
        b.icon(it.emoji ?? "💡", visual, { group: g });
      }
      // Frase (ejemplo, idea): ocupa el cuerpo de la tarjeta; término corto: encabezado + detalle
      if (it.term.trim().split(/\s+/).length > 3 && !it.detail) {
        b.text("body", it.term, box(c.x + 0.02, c.y + c.h * 0.48, c.w - 0.04, c.h * 0.5), { on, group: g, bold: true, align: "center", valign: "middle", max: d.sizes.body + 2, min: 15 });
        return;
      }
      b.text("subtitle", it.term, box(c.x + 0.02, c.y + c.h * 0.48, c.w - 0.04, 0.1), { on, group: g, bold: true, align: "center", valign: "middle", max: d.sizes.subtitle - 2, min: 16 });
      if (it.detail) b.text("body", it.detail, box(c.x + 0.02, c.y + c.h * 0.48 + 0.11, c.w - 0.04, c.h * 0.52 - 0.14), { on, group: g, align: "center", max: d.sizes.body - 2, min: 15, color: d.colors.mutedText });
    });
  },
};

export const PROCESS_STEPS: LayoutDef = {
  id: "PROCESS_STEPS",
  family: "process",
  roles: ["process", "objectives", "practice", "summary"],
  image: "none",
  fit: (p) => {
    const steps = blocksOf(p, "steps")[0]?.steps.length ?? items(p).length;
    return countFit(steps, 3, 5, 4);
  },
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const steps = blocksOf(ctx.plan, "steps")[0]?.steps ?? items(ctx.plan).map((it) => ({ heading: it.term, text: it.detail }));
    const list = steps.slice(0, 5);
    const cells = columns(box(0.05, 0.3, 0.9, 0.56), list.length, 0.02);
    list.forEach((s, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const c = cells[i];
      const g = b.newGroup("step");
      b.shape("chevron", box(c.x, c.y, c.w, 0.13), tone.strong, { group: g });
      b.text("label", STEP_EMOJI[i] ? `${i + 1}` : String(i + 1), box(c.x + c.w * 0.3, c.y, c.w * 0.4, 0.13), { on: tone.strong, color: "FFFFFF", bold: true, align: "center", valign: "middle", group: g, max: 26 });
      const on = b.card(box(c.x, c.y + 0.16, c.w, c.h - 0.16), { fill: tone.soft, group: g, shadow: false });
      b.text("body", s.heading, box(c.x + 0.012, c.y + 0.18, c.w - 0.024, 0.12), { on, group: g, bold: true, align: "center", max: d.sizes.body, min: 15 });
      if (s.text) b.text("body", s.text, box(c.x + 0.012, c.y + 0.31, c.w - 0.024, c.h - 0.33), { on, group: g, align: "center", max: d.sizes.body - 3, min: 14, color: d.colors.mutedText });
    });
  },
};

function vocabularyGrid(id: string, maxItems: number): LayoutDef {
  return {
    id,
    family: "vocabulary",
    roles: ["vocabulary"],
    image: "optional",
    fit: (p) => countFit(items(p).length, maxItems === 4 ? 2 : 4, maxItems, maxItems),
    toneBias: { kids: 0.3 },
    build(ctx, b) {
      const d = ctx.design;
      b.title(ctx.plan.title);
      const list = items(ctx.plan).slice(0, maxItems);
      const cols = list.length <= 3 ? list.length : list.length === 4 ? 4 : 3;
      const cells = grid(box(0.05, 0.24, 0.9, 0.68), list.length, cols, 0.025, 0.035);
      // Todas las tarjetas con foto o todas con su icono: nunca mezcladas
      const found = list.map((it) => {
        const a = assetFor(ctx, it.term);
        return a && a.request.purpose === "vocabulary" && (normalize(a.request.label ?? a.request.semanticQuery) === normalize(it.term) || normalize(a.request.semanticQuery) === normalize(it.term)) ? a : undefined;
      });
      const allPhotos = found.every((a) => a?.kind === "image");
      list.forEach((it, i) => {
        const c = cells[i];
        const tone = d.colors.tones[i % d.colors.tones.length];
        const g = b.newGroup("voc");
        const on = b.card(c, { group: g });
        const labelH = Math.min(0.1, c.h * 0.3);
        const visual = inset(box(c.x, c.y, c.w, c.h - labelH - (it.detail && c.h > 0.4 ? 0.07 : 0)), 0.015, 0.02);
        const asset = found[i];
        const icon = emojiFor(it.term) ?? it.emoji ?? (asset?.kind === "emoji" ? asset.emoji : undefined) ?? "🔤";
        if (!(allPhotos && asset && b.visual(asset, visual, { group: g, circle: tone.soft }))) b.icon(icon, visual, { circle: tone.soft, group: g });
        const labelY = c.y + c.h - labelH - (it.detail && c.h > 0.4 ? 0.07 : 0);
        b.shape("roundRect", box(c.x + 0.015, labelY, c.w - 0.03, labelH - 0.012), tone.strong, { radius: d.radius.small, group: g });
        b.text("subtitle", it.term, box(c.x + 0.015, labelY, c.w - 0.03, labelH - 0.012), {
          on: tone.strong, color: "FFFFFF", bold: true, align: "center", valign: "middle", group: g, max: d.sizes.subtitle - 2, min: 14,
        });
        if (it.detail && c.h > 0.4) b.text("label", it.detail, box(c.x + 0.015, c.y + c.h - 0.07, c.w - 0.03, 0.06), { on, group: g, align: "center", valign: "middle", color: d.colors.mutedText, max: 15, min: 13 });
      });
    },
  };
}

export const VOCABULARY_GRID_4 = vocabularyGrid("VOCABULARY_GRID_4", 4);
export const VOCABULARY_GRID_6 = vocabularyGrid("VOCABULARY_GRID_6", 6);

export const SUMMARY_CHECKLIST: LayoutDef = {
  id: "SUMMARY_CHECKLIST",
  family: "summary",
  roles: ["summary"],
  image: "none",
  fit: (p) => countFit(items(p).length + blocksOf(p, "bullets").flatMap((x) => x.items).length, 2, 5, 4),
  build(ctx, b) {
    const d = ctx.design;
    const list = [...items(ctx.plan).map((i) => i.term), ...blocksOf(ctx.plan, "bullets").flatMap((x) => x.items)].slice(0, 5);
    const wide = ctx.mascot ? 0.66 : 0.9;
    b.title(ctx.plan.title, { box: box(0.05, 0.06, wide, 0.14) });
    const cells = list.length === 4 ? grid(box(0.05, 0.25, wide, 0.66), 4, 2, 0.025, 0.035) : columns(box(0.05, 0.25, wide, 0.66), 1, 0).flatMap((c) => Array.from({ length: list.length }, (_, i) => ({ x: c.x, y: c.y + i * (c.h / list.length), w: c.w, h: c.h / list.length - 0.02 })));
    list.forEach((t, i) => {
      const c = cells[i];
      const tone = d.colors.tones[i % d.colors.tones.length];
      const g = b.newGroup("sum");
      const on = b.card(c, { group: g, fill: tone.soft, shadow: false });
      const s = Math.min(c.h * 0.6, 0.11);
      const iconBox = box(c.x + 0.018, c.y + (c.h - s) / 2, (s * d.slide.heightIn) / d.slide.widthIn, s);
      b.badge("✓", iconBox, tone.strong, g);
      b.text("body", t, box(iconBox.x + iconBox.w + 0.015, c.y + 0.008, c.w - iconBox.w - 0.05, c.h - 0.016), { on, group: g, valign: "middle", bold: true, max: d.sizes.body, min: 15 });
    });
    if (ctx.mascot) b.image(ctx.mascot, box(0.74, 0.22, 0.24, 0.78), { fit: "contain", decorative: true });
  },
};

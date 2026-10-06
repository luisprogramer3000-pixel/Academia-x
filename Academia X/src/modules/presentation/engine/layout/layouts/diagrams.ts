import type { LayoutDef } from "../types";
import { countFit, firstOf } from "../types";
import { box, columns, inset } from "../geometry";
import { emojiFor } from "../../icons";

/** Diagramas: comparación, mapa mental, fórmula gramatical y diálogo. */

export const VS_LAYOUT: LayoutDef = {
  id: "VS_LAYOUT",
  family: "comparison",
  roles: ["comparison"],
  image: "none",
  fit: (p) => (firstOf(p, "columns")?.columns.length === 2 ? 1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title, { align: "center" });
    const cols = firstOf(ctx.plan, "columns")!.columns;
    const cells = [box(0.05, 0.24, 0.4, 0.68), box(0.55, 0.24, 0.4, 0.68)];
    cols.forEach((col, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const c = cells[i];
      const g = b.newGroup("vs");
      const on = b.card(c, { group: g, fill: tone.soft, shadow: false });
      b.icon(col.emoji ?? emojiFor(col.heading) ?? (i ? "🅱️" : "🅰️"), box(c.x + c.w / 2 - 0.05, c.y + 0.03, 0.1, 0.16), { circle: d.colors.surface, group: g });
      b.shape("roundRect", box(c.x + 0.03, c.y + 0.21, c.w - 0.06, 0.09), tone.strong, { radius: d.radius.small, group: g });
      b.text("subtitle", col.heading.toLocaleUpperCase("es"), box(c.x + 0.03, c.y + 0.21, c.w - 0.06, 0.09), { on: tone.strong, color: "FFFFFF", bold: true, align: "center", valign: "middle", group: g });
      const list = col.items.slice(0, 5 - ctx.reduction);
      b.text("body", list.join("\n"), box(c.x + 0.03, c.y + 0.33, c.w - 0.06, c.h - 0.36), { on, group: g, bullets: !list.some((x) => /^\p{Extended_Pictographic}/u.test(x)), max: d.sizes.body, min: 15 });
    });
    b.badge(ctx.labels.vs, box(0.465, 0.5, 0.07, 0.124), d.colors.accent);
  },
};

import { noteBand } from "./pro";

export const COMPARISON_SPLIT: LayoutDef = {
  id: "COMPARISON_SPLIT",
  family: "comparison",
  roles: ["comparison", "practice"],
  image: "none",
  fit: (p) => countFit(firstOf(p, "columns")?.columns.length ?? 0, 2, 3, 2) * (firstOf(p, "columns")?.columns.every((c) => c.items.length) ? 0.9 : 0),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const cols = firstOf(ctx.plan, "columns")!.columns;
    const noteH = noteBand(ctx, b);
    const cells = columns(box(0.05, 0.25, 0.9, 0.66 - noteH), cols.length, 0.03);
    cols.forEach((col, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const c = cells[i];
      const g = b.newGroup("col");
      const on = b.card(c, { group: g });
      b.shape("rect", box(c.x, c.y, 0.012, c.h), tone.strong, { group: g });
      b.text("subtitle", `${col.emoji ?? ""} ${col.heading}`.trim(), box(c.x + 0.03, c.y + 0.03, c.w - 0.05, 0.1), { on, group: g, bold: true, color: tone.strong, valign: "middle" });
      b.text("body", col.items.slice(0, 5 - ctx.reduction).join("\n"), box(c.x + 0.03, c.y + 0.15, c.w - 0.05, c.h - 0.18), { on, group: g, bullets: true, max: d.sizes.body, min: 15 });
    });
  },
};

export const MIND_MAP: LayoutDef = {
  id: "MIND_MAP",
  family: "diagram",
  roles: ["mind_map", "comparison", "summary"],
  image: "none",
  fit: (p) => countFit(firstOf(p, "tree")?.branches.length ?? 0, 2, 4, 3),
  build(ctx, b) {
    const d = ctx.design;
    const tree = firstOf(ctx.plan, "tree")!;
    b.title(ctx.plan.title);
    // Nodo central arriba, ramas en fila, hojas como píldoras debajo de cada rama
    const center = box(0.34, 0.22, 0.32, 0.11);
    const branches = tree.branches.slice(0, 4);
    const cells = columns(box(0.05, 0.45, 0.9, 0.12), branches.length, 0.03);
    const cy = center.y + center.h;
    const busY = 0.39;
    b.line({ x: 0.5, y: cy }, { x: 0.5, y: busY }, d.colors.primary, 2.5);
    b.line({ x: cells[0].x + cells[0].w / 2, y: busY }, { x: cells[cells.length - 1].x + cells[cells.length - 1].w / 2, y: busY }, d.colors.primary, 2.5);
    b.pill(tree.center.toLocaleUpperCase("es"), center, { fill: d.colors.primary, max: d.sizes.subtitle });
    branches.forEach((br, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const c = cells[i];
      const mid = c.x + c.w / 2;
      b.line({ x: mid, y: busY }, { x: mid, y: c.y }, d.colors.primary, 2.5);
      b.pill(`${br.emoji ?? emojiFor(br.label) ?? ""} ${br.label}`.trim(), c, { fill: tone.strong, max: d.sizes.body });
      const leaves = br.children.slice(0, 4 - Math.min(2, ctx.reduction));
      const available = 0.92 - (c.y + c.h + 0.04);
      const leafH = Math.min(0.085, available / Math.max(1, leaves.length) - 0.02);
      leaves.forEach((leaf, j) => {
        const ly = c.y + c.h + 0.045 + j * (leafH + 0.02);
        b.line({ x: c.x + 0.02, y: c.y + c.h }, { x: c.x + 0.02, y: ly + leafH / 2 }, tone.strong, 1.5);
        b.line({ x: c.x + 0.02, y: ly + leafH / 2 }, { x: c.x + 0.04, y: ly + leafH / 2 }, tone.strong, 1.5);
        b.pill(`${emojiFor(leaf) ?? ""} ${leaf}`.trim(), box(c.x + 0.04, ly, c.w - 0.04, leafH), { fill: tone.soft, color: d.colors.text, bold: false, max: d.sizes.body });
      });
    });
  },
};

export const GRAMMAR_FORMULA: LayoutDef = {
  id: "GRAMMAR_FORMULA",
  family: "formula",
  roles: ["grammar", "process"],
  image: "none",
  // Con resultado o regla, la fórmula va en FORMULA_RULE (muestra "= resultado" y la nota)
  fit: (p) => (firstOf(p, "formula") && !firstOf(p, "formula")?.result && !firstOf(p, "note") ? 1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    const f = firstOf(ctx.plan, "formula")!;
    b.title(ctx.plan.title);
    const parts = f.parts.slice(0, 5);
    const plusW = 0.04;
    const totalW = 0.9;
    const partW = (totalW - plusW * (parts.length - 1)) / parts.length;
    parts.forEach((part, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const x = 0.05 + i * (partW + plusW);
      b.pill(part, box(x, 0.28, partW, 0.14), { fill: tone.strong, max: d.sizes.subtitle + 2 });
      if (i < parts.length - 1) b.text("subtitle", "+", box(x + partW, 0.28, plusW, 0.14), { bold: true, align: "center", valign: "middle", color: d.colors.mutedText, max: 32 });
    });
    const examples = f.examples.slice(0, 3 - Math.min(2, ctx.reduction));
    examples.forEach((ex, i) => {
      const eb = box(0.1, 0.5 + i * 0.13, 0.8, 0.11);
      const g = b.newGroup("ex");
      const on = b.card(eb, { group: g, fill: d.colors.surface });
      b.text("body", `💬 ${ex}`, inset(eb, 0.02, 0.01), { on, group: g, valign: "middle", max: d.sizes.body + 2, min: 16 });
    });
  },
};

export const DIALOGUE: LayoutDef = {
  id: "DIALOGUE",
  family: "dialogue",
  roles: ["dialogue", "example"],
  image: "none",
  fit: (p) => countFit(firstOf(p, "dialogue")?.lines.length ?? 0, 2, 6, 4),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const lines = firstOf(ctx.plan, "dialogue")!.lines.slice(0, 6 - ctx.reduction);
    const speakers = [...new Set(lines.map((l) => l.speaker))];
    const rowH = Math.min(0.12, 0.68 / lines.length - 0.015);
    lines.forEach((l, i) => {
      const s = speakers.indexOf(l.speaker);
      const right = s % 2 === 1;
      const tone = d.colors.tones[s % d.colors.tones.length];
      const y = 0.24 + i * (rowH + 0.015);
      const g = b.newGroup("dl");
      const avatar = box(right ? 0.88 : 0.05, y, 0.07, rowH);
      b.badge(l.speaker.slice(0, 1).toUpperCase(), box(avatar.x, y + (rowH - 0.1) / 2, 0.055, 0.1), tone.strong, g);
      const bubble = box(right ? 0.3 : 0.13, y, 0.57, rowH);
      const on = b.card(bubble, { fill: tone.soft, group: g, shadow: false, radius: d.radius.large });
      b.text("body", `${l.speaker}: ${l.text}`, inset(bubble, 0.015, 0.008), {
        on, group: g, valign: "middle", max: d.sizes.body, min: 14,
        runs: [{ text: `${l.speaker}: `, bold: true, color: tone.strong }, { text: l.text }],
      });
    });
  },
};

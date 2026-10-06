import type { LayoutContext, LayoutDef } from "../types";
import { assetFor, blocksOf, countFit, firstOf, items } from "../types";
import type { SlideBuilder } from "../components";
import type { NormBox } from "../../types";
import { box, columns, grid, inset } from "../geometry";

/**
 * Layouts de clase profesional (como los materiales que prepara el profesor):
 * tablas de conjugación y matrices, tarjetas de ejemplo con foto + frase +
 * traducción, y la nota destacada ("Regla de oro", "Nota del profesor").
 */

/** Banda inferior con la nota destacada. Devuelve el alto que ocupa (0 si no hay nota). */
export function noteBand(ctx: LayoutContext, b: SlideBuilder, bottom = 0.93): number {
  const note = firstOf(ctx.plan, "note");
  if (!note) return 0;
  const d = ctx.design;
  const h = 0.15;
  const area = box(0.05, bottom - h, 0.9, h);
  const g = b.newGroup("note");
  const on = b.card(area, { group: g, fill: d.colors.surfaceAlt, shadow: false });
  b.shape("rect", box(area.x, area.y, 0.008, area.h), d.colors.accent, { group: g });
  b.text("body", note.label ? `**${note.label}:** ${note.text}` : note.text, inset(area, 0.02, 0.012), { on, group: g, valign: "middle", max: d.sizes.body - 2, min: 14 });
  return h + 0.02;
}

/** Tabla editable (formas + texto): cabecera de color, primera columna destacada. */
function drawTable(ctx: LayoutContext, b: SlideBuilder, area: NormBox) {
  const d = ctx.design;
  const t = firstOf(ctx.plan, "table")!;
  const cols = t.headers.length;
  const rows = t.rows.slice(0, 7).map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""));
  const rowH = Math.min(0.11, area.h / (rows.length + 1));
  const colW = area.w / cols;
  const g = b.newGroup("table");
  t.headers.forEach((h, c) => {
    const cell = box(area.x + c * colW, area.y, colW, rowH);
    b.shape("rect", cell, d.colors.primary, { group: g, line: { color: d.colors.surface, width: 1 } });
    b.text("label", h, inset(cell, 0.006, 0.004), { on: d.colors.primary, color: d.colors.onPrimary, bold: true, align: "center", valign: "middle", group: g, max: d.sizes.body, min: 12 });
  });
  rows.forEach((r, i) => {
    r.forEach((v, c) => {
      const cell = box(area.x + c * colW, area.y + (i + 1) * rowH, colW, rowH);
      const fill = c === 0 ? d.colors.surfaceAlt : d.colors.surface;
      b.shape("rect", cell, fill, { group: g, line: { color: d.colors.tones[0]?.soft ?? "E2E8F0", width: 1 } });
      if (v.trim()) b.text("body", v, inset(cell, 0.006, 0.004), { on: fill, bold: c === 0, align: c === 0 ? "left" : "center", valign: "middle", group: g, max: d.sizes.body + 2, min: 12 });
    });
  });
}

export const TABLE_GRID: LayoutDef = {
  id: "TABLE_GRID",
  family: "table",
  roles: ["grammar", "comparison", "vocabulary", "concept", "explanation", "process", "mind_map", "example"],
  image: "optional",
  fit: (p) => (firstOf(p, "table") ? 1 : 0),
  build(ctx, b) {
    b.title(ctx.plan.title);
    const lead = firstOf(ctx.plan, "text")?.text;
    let top = 0.22;
    if (lead) {
      b.text("body", lead, box(0.05, 0.2, 0.9, 0.08), { max: ctx.design.sizes.body, min: 15, color: ctx.design.colors.mutedText });
      top = 0.3;
    }
    const noteH = noteBand(ctx, b);
    const img = assetFor(ctx);
    const withImage = img?.kind === "image" && img.image;
    const tableArea = box(0.05, top, withImage ? 0.62 : 0.9, 0.93 - noteH - top);
    drawTable(ctx, b, tableArea);
    if (withImage) b.image(img!.image!, box(0.7, top, 0.25, tableArea.h), { fit: "cover", rounding: true, relevance: img!.relevance });
  },
};

/** Tarjetas con foto + frase (con su parte clave resaltada) + traducción, en rejilla de 3 columnas. */
export const PHOTO_EXAMPLES: LayoutDef = {
  id: "PHOTO_EXAMPLES",
  family: "photo-cards",
  roles: ["example", "grammar", "vocabulary", "concept", "practice", "explanation"],
  image: "optional",
  fit: (p) => {
    const list = items(p);
    const sentences = list.filter((i) => i.term.split(/\s+/).length >= 3 || i.translation).length;
    return sentences >= 2 ? countFit(list.length, 2, 6, 6) : 0;
  },
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title, { align: "center" });
    const list = items(ctx.plan).slice(0, 6);
    // Hasta 4: una fila; 5-6: rejilla de 3 columnas (como en un libro de texto)
    const cols = list.length <= 4 ? list.length : 3;
    const rowsN = Math.ceil(list.length / cols);
    const cells = grid(box(0.05, 0.19, 0.9, 0.74), list.length, cols, 0.02, 0.03);
    list.forEach((it, idx) => {
      const c = cells[idx];
      const g = b.newGroup("pc");
      const on = b.card(c, { group: g });
      const photoH = c.h * (rowsN > 1 ? 0.48 : 0.55);
      const asset = assetFor(ctx, it.term);
      if (!(asset && b.visual(asset, inset(box(c.x, c.y, c.w, photoH), 0.008, 0.012), { group: g, fit: "cover", circle: d.colors.surfaceAlt }))) {
        b.icon(it.emoji ?? "💬", inset(box(c.x, c.y, c.w, photoH), 0.03), { group: g, circle: d.colors.surfaceAlt });
      }
      const textTop = c.y + photoH + 0.008;
      const textH = c.h - photoH - 0.016;
      const tr = it.translation ?? it.detail;
      const sentenceH = tr ? textH * 0.55 : textH;
      b.text("body", it.term, box(c.x + 0.01, textTop, c.w - 0.02, sentenceH), { on, group: g, bold: true, align: "center", valign: "middle", max: d.sizes.body, min: 14 });
      if (tr) {
        b.shape("rect", box(c.x + c.w * 0.25, textTop + sentenceH, c.w * 0.5, 0.003), d.colors.mutedText, { group: g, transparency: 60 });
        b.text("body", tr, box(c.x + 0.01, textTop + sentenceH + 0.005, c.w - 0.02, textH - sentenceH - 0.005), { on, group: g, italic: true, align: "center", valign: "middle", color: d.colors.mutedText, max: d.sizes.body - 3, min: 14 });
      }
    });
  },
};

export const FORMULA_RULE: LayoutDef = {
  id: "FORMULA_RULE",
  family: "formula",
  roles: ["grammar", "process", "concept"],
  image: "none",
  fit: (p) => (firstOf(p, "formula")?.result || firstOf(p, "note") && firstOf(p, "formula") ? 1.1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    const f = firstOf(ctx.plan, "formula")!;
    b.title(ctx.plan.title, { align: "center" });
    const parts = f.parts.slice(0, 4);
    const pieces = [...parts.flatMap((p, i) => (i < parts.length - 1 ? [p, "+"] : [p])), ...(f.result ? ["=", f.result] : [])];
    const widths = pieces.map((p) => (p === "+" || p === "=" ? 0.04 : p === f.result ? 0.3 : 0.18));
    const scale = Math.min(1, 0.9 / widths.reduce((a, w) => a + w + 0.01, 0));
    let x = 0.05 + (0.9 - widths.reduce((a, w) => a + (w + 0.01) * scale, 0)) / 2;
    pieces.forEach((p, i) => {
      const w = widths[i] * scale;
      if (p === "+" || p === "=") b.text("subtitle", p, box(x, 0.26, w, 0.13), { bold: true, align: "center", valign: "middle", color: d.colors.mutedText, max: 36 });
      else {
        const tone = p === f.result ? { strong: d.colors.primary } : d.colors.tones[i % d.colors.tones.length];
        b.pill(p, box(x, 0.26, w, 0.13), { fill: tone.strong, max: d.sizes.subtitle + 2 });
      }
      x += w + 0.01 * scale;
    });
    const noteH = noteBand(ctx, b);
    const examples = f.examples.slice(0, 4 - Math.min(2, ctx.reduction));
    const area = box(0.08, 0.46, 0.84, 0.93 - noteH - 0.48);
    columns(area, Math.min(2, Math.max(1, examples.length)), 0.03).forEach((col, ci) => {
      const mine = examples.filter((_, i) => i % 2 === ci || examples.length === 1);
      mine.forEach((ex, i) => {
        const eb = box(col.x, col.y + i * (col.h / Math.max(1, mine.length)), col.w, col.h / Math.max(1, mine.length) - 0.02);
        const g = b.newGroup("fx");
        const on = b.card(eb, { group: g });
        b.text("body", ex, inset(eb, 0.015, 0.008), { on, group: g, valign: "middle", align: "center", max: d.sizes.body + 2, min: 14 });
      });
    });
  },
};

export const PRO_LAYOUTS = [TABLE_GRID, PHOTO_EXAMPLES, FORMULA_RULE];
void blocksOf;

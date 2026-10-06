import type { LayoutDef } from "../types";
import { mainImage } from "../types";
import type { SlideContentBlock } from "../../types";
import { box, inset } from "../geometry";
import { ROLE_EMOJI } from "../../icons";

/**
 * Layout universal de respaldo: cualquier rol y cualquier combinación de
 * bloques, en una tarjeta legible. Solo se elige cuando ningún layout
 * específico encaja (puntuación baja), para no perder nunca contenido.
 */

const LETTERS = ["A", "B", "C", "D", "E"];

export function blockLines(b: SlideContentBlock): string[] {
  switch (b.kind) {
    case "heading":
    case "text":
    case "question": return [b.text];
    case "example": return [`“${b.text}”`];
    case "bullets": return b.items;
    case "item": return [`${b.emoji ? `${b.emoji} ` : ""}${b.term}${b.detail ? ` — ${b.detail}` : ""}`];
    case "options": return b.options.map((o, i) => `${LETTERS[i]}) ${o}`);
    case "pairs": return b.left.map((l, i) => `${l}  →  ${b.right[b.answers.indexOf(i)] ?? "?"}`);
    case "columns": return b.columns.map((c) => `${c.emoji ?? ""} ${c.heading}${c.items.length ? `: ${c.items.join(", ")}` : ""}`.trim());
    case "steps": return b.steps.map((s, i) => `${i + 1}. ${s.heading}${s.text ? ` — ${s.text}` : ""}`);
    case "tree": return b.branches.map((br) => `${br.label}: ${br.children.join(", ")}`);
    case "formula": return [b.parts.join(" + "), ...b.examples];
    case "dialogue": return b.lines.map((l) => `${l.speaker}: ${l.text}`);
    case "blank": return [b.sentence];
    case "statements": return b.items.map((s) => `☐ ${s.text}`);
    case "passage": return b.paragraphs;
    case "table": return [b.headers.join(" · "), ...b.rows.map((r) => r.join(" · "))];
    case "note": return [`${b.label ? `${b.label}: ` : ""}${b.text}`];
  }
}

export const FLEX_CONTENT: LayoutDef = {
  id: "FLEX_CONTENT",
  family: "flex",
  roles: ["hook", "objectives", "explanation", "concept", "vocabulary", "grammar", "example", "comparison", "process", "mind_map", "dialogue", "practice", "production", "reflection", "quiz", "assessment", "summary", "exit_ticket"],
  image: "optional",
  fit: (p) => (p.contentBlocks.length || p.mainIdea ? 0.3 : 0),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const lines = ctx.plan.contentBlocks.flatMap(blockLines).filter(Boolean).slice(0, Math.max(2, 6 - ctx.reduction));
    if (!lines.length && ctx.plan.mainIdea) lines.push(ctx.plan.mainIdea);
    const img = mainImage(ctx);
    const cardW = img ? 0.56 : 0.9;
    const g = b.newGroup("flex");
    const card = box(0.05, 0.24, cardW, 0.68);
    const on = b.card(card, { group: g });
    b.icon(ctx.assets[0]?.emoji ?? ROLE_EMOJI[ctx.plan.pedagogicalRole] ?? "💡", box(0.075, 0.27, 0.06, 0.1), { circle: d.colors.surfaceAlt, group: g });
    b.text("body", lines.join("\n"), inset(box(0.15, 0.25, cardW - 0.11, 0.66), 0.01, 0.015), { on, group: g, bullets: lines.length > 1, max: d.sizes.body + 2, min: 16 });
    if (img?.image) b.image(img.image, box(0.64, 0.24, 0.31, 0.68), { fit: "cover", rounding: true, relevance: img.relevance });
  },
};

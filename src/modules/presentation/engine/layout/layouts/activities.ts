import type { LayoutDef } from "../types";
import { blocksOf, countFit, firstOf } from "../types";
import { box, columns, grid, inset } from "../geometry";
import { emojiFor, ROLE_EMOJI } from "../../icons";

/** Actividades: deben verse como actividades (columnas para unir, opciones, huecos, casillas). */

const LETTERS = ["A", "B", "C", "D", "E"];
const PRACTICE: LayoutDef["roles"] = ["practice", "production", "quiz", "assessment", "exit_ticket", "reflection"];

export const MATCHING: LayoutDef = {
  id: "MATCHING",
  family: "activity-columns",
  roles: PRACTICE,
  activities: ["matching"],
  image: "none",
  fit: (p) => countFit(firstOf(p, "pairs")?.left.length ?? 0, 2, 5, 4),
  build(ctx, b) {
    const d = ctx.design;
    const pairs = firstOf(ctx.plan, "pairs")!;
    b.title(ctx.plan.title);
    const prompt = firstOf(ctx.plan, "text")?.text;
    if (prompt) b.text("label", prompt, box(0.05, 0.2, 0.9, 0.06), { color: d.colors.mutedText, max: 18 });
    const n = Math.min(pairs.left.length, pairs.right.length, 5);
    const rowsH = Math.min(0.13, 0.62 / n - 0.02);
    for (let i = 0; i < n; i++) {
      const y = 0.29 + i * (rowsH + 0.025);
      const tone = d.colors.tones[i % d.colors.tones.length];
      const lg = b.newGroup("ml");
      const left = box(0.07, y, 0.33, rowsH);
      const onL = b.card(left, { fill: tone.soft, group: lg, shadow: false });
      const emoji = pairs.leftEmoji?.[i] || emojiFor(pairs.left[i]);
      const iconW = emoji ? Math.min(0.06, (rowsH * 0.7 * d.slide.heightIn) / d.slide.widthIn) : 0;
      if (emoji) b.icon(emoji, box(left.x + 0.015, y + (rowsH - (iconW * d.slide.widthIn) / d.slide.heightIn) / 2, iconW, (iconW * d.slide.widthIn) / d.slide.heightIn), { group: lg });
      const textBox = inset(left, 0.015, 0.005);
      const shift = emoji ? iconW + 0.015 : 0;
      b.text("body", pairs.left[i], { ...textBox, x: textBox.x + shift, w: textBox.w - shift }, { on: onL, group: lg, bold: true, valign: "middle", max: d.sizes.body + 2, min: 15 });
      b.shape("ellipse", box(0.41, y + rowsH / 2 - 0.018, 0.018, 0.036), tone.strong, { decorative: true });
      const rg = b.newGroup("mr");
      const right = box(0.6, y, 0.33, rowsH);
      const onR = b.card(right, { group: rg, line: d.colors.tones[(i + 2) % d.colors.tones.length].strong, shadow: false });
      b.badge(LETTERS[i], box(0.555, y + rowsH / 2 - 0.035, 0.035, 0.07), d.colors.secondary, rg);
      b.text("body", pairs.right[i], inset(right, 0.015, 0.005), { on: onR, group: rg, valign: "middle", max: d.sizes.body, min: 14 });
    }
  },
};

export const MULTIPLE_CHOICE: LayoutDef = {
  id: "MULTIPLE_CHOICE",
  family: "activity-options",
  roles: PRACTICE,
  activities: ["multiple_choice"],
  image: "none",
  fit: (p) => countFit(firstOf(p, "options")?.options.length ?? 0, 2, 4, 4),
  build(ctx, b) {
    const d = ctx.design;
    const q = firstOf(ctx.plan, "question")?.text ?? ctx.plan.mainIdea;
    const opts = firstOf(ctx.plan, "options")!.options.slice(0, 4);
    b.pill(`${ROLE_EMOJI.quiz} ${ctx.plan.title}`, box(0.05, 0.07, 0.36, 0.07), { fill: d.colors.primary });
    const g = b.newGroup("q");
    const on = b.card(box(0.05, 0.17, 0.9, 0.22), { group: g });
    b.text("subtitle", q, box(0.08, 0.18, 0.84, 0.2), { on, group: g, bold: true, align: "center", valign: "middle", max: d.sizes.title - 2, min: 18 });
    const cells = grid(box(0.05, 0.45, 0.9, 0.47), opts.length, 2, 0.03, 0.04);
    opts.forEach((o, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const c = cells[i];
      const og = b.newGroup("opt");
      const onO = b.card(c, { fill: tone.soft, line: tone.strong, group: og, shadow: false });
      const s = Math.min(0.12, c.h * 0.6);
      b.badge(LETTERS[i], box(c.x + 0.02, c.y + (c.h - s) / 2, (s * d.slide.heightIn) / d.slide.widthIn, s), tone.strong, og);
      b.text("body", o, box(c.x + 0.1, c.y + 0.01, c.w - 0.12, c.h - 0.02), { on: onO, group: og, valign: "middle", bold: true, max: d.sizes.body + 2, min: 15 });
    });
  },
};

/** Variante en lista vertical, con el icono de la pregunta a un lado (para alternar con la rejilla). */
export const QUIZ_LIST: LayoutDef = {
  id: "QUIZ_LIST",
  family: "activity-list",
  roles: PRACTICE,
  activities: ["multiple_choice"],
  image: "optional",
  fit: (p) => countFit(firstOf(p, "options")?.options.length ?? 0, 2, 4, 4) * 0.95,
  build(ctx, b) {
    const d = ctx.design;
    const q = firstOf(ctx.plan, "question")?.text ?? ctx.plan.mainIdea;
    const opts = firstOf(ctx.plan, "options")!.options.slice(0, 4);
    b.text("label", ctx.plan.title, box(0.05, 0.07, 0.5, 0.06), { bold: true, color: d.colors.primary, max: 18 });
    b.text("title", q, box(0.05, 0.14, 0.9, 0.16), { bold: true, valign: "middle", max: d.sizes.title - 2, min: 22 });
    const side = box(0.05, 0.36, 0.3, 0.54);
    const g = b.newGroup("qs");
    b.card(side, { fill: d.colors.surfaceAlt, group: g, shadow: false });
    if (!b.visual(ctx.assets[0], inset(side, 0.03), { circle: d.colors.surface, group: g })) b.icon(ROLE_EMOJI.quiz, inset(side, 0.05), { group: g });
    const rowH = Math.min(0.12, 0.54 / opts.length - 0.02);
    opts.forEach((o, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const y = 0.36 + i * (rowH + 0.025);
      const og = b.newGroup("ql");
      const row = box(0.39, y, 0.56, rowH);
      const on = b.card(row, { fill: tone.soft, group: og, shadow: false });
      b.badge(LETTERS[i], box(0.405, y + rowH / 2 - 0.04, 0.045, 0.08), tone.strong, og);
      b.text("body", o, box(0.47, y, 0.46, rowH), { on, group: og, valign: "middle", bold: true, max: d.sizes.body + 2, min: 15 });
    });
  },
};

export const TRUE_FALSE: LayoutDef = {
  id: "TRUE_FALSE",
  family: "activity-rows",
  roles: PRACTICE,
  activities: ["true_false"],
  image: "none",
  fit: (p) => countFit(firstOf(p, "statements")?.items.length ?? 0, 2, 4, 3),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const list = firstOf(ctx.plan, "statements")!.items.slice(0, 4);
    const rowH = Math.min(0.15, 0.66 / list.length - 0.02);
    list.forEach((s, i) => {
      const y = 0.25 + i * (rowH + 0.025);
      const g = b.newGroup("tf");
      const row = box(0.05, y, 0.9, rowH);
      const on = b.card(row, { group: g });
      b.text("body", s.text, box(0.08, y, 0.6, rowH), { on, group: g, valign: "middle", max: d.sizes.body + 1, min: 15 });
      [ctx.labels.true, ctx.labels.false].forEach((lbl, j) => {
        const tone = j === 0 ? { strong: "15803D", soft: "DCFCE7" } : { strong: "B91C1C", soft: "FEE2E2" };
        b.pill(lbl, box(0.7 + j * 0.125, y + rowH * 0.2, 0.11, rowH * 0.6), { fill: tone.soft, color: tone.strong, group: g, max: 16 });
      });
    });
  },
};

export const FILL_BLANK: LayoutDef = {
  id: "FILL_BLANK",
  family: "activity-rows",
  roles: PRACTICE,
  activities: ["fill_blank"],
  image: "none",
  fit: (p) => countFit(blocksOf(p, "blank").length, 1, 4, 3),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const blanks = blocksOf(ctx.plan, "blank").slice(0, 4);
    const answers = blanks.map((x) => x.answer).filter((a): a is string => Boolean(a));
    // Pocas frases: filas más altas y centradas en el espacio disponible
    const rowH = Math.min(blanks.length <= 2 ? 0.2 : 0.14, 0.5 / blanks.length - 0.02);
    const top = 0.25 + Math.max(0, (0.5 - blanks.length * (rowH + 0.03)) / 2);
    blanks.forEach((bl, i) => {
      const y = top + i * (rowH + 0.03);
      const g = b.newGroup("fb");
      const row = box(0.05, y, 0.9, rowH);
      const on = b.card(row, { group: g });
      b.badge(String(i + 1), box(0.07, y + rowH / 2 - 0.04, 0.045, 0.08), d.colors.tones[i % d.colors.tones.length].strong, g);
      const parts = bl.sentence.split(/_{3,}/);
      b.text("body", bl.sentence.replace(/_{3,}/g, "________"), box(0.13, y, 0.8, rowH), {
        on, group: g, valign: "middle", max: d.sizes.body + 4, min: 16,
        runs: parts.flatMap((p, k) => (k < parts.length - 1 ? [{ text: p }, { text: " ________ ", bold: true, color: d.colors.primary }] : [{ text: p }])),
      });
    });
    if (new Set(answers.map((a) => a.toLocaleLowerCase("es"))).size >= 2) {
      // Banco de palabras desordenado
      const bank = [...new Map(answers.map((a) => [a.toLocaleLowerCase("es"), a])).values()].sort((a, z) => a.localeCompare(z));
      const cells = columns(box(0.2, 0.84, 0.6, 0.07), bank.length, 0.02);
      bank.forEach((w, i) => b.pill(w, cells[i], { fill: d.colors.tones[(i + 1) % d.colors.tones.length].soft, color: d.colors.text, max: 18 }));
    }
  },
};

export const SPEAKING: LayoutDef = {
  id: "SPEAKING",
  family: "statement",
  roles: ["production", "practice", "reflection", "hook"],
  activities: ["speaking"],
  image: "optional",
  fit: (p) => (firstOf(p, "question") ? 1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    const q = firstOf(ctx.plan, "question")!.text;
    const prompt = blocksOf(ctx.plan, "text")[0]?.text;
    b.pill(`💬 ${ctx.plan.title}`, box(0.05, 0.08, 0.42, 0.08), { fill: d.colors.primary, max: d.sizes.subtitle - 2 });
    const w = ctx.mascot ? 0.62 : 0.9;
    const bubble = box(0.05, 0.24, w, 0.46);
    const g = b.newGroup("sp");
    const on = b.card(bubble, { group: g, radius: d.radius.large });
    b.shape("triangle", box(0.14, 0.69, 0.05, 0.06), d.colors.surface, { group: g, transparency: d.surfaceTransparency });
    b.text("subtitle", q, inset(bubble, 0.04, 0.04), { on, group: g, bold: true, align: "center", valign: "middle", max: d.sizes.title, min: 20 });
    if (prompt) b.text("body", prompt, box(0.22, 0.76, w - 0.17, 0.1), { color: d.colors.mutedText, valign: "middle", max: d.sizes.body });
    if (ctx.mascot) b.image(ctx.mascot, box(0.71, 0.16, 0.26, 0.84), { fit: "contain", decorative: true });
    else b.icon("🗣️", box(0.05, 0.74, 0.08, 0.14));
  },
};

export const CLASSIFY: LayoutDef = {
  id: "CLASSIFY",
  family: "activity-columns",
  roles: PRACTICE,
  activities: ["classify"],
  image: "none",
  fit: (p) => countFit(firstOf(p, "columns")?.columns.length ?? 0, 2, 3, 2) * (firstOf(p, "bullets") ? 1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const words = firstOf(ctx.plan, "bullets")!.items.slice(0, 9);
    const cols = firstOf(ctx.plan, "columns")!.columns;
    const chips = grid(box(0.05, 0.22, 0.9, 0.14), words.length, Math.min(words.length, 5), 0.015, 0.02);
    words.forEach((w, i) => b.pill(w, chips[i], { fill: d.colors.surface, color: d.colors.text, max: d.sizes.body }));
    const cells = columns(box(0.05, 0.42, 0.9, 0.5), cols.length, 0.03);
    cols.forEach((c, i) => {
      const tone = d.colors.tones[i % d.colors.tones.length];
      const g = b.newGroup("cls");
      b.shape("roundRect", cells[i], tone.soft, { radius: d.radius.medium, line: { color: tone.strong, width: 2, dash: "dash" }, group: g });
      b.text("subtitle", c.heading, box(cells[i].x, cells[i].y + 0.02, cells[i].w, 0.1), { on: tone.soft, group: g, bold: true, align: "center", color: tone.strong });
    });
  },
};

/** Consigna de práctica genérica (ejercicio de la lección). */
export const PRACTICE_PROMPT: LayoutDef = {
  id: "PRACTICE_PROMPT",
  family: "statement",
  roles: ["practice", "production", "reflection", "assessment"],
  image: "optional",
  fit: (p) => (firstOf(p, "question") || firstOf(p, "text") ? 0.75 : 0),
  build(ctx, b) {
    const d = ctx.design;
    b.title(ctx.plan.title);
    const text = firstOf(ctx.plan, "question")?.text ?? firstOf(ctx.plan, "text")!.text;
    const g = b.newGroup("pp");
    const card = box(0.05, 0.26, 0.9, 0.56);
    const on = b.card(card, { group: g });
    b.icon(ROLE_EMOJI[ctx.plan.pedagogicalRole] ?? "✏️", box(0.08, 0.3, 0.09, 0.16), { circle: d.colors.surfaceAlt, group: g });
    b.text("subtitle", text, box(0.2, 0.28, 0.72, 0.5), { on, group: g, valign: "middle", max: d.sizes.subtitle + 2, min: 18 });
  },
};

export const EXIT_TICKET: LayoutDef = {
  id: "EXIT_TICKET",
  family: "ticket",
  roles: ["exit_ticket", "reflection"],
  image: "none",
  fit: (p) => (firstOf(p, "question") ? 1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    const q = firstOf(ctx.plan, "question")!.text;
    const scale = firstOf(ctx.plan, "bullets")?.items ?? [];
    const ticket = box(0.12, 0.1, ctx.mascot ? 0.6 : 0.76, 0.8);
    const g = b.newGroup("tk");
    const on = b.card(ticket, { group: g, line: d.colors.primary });
    b.shape("rect", box(ticket.x, ticket.y, ticket.w, 0.11), d.colors.primary, { group: g });
    b.text("subtitle", `🎟️ ${ctx.plan.title}`, box(ticket.x + 0.03, ticket.y, ticket.w - 0.06, 0.11), { on: d.colors.primary, color: d.colors.onPrimary, bold: true, valign: "middle", group: g });
    b.text("subtitle", q, box(ticket.x + 0.04, ticket.y + 0.15, ticket.w - 0.08, 0.2), { on, group: g, bold: true, valign: "middle" });
    for (let i = 0; i < 3; i++) b.line({ x: ticket.x + 0.05, y: ticket.y + 0.42 + i * 0.075 }, { x: ticket.x + ticket.w - 0.05, y: ticket.y + 0.42 + i * 0.075 }, d.colors.mutedText, 1);
    if (scale.length) {
      const cells = columns(box(ticket.x + 0.03, ticket.y + 0.64, ticket.w - 0.06, 0.1), scale.length, 0.015);
      scale.forEach((s, i) => b.pill(s, cells[i], { fill: d.colors.tones[i % d.colors.tones.length].soft, color: d.colors.text, bold: false, group: g, max: 16 }));
    }
    if (ctx.mascot) b.image(ctx.mascot, box(0.74, 0.2, 0.24, 0.8), { fit: "contain", decorative: true });
  },
};

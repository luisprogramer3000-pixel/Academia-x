import type { LayoutDef } from "../types";
import { firstOf, mainImage } from "../types";
import { box, inset } from "../geometry";

/**
 * Lectura de comprensión: el texto en una tarjeta grande y legible (letra de
 * cuerpo, interlineado amplio) y, al lado, las tareas de lectura y la imagen.
 * Es la única diapositiva donde se permiten párrafos: es material de lectura.
 */
export const READING_PASSAGE: LayoutDef = {
  id: "READING_PASSAGE",
  family: "reading",
  roles: ["reading"],
  image: "optional",
  fit: (p) => (firstOf(p, "passage") ? 1 : 0),
  build(ctx, b) {
    const d = ctx.design;
    const passage = firstOf(ctx.plan, "passage")!;
    const tasks = firstOf(ctx.plan, "bullets")?.items ?? [];
    const img = mainImage(ctx);
    const side = tasks.length || img?.image;
    b.pill(`📖 ${ctx.labels.reading}`, box(0.05, 0.075, 0.16, 0.065), { fill: d.colors.primary });
    b.text("title", ctx.plan.title, box(0.23, 0.06, 0.72, 0.095), { bold: true, valign: "middle", max: d.sizes.title - 6, min: 20 });
    const textW = side ? 0.6 : 0.9;
    const g = b.newGroup("read");
    const card = box(0.05, 0.17, textW, 0.76);
    const on = b.card(card, { group: g });
    b.text("body", passage.paragraphs.join("\n\n"), inset(card, 0.025, 0.03), {
      on, group: g, max: d.sizes.body, min: 15, lineSpacing: 1.3, color: d.colors.text,
    });
    if (!side) return;
    let y = 0.17;
    if (img?.image) {
      b.image(img.image, box(0.68, y, 0.27, 0.3), { fit: "cover", rounding: true, relevance: img.relevance });
      y += 0.33;
    }
    if (tasks.length) {
      const tg = b.newGroup("tasks");
      const tbox = box(0.68, y, 0.27, 0.93 - y);
      const ton = b.card(tbox, { group: tg, fill: d.colors.surfaceAlt, shadow: false });
      b.text("label", `✏️ ${ctx.labels.tasks}`, box(tbox.x + 0.015, tbox.y + 0.015, tbox.w - 0.03, 0.06), { on: ton, group: tg, bold: true, color: d.colors.primary, max: 18 });
      b.text("body", tasks.map((t, i) => `${i + 1}. ${t}`).join("\n"), box(tbox.x + 0.015, tbox.y + 0.09, tbox.w - 0.03, tbox.h - 0.11), {
        on: ton, group: tg, max: d.sizes.body - 2, min: 14,
      });
    }
  },
};

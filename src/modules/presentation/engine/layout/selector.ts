import type { ResolvedDesignSystem, SlidePlan } from "../types";
import type { LayoutContext, LayoutDef } from "./types";
import { LAYOUTS } from "./registry";
import { SlideBuilder } from "./components";

/**
 * Selector de layouts por puntuación (nunca al azar puro):
 *
 *   score = semántica·4 + tamaño·3 + visual·2 + tono·2 + estilo del modelo·2 + variedad·2
 *         − repetición·4 − riesgo de desbordamiento·5
 *
 * Regla dura: el mismo layout no puede aparecer más de 2 veces seguidas.
 * Entre candidatos casi empatados se elige con variación controlada (semilla).
 */

export interface SelectionHistory {
  layouts: string[];
  families: string[];
}

export interface ScoredLayout {
  layout: LayoutDef;
  score: number;
  parts: Record<string, number>;
}

const MASCOT_FRIENDLY = new Set(["COVER_HERO", "COVER_MINIMAL", "HOOK_QUESTION", "SPEAKING", "SUMMARY_CHECKLIST", "EXIT_TICKET"]);

function semantic(layout: LayoutDef, plan: SlidePlan): number {
  if (!layout.roles.includes(plan.pedagogicalRole)) return 0;
  if (layout.activities && !(plan.activity && layout.activities.includes(plan.activity))) return 0;
  // Actividades con layout propio no deben caer en uno genérico si existe el específico
  if (plan.activity && !layout.activities && ["matching", "multiple_choice", "true_false", "fill_blank", "classify"].includes(plan.activity)) return 0.2;
  const primary = layout.roles[0] === plan.pedagogicalRole ? 1 : 0.8;
  return Math.min(1.5, primary + (plan.preferredLayouts.includes(layout.id) ? 0.5 : 0));
}

function visual(layout: LayoutDef, hasImage: boolean, hasEmoji: boolean): number | null {
  switch (layout.image) {
    case "required": return hasImage ? 1 : null;
    case "preferred": return hasImage ? 1 : hasEmoji ? 0.55 : 0.35;
    case "optional": return hasImage ? 0.75 : 0.65;
    default: return hasImage ? 0.35 : 0.6;
  }
}

export function scoreLayouts(
  plan: SlidePlan,
  design: ResolvedDesignSystem,
  history: SelectionHistory,
  assets: { hasImage: boolean; hasEmoji: boolean; hasMascot: boolean }
): ScoredLayout[] {
  const out: ScoredLayout[] = [];
  const last = history.layouts[history.layouts.length - 1];
  const twoInARow = history.layouts.length >= 2 && history.layouts[history.layouts.length - 2] === last;
  const recentFamilies = history.families.slice(-3);
  const kids = design.tone === "kids";
  const adult = ["corporate", "professional", "academic"].includes(design.tone);

  for (const layout of LAYOUTS) {
    if (layout.id === "COVER_TEMPLATE" && !design.coverImages.length) continue;
    const sem = semantic(layout, plan);
    if (sem === 0) continue;
    const size = layout.fit(plan);
    if (size <= 0) continue;
    const vis = visual(layout, assets.hasImage, assets.hasEmoji);
    if (vis === null) continue;
    if (layout.id === last && twoInARow) continue;

    const tone = kids ? layout.toneBias?.kids ?? 0 : adult ? layout.toneBias?.adult ?? 0 : 0;
    const template = design.mode === "ADAPT_TEMPLATE" && layout.id === "COVER_TEMPLATE" ? 1.5
      : assets.hasMascot && MASCOT_FRIENDLY.has(layout.id) ? 0.6 * design.fidelity
      : 0;
    const famUses = recentFamilies.filter((f) => f === layout.family).length;
    const diversity = famUses === 0 ? 1 : famUses === 1 ? 0.4 : 0;
    const repetition = layout.id === last ? 1 : history.families[history.families.length - 1] === layout.family ? 0.5 : 0;

    // El layout universal solo se usa cuando ningún layout específico encaja
    const lastResort = layout.family === "flex" ? -6 : 0;
    const parts = { semantic: sem * 4, size: size * 3, visual: vis * 2, tone: tone * 2, template: template * 2, diversity: diversity * 2, repetition: -repetition * 4, lastResort };
    out.push({ layout, score: Object.values(parts).reduce((a, b) => a + b, 0), parts });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Riesgo de desbordamiento: construcción en seco y proporción de textos que no caben. */
export function overflowRisk(layout: LayoutDef, ctx: LayoutContext): number {
  try {
    const b = new SlideBuilder(ctx.design, ctx.plan.pedagogicalRole === "cover");
    layout.build(ctx, b);
    const texts = b.elements.filter((e) => e.kind === "text" && e.role !== "icon");
    if (!texts.length) return 0;
    return texts.filter((e) => e.kind === "text" && e.overflow).length / texts.length;
  } catch {
    return 1;
  }
}

/**
 * Ordena los candidatos con el riesgo de desbordamiento ya descontado y
 * aplica la variación controlada entre los casi empatados.
 */
export function rankCandidates(scored: ScoredLayout[], ctxFor: (layout: LayoutDef) => LayoutContext, rnd: () => number, top = 5): ScoredLayout[] {
  const withRisk = scored.slice(0, top).map((s) => {
    const risk = overflowRisk(s.layout, ctxFor(s.layout));
    return { ...s, score: s.score - risk * 5, parts: { ...s.parts, overflow: -risk * 5 } };
  });
  withRisk.sort((a, b) => b.score - a.score);
  if (withRisk.length >= 2 && withRisk[0].score - withRisk[1].score < 0.6 && rnd() < 0.4) {
    [withRisk[0], withRisk[1]] = [withRisk[1], withRisk[0]];
  }
  return withRisk;
}

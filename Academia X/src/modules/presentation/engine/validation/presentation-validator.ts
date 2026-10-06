import type { LessonContent, PedagogicalRole, PresentationPlan, PresentationQuality, ResolvedSlide } from "../types";
import { coveredIds } from "../planner/finalize";
import { similarity } from "../text";

/**
 * Calidad de la presentación completa: cobertura de contenido, progresión
 * pedagógica, variedad de layouts, legibilidad, consistencia, relevancia
 * visual e integridad técnica. Objetivo ≥ 85.
 */

const PHASE: Record<PedagogicalRole, number> = {
  cover: 0, hook: 1, objectives: 2, explanation: 3, vocabulary: 4, concept: 4, comparison: 4, grammar: 4, example: 4, process: 4, dialogue: 4,
  mind_map: 5, reading: 5.5, practice: 6, production: 6, reflection: 6, quiz: 7, assessment: 7, summary: 8, exit_ticket: 9,
};

export function maxConsecutive(ids: string[]): number {
  let best = 0;
  let run = 0;
  ids.forEach((id, i) => {
    run = i > 0 && ids[i - 1] === id ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

export function evaluatePresentation(plan: PresentationPlan, slides: ResolvedSlide[], content?: LessonContent): PresentationQuality {
  const covered = coveredIds(plan, content);
  const essential = plan.essentialIds;
  const missingIds = essential.filter((id) => !covered.has(id));
  const contentCoverage = essential.length ? 1 - missingIds.length / essential.length : 1;

  // Progresión: proporción de pasos que no retroceden de fase
  let ordered = 0;
  for (let i = 1; i < slides.length; i++) if (PHASE[slides[i].plan.pedagogicalRole] >= PHASE[slides[i - 1].plan.pedagogicalRole]) ordered++;
  const roles = new Set(slides.map((s) => s.plan.pedagogicalRole));
  const hasArc = ["cover", "summary"].every((r) => roles.has(r as PedagogicalRole)) && [...roles].some((r) => PHASE[r] === 6 || PHASE[r] === 7);
  const pedagogicalProgression = (slides.length > 1 ? ordered / (slides.length - 1) : 1) * (hasArc ? 1 : 0.8);

  const layouts = slides.map((s) => s.layoutId);
  const unique = new Set(layouts).size;
  const consecutive = maxConsecutive(layouts);
  const layoutDiversity = Math.min(1, unique / Math.min(slides.length, 10)) * (consecutive > 2 ? 0.6 : 1);

  const scores = slides.map((s) => s.quality?.score ?? 0);
  const readability = slides.length ? slides.reduce((a, s) => a + (s.quality?.readability ?? 0) * 0.6 + (s.quality?.contrast ?? 0) * 0.4, 0) / slides.length : 0;

  const fonts = new Set(slides.flatMap((s) => s.elements.filter((e) => e.kind === "text" && e.role !== "icon").map((e) => (e.kind === "text" ? e.font : ""))));
  const visualConsistency = Math.max(0, 1 - Math.max(0, fonts.size - 2) * 0.2);

  const visualRelevance = slides.length ? slides.reduce((a, s) => a + (s.quality?.imageRelevance ?? 0), 0) / slides.length : 0;
  const errors = slides.reduce((a, s) => a + (s.quality?.issues.filter((i) => /OVERFLOW|CANVAS|EMPTY|OVERLAP|DISTORT/.test(i)).length ?? 0), 0);
  const technicalIntegrity = Math.max(0, 1 - errors * 0.08);

  // Duplicados que hayan sobrevivido (texto muy parecido entre diapositivas no protegidas)
  const texts = slides.map((s) => s.elements.filter((e) => e.kind === "text").map((e) => (e.kind === "text" ? e.text : "")).join(" "));
  let dupes = 0;
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) if (similarity(texts[i], texts[j]) > 0.85) dupes++;

  const finalScore = Math.round(
    contentCoverage * 22 + pedagogicalProgression * 14 + layoutDiversity * 14 + readability * 14 + visualConsistency * 8 + visualRelevance * 10 + technicalIntegrity * 10
      + (scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length / 100) * 8 : 0) - dupes * 2
  );

  return {
    contentCoverage: Math.round(contentCoverage * 100),
    pedagogicalProgression: Math.round(pedagogicalProgression * 100),
    layoutDiversity: Math.round(layoutDiversity * 100),
    readability: Math.round(readability * 100),
    visualConsistency: Math.round(visualConsistency * 100),
    visualRelevance: Math.round(visualRelevance * 100),
    technicalIntegrity: Math.round(technicalIntegrity * 100),
    finalScore: Math.max(0, Math.min(100, finalScore)),
    missingIds,
  };
}

import type { LessonContent, PedagogicalRole, PresentationPlan, SlideContentBlock, SlidePlan } from "../types";
import { labels } from "../i18n";
import { applyChallenge } from "./challenge";
import { condense, mentions, seededRandom, similarity } from "../text";

/**
 * Reglas comunes a cualquier planificador (heurístico o IA):
 *  - número de diapositivas según la complejidad (o el pedido por el profesor);
 *  - progresión pedagógica (activación → presentación → práctica → evaluación → cierre);
 *  - sin diapositivas casi idénticas;
 *  - cobertura: ningún concepto esencial desaparece.
 */

export const MIN_SLIDES = 6;
export const MAX_SLIDES = 30;

const PHASE: Record<PedagogicalRole, number> = {
  cover: 0, hook: 1, objectives: 2, explanation: 3,
  vocabulary: 4, concept: 4, comparison: 4, grammar: 4, example: 4, process: 4, dialogue: 4,
  mind_map: 5, reading: 5.5, practice: 6, production: 6, reflection: 6, quiz: 7, assessment: 7, summary: 8, exit_ticket: 9,
};

const PROTECTED: PedagogicalRole[] = ["cover", "objectives", "reading", "summary", "exit_ticket"];

/** Rango recomendado según la complejidad del contenido y la duración. */
export function recommendedRange(content: LessonContent | undefined): { min: number; max: number } {
  if (!content) return { min: 10, max: 16 };
  const complexity =
    content.concepts.length * 1.2 + content.vocabulary.length * 0.5 + content.categories.length +
    content.quizzes.length * 0.8 + content.exercises.length * 0.8 + content.grammar.length * 1.5 + content.dialogues.length;
  let range = complexity <= 5 ? { min: 8, max: 10 } : complexity <= 12 ? { min: 11, max: 16 } : complexity <= 20 ? { min: 16, max: 24 } : { min: 20, max: 30 };
  if (content.durationMinutes && content.durationMinutes <= 30) range = { min: Math.min(range.min, 8), max: Math.min(range.max, 12) };
  if (content.durationMinutes && content.durationMinutes >= 90) range = { min: range.min, max: Math.min(MAX_SLIDES, range.max + 3) };
  return range;
}

function slideText(s: SlidePlan): string {
  const blocks = s.contentBlocks.map((b) => {
    switch (b.kind) {
      case "bullets": return b.items.join(" ");
      case "item": return `${b.term} ${b.detail ?? ""}`;
      case "options": return b.options.join(" ");
      case "pairs": return `${b.left.join(" ")} ${b.right.join(" ")}`;
      case "columns": return b.columns.map((c) => `${c.heading} ${c.items.join(" ")}`).join(" ");
      case "steps": return b.steps.map((x) => `${x.heading} ${x.text ?? ""}`).join(" ");
      case "tree": return `${b.center} ${b.branches.map((x) => `${x.label} ${x.children.join(" ")}`).join(" ")}`;
      case "formula": return `${b.parts.join(" ")} ${b.examples.join(" ")}`;
      case "dialogue": return b.lines.map((l) => l.text).join(" ");
      case "blank": return b.sentence;
      case "statements": return b.items.map((x) => x.text).join(" ");
      case "table": return [...b.headers, ...b.rows.flat()].join(" ");
      case "note": return b.text;
      case "passage": return b.paragraphs.join(" ");
      default: return "text" in b ? b.text : "";
    }
  });
  return [s.title, s.mainIdea, ...blocks].join(" ");
}

/** IDs cubiertos: los declarados + los términos que aparecen en el texto visible. */
export function coveredIds(plan: PresentationPlan, content?: LessonContent): Set<string> {
  const ids = new Set(plan.slides.flatMap((s) => s.covers));
  if (!content) return ids;
  const all = plan.slides.map(slideText).join(" \n ");
  for (const c of content.concepts) if (mentions(all, c.term)) ids.add(c.id);
  for (const v of content.vocabulary) if (mentions(all, v.term)) ids.add(v.id);
  for (const c of content.categories) if (mentions(all, c.label)) ids.add(c.id);
  return ids;
}

/** Junta diapositivas de concepto consecutivas en tarjetas de 3 (reduce sin perder contenido). */
function mergeConcepts(slides: SlidePlan[], needed: number): SlidePlan[] {
  // Solo se agrupan conceptos que son palabras de vocabulario (ya vistas en la rejilla);
  // los conceptos explicativos ("Transporte público") conservan su diapositiva
  const mergeable = (s: SlidePlan) =>
    s.pedagogicalRole === "concept" && !s.preferredLayouts.includes("THREE_CARDS") && s.covers.some((id) => id.startsWith("VOCAB_"));
  const out: SlidePlan[] = [];
  let saved = 0;
  let i = 0;
  while (i < slides.length) {
    const run: SlidePlan[] = [];
    let j = i;
    while (j < slides.length && run.length < 3 && mergeable(slides[j])) run.push(slides[j++]);
    if (run.length >= 2 && saved < needed) {
      out.push({
        ...run[0],
        id: `${run[0].id}_m`,
        title: run.map((r) => r.title).join(" · "),
        mainIdea: "",
        contentBlocks: run.map((r) => ({
          kind: "item",
          term: r.title,
          detail: condense(r.mainIdea, 9),
          emoji: r.visualAssetRequests[0]?.emoji,
          imageUrl: r.visualAssetRequests[0]?.preferredUrl,
        }) as SlideContentBlock),
        preferredLayouts: ["THREE_CARDS"],
        visualAssetRequests: run.flatMap((r) => r.visualAssetRequests.slice(0, 1)),
        speakerNotes: run.flatMap((r) => [`${r.title}:`, ...r.speakerNotes]),
        covers: run.flatMap((r) => r.covers),
        importance: Math.max(...run.map((r) => r.importance)),
      });
      saved += run.length - 1;
      i = j;
    } else {
      out.push(slides[i]);
      i++;
    }
  }
  return out;
}

/** Diapositivas extra con valor pedagógico para llegar al número pedido. */
function expansions(content: LessonContent, existing: SlidePlan[]): SlidePlan[] {
  const L = labels(content.language);
  const extra: SlidePlan[] = [];
  const base = { order: 0, speakerNotes: [] as string[], preferredLayouts: [] as string[], visualAssetRequests: [], covers: [] as string[] };
  // Ejemplo visual por concepto (con su imagen)
  for (const c of content.concepts.filter((x) => x.example)) {
    if (existing.some((s) => s.pedagogicalRole === "example" && s.title === c.term)) continue;
    extra.push({
      ...base,
      id: `x_example_${c.id}`,
      pedagogicalRole: "example",
      title: c.term,
      mainIdea: c.example!,
      contentBlocks: [{ kind: "example", text: condense(c.example!, 18) }],
      visualIntent: "Ejemplo grande con su imagen",
      visualAssetRequests: [{ type: "illustration", semanticQuery: c.term, purpose: "example", importance: 0.7, preferredUrl: c.imageUrl, emoji: c.emoji }],
      speakerNotes: [c.example!],
      covers: [c.id],
      importance: 2,
    });
  }
  // Pregunta de opción múltiple generada desde el vocabulario
  const withMeaning = content.vocabulary.filter((v) => v.meaning);
  if (withMeaning.length >= 4 && !existing.some((s) => s.id === "x_quiz_vocab")) {
    const rnd = seededRandom(content.title);
    const target = withMeaning[Math.floor(rnd() * withMeaning.length)];
    const options = [target, ...withMeaning.filter((v) => v !== target).slice(0, 3)].sort(() => rnd() - 0.5);
    extra.push({
      ...base,
      id: "x_quiz_vocab",
      pedagogicalRole: "quiz",
      activity: "multiple_choice",
      title: L.quiz,
      mainIdea: condense(target.meaning!, 14),
      contentBlocks: [
        { kind: "question", text: `${condense(target.meaning!, 14)}` },
        { kind: "options", options: options.map((o) => o.term), correctIndex: options.indexOf(target) },
      ],
      visualIntent: "Adivina la palabra a partir de su definición",
      speakerNotes: [`✓ ${target.term}`],
      covers: ["ACTIVITY_QUIZ_VOCAB"],
      importance: 2,
    });
  }
  return extra;
}

export function finalizePlan(plan: PresentationPlan, content: LessonContent | undefined, opts: { targetSlides?: number }): PresentationPlan {
  let slides = plan.slides.filter((s) => s.title || s.mainIdea || s.contentBlocks.length);
  // Antes de proyectar: el reto completo (o nada) y ninguna actividad sin su material
  if (content) slides = applyChallenge(slides, content);

  // 1. Progresión: orden estable por fase pedagógica
  slides = slides.map((s, i) => ({ s, i })).sort((a, b) => PHASE[a.s.pedagogicalRole] - PHASE[b.s.pedagogicalRole] || a.i - b.i).map((x) => x.s);

  // 2. Sin duplicados: misma fase y texto casi igual → se queda la más importante
  const kept: SlidePlan[] = [];
  for (const s of slides) {
    const twin = kept.find((k) => k.pedagogicalRole === s.pedagogicalRole && !PROTECTED.includes(s.pedagogicalRole) && similarity(slideText(k), slideText(s)) > 0.8);
    if (!twin) kept.push(s);
    else if (s.importance > twin.importance) kept.splice(kept.indexOf(twin), 1, s);
  }
  slides = kept;

  // 3. Número de diapositivas
  const range = recommendedRange(content);
  const target = opts.targetSlides ? Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, opts.targetSlides)) : undefined;
  const max = target ?? range.max;
  const min = target ?? range.min;

  if (slides.length > max) slides = mergeConcepts(slides, slides.length - max);
  while (slides.length > max) {
    const counts = new Map<string, number>();
    for (const s of slides) for (const id of s.covers) counts.set(id, (counts.get(id) ?? 0) + 1);
    // Primero lo prescindible que no deja conceptos sin cubrir
    const candidates = slides
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !PROTECTED.includes(s.pedagogicalRole))
      .sort((a, b) => a.s.importance - b.s.importance || b.i - a.i);
    const safe = candidates.find(({ s }) => s.covers.every((id) => (counts.get(id) ?? 0) > 1 || !plan.essentialIds.includes(id)));
    const victim = safe ?? candidates[0];
    if (!victim) break;
    slides.splice(victim.i, 1);
  }
  if (slides.length < min && content) {
    for (const x of expansions(content, slides)) {
      if (slides.length >= min) break;
      slides.push(x);
    }
    slides = slides.map((s, i) => ({ s, i })).sort((a, b) => PHASE[a.s.pedagogicalRole] - PHASE[b.s.pedagogicalRole] || a.i - b.i).map((x) => x.s);
  }

  // 4. Cobertura: conceptos esenciales que no aparecen → diapositiva de concepto antes de la práctica
  const result: PresentationPlan = { ...plan, slides };
  if (content) {
    const covered = coveredIds(result, content);
    const missing = content.concepts.filter((c) => !covered.has(c.id));
    if (missing.length) {
      const at = slides.findIndex((s) => PHASE[s.pedagogicalRole] >= 5);
      const add: SlidePlan[] = [];
      for (let i = 0; i < missing.length; i += 3) {
        const group = missing.slice(i, i + 3);
        add.push({
          id: `cov_${group[0].id}`,
          order: 0,
          pedagogicalRole: "concept",
          title: group.map((c) => c.term).join(" · "),
          mainIdea: "",
          contentBlocks: group.map((c) => ({ kind: "item", term: c.term, detail: condense(c.definition, 9), emoji: c.emoji, imageUrl: c.imageUrl, refId: c.id }) as SlideContentBlock),
          visualIntent: "Tarjetas de concepto",
          preferredLayouts: group.length > 1 ? ["THREE_CARDS"] : [],
          visualAssetRequests: group.map((c) => ({ type: "illustration", semanticQuery: c.term, purpose: "concept", importance: 0.6, preferredUrl: c.imageUrl, emoji: c.emoji })),
          speakerNotes: group.map((c) => `${c.term}: ${c.definition}`),
          covers: group.map((c) => c.id),
          importance: 3,
        });
      }
      slides.splice(at < 0 ? slides.length - 2 : at, 0, ...add);
    }
  }

  slides.forEach((s, i) => (s.order = i + 1));
  return { ...result, slides };
}


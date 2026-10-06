import type { DesignMode, LessonContent, PresentationPlan, SlideContentBlock, SlidePlan, VisualAssetRequest } from "../types";
import { emojiFor, splitLeadingEmoji } from "../icons";
import { capitalize, condense, keyPoints, mentions, normalize, semanticId, similarity, splitObjectives } from "../text";
import { PresentationPlanningError } from "../errors";
import { BlockSchema, LlmSlideSchema, PresentationPlanSchema, type LlmPresentationPlan } from "./schema";
import { buildCorrectionPrompt, buildPlannerSystemPrompt, buildPlannerUserPrompt, buildRevisionPrompt, proChecklist } from "./prompt";
import { finalizePlan, recommendedRange } from "./finalize";
import { readingSlides } from "./heuristic";
import { completeActivity } from "./activities";
import { isRealClassification } from "./extract";
import { labels } from "../i18n";
import type { TextDensity } from "./heuristic";

/**
 * Planificador con IA: UNA llamada (más una de corrección si el JSON no
 * valida). El JSON se valida con Zod y se convierte al plan interno; las
 * imágenes de la lección se enlazan por los IDs que la IA declara cubrir.
 */

export interface JsonCall {
  system: string;
  user: string;
  /** Mensajes previos para el reintento correctivo */
  history?: Array<{ role: "assistant" | "user"; content: string }>;
}

export type JsonCaller = (call: JsonCall) => Promise<{ raw: unknown; text: string }>;

export interface LlmPlannerOptions {
  density: TextDensity;
  targetSlides?: number;
  designMode: DesignMode;
  templateId?: string;
}

function issuesOf(error: unknown): string[] {
  const zodIssues = (error as { issues?: Array<{ path: Array<string | number>; message: string }> })?.issues;
  return zodIssues?.map((i) => `${i.path.join(".")}: ${i.message}`) ?? [String(error)];
}

/** Nombres que los modelos usan a menudo para los mismos tipos de bloque o de diapositiva. */
const KIND_ALIASES: Record<string, string> = {
  heading: "text", paragraph: "text", subtitle: "text", definition: "text", note: "text",
  list: "bullets", bullet: "bullets", points: "bullets",
  quote: "example", sentence: "example",
  reading: "passage", story: "passage", article: "passage",
  rule: "note", tip: "note", callout: "note", conjugation: "table", grid: "table", matrix: "table",
  vocab: "item", word: "item", card: "item", term: "item",
  choice: "options", choices: "options", answers: "options",
  match: "pairs", matching: "pairs",
  comparison: "columns", compare: "columns", table: "columns",
  mindmap: "tree", mind_map: "tree", map: "tree",
  process: "steps", timeline: "steps",
  fill_blank: "blank", gap: "blank", cloze: "blank",
  true_false: "statements", truefalse: "statements",
};
const ROLE_ALIASES: Record<string, string> = {
  intro: "hook", warmup: "hook", warm_up: "hook", activation: "hook", title: "cover",
  goals: "objectives", objective: "objectives", vocabulary_grid: "vocabulary", definition: "concept",
  activity: "practice", exercise: "practice", speaking: "production", game: "practice",
  closing: "summary", conclusion: "summary", recap: "summary", review: "summary", exit: "exit_ticket",
  lectura: "reading", reading_comprehension: "reading", comprehension: "reading",
  mindmap: "mind_map", map: "mind_map", compare: "comparison", presentation: "concept", content: "concept", theory: "explanation",
};

const KINDS = new Set(["text", "bullets", "item", "example", "question", "options", "pairs", "columns", "steps", "tree", "formula", "dialogue", "blank", "statements", "passage", "table", "note"]);
/** Campo principal de cada tipo cuando el modelo da solo un texto o una lista */
const MAIN_FIELD: Record<string, string> = {
  text: "text", example: "text", question: "text", item: "term", blank: "sentence",
  bullets: "items", options: "options", steps: "steps", columns: "columns", dialogue: "lines", statements: "items", passage: "paragraphs", note: "text",
};

/**
 * Forma abreviada que usan a veces los modelos: {"question": "…"} o
 * {"question": {"text": "…"}} en lugar de {"kind": "question", "text": "…"}.
 */
function shorthandBlock(b: Record<string, unknown>): Record<string, unknown> {
  if (typeof b.kind === "string") {
    const out = { ...b };
    const kind = KINDS.has(out.kind as string) ? (out.kind as string) : KIND_ALIASES[(out.kind as string).toLowerCase()] ?? (out.kind as string);
    const main = MAIN_FIELD[kind];
    // {"kind":"question","question":"…"} → {"kind":"question","text":"…"}
    if (main && out[main] === undefined && out[kind] !== undefined) {
      out[main] = out[kind];
      delete out[kind];
    }
    // Tarjetas: "definition"/"description"/"meaning" hacen de detalle
    if (kind === "item" && out.detail === undefined) {
      const detail = out.definition ?? out.description ?? out.meaning;
      if (typeof detail === "string") out.detail = detail.slice(0, 140);
    }
    if (kind === "bullets" && typeof out.items === "string") out.items = [out.items];
    return out;
  }
  const key = Object.keys(b).find((k) => KINDS.has(k) || KIND_ALIASES[k.toLowerCase()]);
  if (!key) return { ...b };
  const kind = KINDS.has(key) ? key : KIND_ALIASES[key.toLowerCase()];
  const value = b[key];
  const rest = Object.fromEntries(Object.entries(b).filter(([k]) => k !== key));
  if (value && typeof value === "object" && !Array.isArray(value)) return { kind, ...rest, ...(value as Record<string, unknown>) };
  return { kind, ...rest, [MAIN_FIELD[kind] ?? "text"]: value };
}

/**
 * Validación tolerante y segura: normaliza alias, y descarta solo los bloques
 * o diapositivas que no cumplen el esquema (nunca se usan sin validar).
 */
export function sanitizeLlmPlan(raw: unknown): { candidate: unknown; dropped: string[] } {
  const dropped: string[] = [];
  const r = (raw ?? {}) as Record<string, unknown>;
  const slides = Array.isArray(r.slides) ? r.slides : [];
  const clean = slides.flatMap((s, i) => {
    const slide = { ...((s ?? {}) as Record<string, unknown>) };
    if (typeof slide.role === "string" && ROLE_ALIASES[slide.role.toLowerCase()]) slide.role = ROLE_ALIASES[slide.role.toLowerCase()];
    const blocks = Array.isArray(slide.blocks) ? slide.blocks : [];
    slide.blocks = blocks.flatMap((b, j) => {
      const block = shorthandBlock((b ?? {}) as Record<string, unknown>);
      if (typeof block.kind === "string" && KIND_ALIASES[block.kind.toLowerCase()]) block.kind = KIND_ALIASES[block.kind.toLowerCase()];
      const ok = BlockSchema.safeParse(block);
      if (!ok.success) dropped.push(`slides.${i}.blocks.${j}`);
      return ok.success ? [ok.data] : [];
    });
    const ok = LlmSlideSchema.safeParse(slide);
    if (!ok.success) dropped.push(`slides.${i}: ${issuesOf(ok.error)[0]}`);
    return ok.success ? [ok.data] : [];
  });
  return { candidate: { ...r, slides: clean, objectives: Array.isArray(r.objectives) && r.objectives.length ? r.objectives : [String(r.title ?? "")].filter(Boolean) }, dropped };
}

/**
 * Clasificación estándar del tema (la de los libros de texto) cuando la
 * lección no trae una real. Consulta corta y específica: en el plan general
 * la IA tiende a repetir las distinciones de la explicación (p. ej. público/privado).
 */
export async function classifyTopic(content: LessonContent, call: JsonCaller): Promise<void> {
  const examples = [...new Set([...content.vocabulary.map((v) => v.term), ...content.concepts.map((c) => c.term)])].slice(0, 12);
  const system = [
    "You are a school textbook author. Give the PRIMARY standard classification of the topic, the one textbooks teach first (by nature, medium, structure or type).",
    "Examples: means of transport → land, air, water; living things → animals, plants, fungi; words → nouns, verbs, adjectives; angles → acute, right, obtuse.",
    "Do NOT classify by ownership, use, cost or frequency (e.g. public/private, short/long trips). Do NOT use branches like Types, Examples, Uses, Features.",
    "Children are concrete members of each category; prefer the lesson's own examples and complete each category with 1-2 common ones.",
    `Write in the lesson language: ${content.language}.`,
    'Return valid JSON only: { "applicable": boolean, "center": string, "criterion": string, "categories": [ { "label": string, "children": string[] } ] } — 2 to 5 categories, 2 to 4 children each. If the topic has no meaningful classification, applicable=false.',
  ].join("\n");
  try {
    const res = await call({ system, user: JSON.stringify({ topic: content.title, level: content.level, lessonExamples: examples }) });
    const r = (res.raw ?? {}) as { applicable?: unknown; center?: unknown; categories?: unknown };
    if (r.applicable === false || !Array.isArray(r.categories)) return;
    const branches = r.categories
      .map((c: { label?: unknown; children?: unknown }) => ({
        label: typeof c?.label === "string" ? c.label.trim().slice(0, 40) : "",
        children: Array.isArray(c?.children) ? c.children.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim().slice(0, 40)).slice(0, 4) : [],
      }))
      .filter((b) => b.label && b.children.length)
      .slice(0, 5);
    if (!isRealClassification(branches)) return;
    content.realClassification = true;
    content.mindMapCenter = typeof r.center === "string" && r.center.trim() ? r.center.trim().slice(0, 60) : content.title;
    content.categories = branches.map((b) => ({ id: semanticId("CATEGORY", b.label), label: capitalize(b.label), items: b.children.map((c) => capitalize(c)) }));
  } catch {
    // Sin clasificación: la presentación sigue sin diapositiva de clasificación
  }
}

/** Qué le falta a un plan para la calidad de una clase profesional. */
export function professionalGaps(p: LlmPresentationPlan, languageCourse: boolean, minSlides: number): string[] {
  const items = (s: LlmPresentationPlan["slides"][number]) => s.blocks.filter((b) => b.kind === "item").length;
  const has = (pred: (s: LlmPresentationPlan["slides"][number]) => boolean) => p.slides.some(pred);
  const count = (pred: (s: LlmPresentationPlan["slides"][number]) => boolean) => p.slides.filter(pred).length;
  const checks = proChecklist(languageCourse);
  const gaps: string[] = [];
  const vocabWords = p.slides.filter((s) => s.role === "vocabulary").reduce((a, s) => a + items(s), 0);
  if (vocabWords < 10) gaps.push(checks[1]);
  if (!has((s) => s.blocks.some((b) => b.kind === "table"))) gaps.push(checks[2]);
  if (has((s) => s.role === "grammar") && !has((s) => s.blocks.some((b) => b.kind === "note"))) gaps.push(checks[3]);
  if (count((s) => items(s) >= 4 && s.blocks.some((b) => b.kind === "item" && (b.translation || b.term.split(/\s+/).length >= 4))) < 2) gaps.push(checks[4]);
  if (!has((s) => s.role === "dialogue" || s.blocks.some((b) => b.kind === "dialogue"))) gaps.push(checks[5]);
  if (!has((s) => s.role === "reading")) gaps.push(checks[6]);
  if (count((s) => ["practice", "quiz", "assessment", "production"].includes(s.role)) < 3) gaps.push(checks[7]);
  if (p.slides.length < minSlides) gaps.push(`at least ${minSlides} slides in total`);
  return gaps;
}

export async function planWithLlm(content: LessonContent, call: JsonCaller, opts: LlmPlannerOptions): Promise<PresentationPlan> {
  if (!content.realClassification) await classifyTopic(content, call);
  const range = recommendedRange(content);
  // Con IA la clase se amplía a una unidad completa (la IA aporta vocabulario, ejemplos y ejercicios reales)
  const minSlides = opts.targetSlides ?? Math.max(18, range.min);
  const maxSlides = opts.targetSlides ?? Math.max(26, range.max);
  const languageCourse = /^[ABC][12]/i.test(content.level ?? "");
  const system = buildPlannerSystemPrompt({ language: content.language, density: opts.density, minSlides, maxSlides, tone: content.tone, languageCourse: /^[ABC][12]/i.test(content.level ?? "") });
  const user = buildPlannerUserPrompt(content);

  let parsed: LlmPresentationPlan | undefined;
  let lastIssues: string[] = [];
  let history: JsonCall["history"] = [];
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    const res = await call({ system, user, history });
    const strict = PresentationPlanSchema.safeParse(res.raw);
    if (strict.success) {
      parsed = strict.data;
      break;
    }
    lastIssues = issuesOf(strict.error);
    // Se recupera lo válido si basta para una clase completa; si no, reintento con correcciones
    const { candidate, dropped } = sanitizeLlmPlan(res.raw);
    const recovered = PresentationPlanSchema.safeParse(candidate);
    if (recovered.success && dropped.length <= Math.max(3, recovered.data.slides.length * 0.25)) {
      parsed = recovered.data;
      break;
    }
    history = [{ role: "assistant", content: res.text.slice(0, 12000) }, { role: "user", content: buildCorrectionPrompt(lastIssues) }];
  }
  if (!parsed) throw new PresentationPlanningError(`La IA devolvió un plan no válido: ${lastIssues.slice(0, 3).join("; ")}`);

  // Revisión: si faltan piezas de una clase profesional, una llamada más para completarlas
  const gaps = professionalGaps(parsed, languageCourse, minSlides);
  if (gaps.length >= 2) {
    try {
      const res = await call({ system, user, history: [{ role: "assistant", content: JSON.stringify(parsed).slice(0, 14000) }, { role: "user", content: buildRevisionPrompt(gaps, minSlides) }] });
      const strict = PresentationPlanSchema.safeParse(res.raw);
      const revised = strict.success ? strict.data : (() => {
        const { candidate } = sanitizeLlmPlan(res.raw);
        const r = PresentationPlanSchema.safeParse(candidate);
        return r.success ? r.data : undefined;
      })();
      if (revised && professionalGaps(revised, languageCourse, minSlides).length < gaps.length && revised.slides.length >= parsed.slides.length) parsed = revised;
    } catch {
      // La revisión es una mejora: si falla, se usa el plan ya validado
    }
  }
  return toInternalPlan(parsed, content, opts);
}

/** Convierte el plan validado de la IA en SlidePlan[] y aplica las reglas comunes. */
export function toInternalPlan(p: LlmPresentationPlan, content: LessonContent, opts: LlmPlannerOptions): PresentationPlan {
  const imageFor = (ids: string[], query?: string): string | undefined => {
    for (const id of ids) {
      const c = content.concepts.find((x) => x.id === id);
      if (c?.imageUrl) return c.imageUrl;
      const v = content.vocabulary.find((x) => x.id === id);
      if (v?.imageUrl) return v.imageUrl;
    }
    if (query) {
      const q = normalize(query);
      return content.images.find((i) => i.caption && (q.includes(normalize(i.caption)) || normalize(i.caption).includes(q)))?.url;
    }
    return undefined;
  };
  const vocabImage = (term: string) => content.vocabulary.find((v) => normalize(v.term) === normalize(term))?.imageUrl
    ?? content.concepts.find((c) => normalize(c.term) === normalize(term))?.imageUrl;

  const slides: SlidePlan[] = p.slides.map((s, i) => {
    const blocks = s.blocks.map((b) => (b.kind === "item" ? { ...b, emoji: b.emoji ?? emojiFor(b.term), imageUrl: vocabImage(b.term) } : b)) as SlideContentBlock[];
    const requests: VisualAssetRequest[] = [];
    const itemBlocks = blocks.filter((b): b is Extract<SlideContentBlock, { kind: "item" }> => b.kind === "item");
    // Una imagen por elemento (vocabulario, tarjetas de ejemplo): la consulta visual de la IA o el término
    const perItem = itemBlocks.length >= 2 && ["vocabulary", "example", "grammar", "concept", "explanation"].includes(s.role) && (s.role === "vocabulary" || itemBlocks.some((it) => it.imageQuery || it.translation));
    if (perItem) {
      for (const it of itemBlocks) {
        requests.push({
          type: "photo", semanticQuery: it.imageQuery ?? it.term, label: it.term,
          purpose: s.role === "vocabulary" ? "vocabulary" : "example", importance: s.role === "vocabulary" ? 0.85 : 0.8,
          preferredUrl: it.imageUrl, emoji: it.emoji, orientation: s.role === "vocabulary" ? "square" : "landscape",
        });
      }
    } else if (s.imageQuery || s.emoji) {
      requests.push({
        type: "illustration",
        semanticQuery: s.imageQuery ?? s.title,
        purpose: s.role === "cover" ? "hero" : s.role === "example" ? "example" : ["practice", "production", "quiz", "assessment"].includes(s.role) ? "activity" : "concept",
        importance: s.role === "cover" ? 1 : s.role === "reading" ? 0.9 : s.role === "concept" || s.role === "example" ? 0.8 : s.role === "hook" ? 0.7 : 0.5,
        preferredUrl: imageFor(s.covers, s.imageQuery),
        emoji: s.emoji ?? emojiFor(`${s.title} ${s.imageQuery ?? ""}`),
      });
    }
    return {
      id: `l_${i + 1}_${s.role}`,
      order: i + 1,
      pedagogicalRole: s.role,
      activity: s.activity,
      title: s.title,
      mainIdea: s.mainIdea,
      contentBlocks: blocks,
      visualIntent: s.visualIntent,
      preferredLayouts: [],
      visualAssetRequests: requests,
      speakerNotes: s.notes,
      covers: s.covers,
      importance: s.importance,
    };
  });

  return finalizePlan(
    {
      id: `plan_${Date.now().toString(36)}`,
      title: p.title || content.title,
      language: content.language,
      cefrLevel: /^[ABC][12]$/i.test(content.level ?? "") ? content.level : undefined,
      tone: content.tone,
      estimatedDuration: content.durationMinutes,
      learningObjectives: p.objectives,
      essentialIds: [...content.concepts.map((c) => c.id), ...content.vocabulary.map((v) => v.id), ...content.categories.map((c) => c.id), ...content.readings.map((r) => r.id)],
      slides: ensureReading(ensureVocabulary(completeActivities(ensureObjectives(enrichFromLesson(adaptToLayouts(slides), content), [...p.objectives, ...content.objectives]), content), content), content),
      metadata: { sourceLessonId: content.lessonId, templateId: opts.templateId, designMode: opts.designMode, planner: "llm", generatedAt: new Date().toISOString() },
    },
    content,
    { targetSlides: opts.targetSlides }
  );
}

/**
 * Adapta el plan de la IA a lo que los layouts saben representar, sin perder
 * contenido: viñetas de objetivos/resumen → tarjetas; palabras de vocabulario
 * sueltas en diapositivas seguidas → una rejilla; actividad deducida de sus bloques.
 */
export function adaptToLayouts(slides: SlidePlan[]): SlidePlan[] {
  const out: SlidePlan[] = [];
  for (const s of slides) {
    const slide = { ...s, contentBlocks: [...s.contentBlocks] };
    const bullets = slide.contentBlocks.filter((b): b is Extract<SlideContentBlock, { kind: "bullets" }> => b.kind === "bullets");
    const itemCount = slide.contentBlocks.filter((b) => b.kind === "item").length;

    // Objetivos, resumen o vocabulario en viñetas → tarjetas
    if (["objectives", "summary", "vocabulary"].includes(slide.pedagogicalRole) && itemCount < 2 && (bullets.length || slide.pedagogicalRole === "objectives")) {
      const raw = [
        ...bullets.flatMap((b) => b.items),
        ...slide.contentBlocks.flatMap((b) => (b.kind === "item" ? [b.term] : b.kind === "text" && slide.pedagogicalRole === "objectives" ? [b.text] : [])),
      ];
      const terms = slide.pedagogicalRole === "objectives" ? raw.flatMap((t) => splitObjectives(t)) : raw;
      slide.contentBlocks = slide.contentBlocks.filter((b) => b.kind !== "item" && !(slide.pedagogicalRole === "objectives" && b.kind === "text"));
      slide.contentBlocks = [
        ...slide.contentBlocks.filter((b) => b.kind !== "bullets"),
        ...[...new Set(terms)].map((t) => {
          const lead = splitLeadingEmoji(t);
          return { kind: "item", term: lead.text, emoji: lead.emoji ?? emojiFor(lead.text) } as SlideContentBlock;
        }),
      ];
    }

    // Actividad deducida de los bloques
    if (!slide.activity && ["practice", "production", "quiz", "assessment", "reflection", "hook"].includes(slide.pedagogicalRole)) {
      const has = (k: SlideContentBlock["kind"]) => slide.contentBlocks.some((b) => b.kind === k);
      slide.activity = has("options") ? "multiple_choice" : has("pairs") ? "matching" : has("blank") ? "fill_blank"
        : has("statements") ? "true_false" : has("columns") && has("bullets") ? "classify"
        : slide.pedagogicalRole === "production" && has("question") ? "speaking" : undefined;
    }
    // Pregunta sin bloque "question": la idea principal hace de pregunta
    if (["hook", "production", "reflection", "exit_ticket"].includes(slide.pedagogicalRole) && !slide.contentBlocks.some((b) => b.kind === "question")) {
      const text = slide.contentBlocks.find((b): b is Extract<SlideContentBlock, { kind: "text" }> => b.kind === "text")?.text ?? slide.mainIdea;
      if (text) slide.contentBlocks.unshift({ kind: "question", text });
    }

    // Vocabulario de una sola palabra: se une a la diapositiva de vocabulario anterior (hasta 6)
    const prev = out[out.length - 1];
    const items = slide.contentBlocks.filter((b) => b.kind === "item");
    if (slide.pedagogicalRole === "vocabulary" && items.length <= 2 && prev?.pedagogicalRole === "vocabulary" && prev.contentBlocks.filter((b) => b.kind === "item").length + items.length <= 6) {
      prev.contentBlocks.push(...items);
      prev.visualAssetRequests.push(...slide.visualAssetRequests);
      prev.speakerNotes.push(...slide.speakerNotes);
      prev.covers.push(...slide.covers);
      continue;
    }
    out.push(slide);
  }
  // Una palabra sola (sin otras con las que agruparse) se presenta como concepto
  for (const s of out) {
    if (s.pedagogicalRole === "vocabulary" && s.contentBlocks.filter((b) => b.kind === "item").length < 2) s.pedagogicalRole = "concept";
  }
  return out;
}

/** Frases que describen la diapositiva en vez de enseñar ("Descripción de…", "Introducción a…"). */
const META = /^(descripci[oó]n|introducci[oó]n|presentaci[oó]n|explicaci[oó]n|conversaci[oó]n|discusi[oó]n|repaso|resumen|actividad|pr[aá]ctica|evaluaci[oó]n|description|introduction|overview|discussion|explanation|activity|review)\b.{0,60}\b(de|del|sobre|a|of|about|on)\b/i;

/**
 * Completa el plan de la IA con el contenido real de la lección: la IA a
 * veces deja metadescripciones o diapositivas de concepto casi vacías.
 */
export function enrichFromLesson(slides: SlidePlan[], content: LessonContent): SlidePlan[] {
  return slides.map((s) => {
    const slide = { ...s, contentBlocks: [...s.contentBlocks] };
    if (META.test(slide.mainIdea)) slide.mainIdea = "";
    slide.contentBlocks = slide.contentBlocks.filter((b) => !(b.kind === "text" && META.test(b.text)));

    // Quiz sin pregunta: la pregunta está en la idea principal o en el título
    if (slide.contentBlocks.some((b) => b.kind === "options") && !slide.contentBlocks.some((b) => b.kind === "question")) {
      const q = slide.mainIdea || slide.title;
      slide.contentBlocks.unshift({ kind: "question", text: q });
    }

    // Concepto con poco contenido: definición, rasgos y ejemplo de la lección
    if (["concept", "explanation", "example"].includes(slide.pedagogicalRole)) {
      const concept = content.concepts.find((c) => normalize(slide.title) === normalize(c.term)) ?? content.concepts.find((c) => mentions(slide.title, c.term));
      const hasText = slide.contentBlocks.some((b) => b.kind === "text" || b.kind === "bullets");
      if (concept && !hasText) {
        const lead = condense(concept.definition, 16);
        const points = keyPoints(concept.definition, 3, 8).filter((p) => !normalize(lead).includes(normalize(p).slice(0, 12)));
        slide.contentBlocks.unshift({ kind: "text", text: lead }, ...(points.length ? [{ kind: "bullets", items: points } as SlideContentBlock] : []));
        if (concept.example && !slide.contentBlocks.some((b) => b.kind === "example")) slide.contentBlocks.push({ kind: "example", text: condense(concept.example, 18) });
        if (!slide.covers.includes(concept.id)) slide.covers.push(concept.id);
        if (!slide.speakerNotes.length) slide.speakerNotes.push(concept.definition, ...concept.details);
        if (concept.imageUrl && !slide.visualAssetRequests.some((r) => r.preferredUrl)) {
          slide.visualAssetRequests.unshift({ type: "illustration", semanticQuery: concept.term, purpose: "concept", importance: 0.8, preferredUrl: concept.imageUrl, emoji: concept.emoji });
        }
      }
    }
    // Pregunta que repite el título: el título pasa a ser la etiqueta de la sección
    const q = slide.contentBlocks.find((b): b is Extract<SlideContentBlock, { kind: "question" }> => b.kind === "question");
    if (q && (normalize(q.text) === normalize(slide.title) || similarity(q.text, slide.title) > 0.75)) {
      const L = labels(content.language);
      const byRole: Partial<Record<SlidePlan["pedagogicalRole"], string>> = {
        hook: L.hook, production: L.speaking, reflection: L.reflection, exit_ticket: L.exitTicket, quiz: L.quiz, practice: L.practice, assessment: L.quiz,
      };
      slide.title = byRole[slide.pedagogicalRole] ?? slide.title;
    }
    if (!slide.mainIdea) {
      const first = slide.contentBlocks.find((b): b is Extract<SlideContentBlock, { kind: "text" | "question" }> => b.kind === "text" || b.kind === "question");
      slide.mainIdea = first?.text ?? "";
    }
    return slide;
  });
}

/** La diapositiva de objetivos necesita 2-4 objetivos: si la IA dejó uno, se usan los objetivos del plan y de la lección. */
export function ensureObjectives(slides: SlidePlan[], fallback: string[]): SlidePlan[] {
  return slides.map((s) => {
    if (s.pedagogicalRole !== "objectives") return s;
    const items = s.contentBlocks.filter((b) => b.kind === "item");
    if (items.length >= 2) return s;
    const extra = [...new Set(fallback.flatMap((o) => splitObjectives(o)))].filter((o) => !items.some((i) => i.kind === "item" && i.term === o));
    const all = [...items.map((i) => (i.kind === "item" ? i.term : "")), ...extra].filter(Boolean).slice(0, 4);
    return {
      ...s,
      contentBlocks: [
        ...s.contentBlocks.filter((b) => b.kind !== "item"),
        ...all.map((t) => ({ kind: "item", term: t, emoji: emojiFor(t) }) as SlideContentBlock),
      ],
    };
  });
}

/**
 * La lectura no puede faltar: si la lección trae una lectura, se usa la de la
 * lección (con sus preguntas); si la IA no incluyó ninguna, se añade la
 * compuesta con los ejemplos de la lección.
 */
export function ensureReading(slides: SlidePlan[], content: LessonContent): SlidePlan[] {
  const lessonReading = content.readings.find((r) => !r.composed);
  const hasLlmReading = slides.some((s) => s.pedagogicalRole === "reading" && s.contentBlocks.some((b) => b.kind === "passage"));
  if (hasLlmReading && !lessonReading) {
    return slides.map((s) => (s.pedagogicalRole === "reading" ? { ...s, covers: [...s.covers, ...content.readings.map((r) => r.id)] } : s));
  }
  const reading = lessonReading ?? content.readings[0];
  if (!reading) return slides;
  const lang = /^en|^ingl/i.test(content.language) ? "en" : "es";
  const kept = slides.filter((s) => s.pedagogicalRole !== "reading");
  const at = kept.findIndex((s) => ["practice", "production", "quiz", "assessment", "summary", "exit_ticket"].includes(s.pedagogicalRole));
  kept.splice(at < 0 ? kept.length : at, 0, ...readingSlides(reading, labels(content.language), lang));
  return kept;
}

/**
 * Actividades completas: si la IA dejó solo la consigna, se completan con el
 * contenido de la lección; si no se puede, la diapositiva se descarta (nunca
 * un ejercicio vacío). El mapa de clasificación usa la clasificación de la lección.
 */
export function completeActivities(slides: SlidePlan[], content: LessonContent): SlidePlan[] {
  // Sin clasificación fiable en la lección: se adopta la de la IA si es real (para el mapa y "Clasifica")
  if (!content.realClassification) {
    for (const s of slides) {
      const tree = s.pedagogicalRole === "mind_map" ? s.contentBlocks.find((b): b is Extract<SlideContentBlock, { kind: "tree" }> => b.kind === "tree") : undefined;
      if (tree && isRealClassification(tree.branches)) {
        content.mindMapCenter = tree.center;
        content.realClassification = true;
        content.categories = tree.branches.map((b) => ({ id: semanticId("CATEGORY", b.label), label: b.label, items: b.children }));
        break;
      }
    }
  }
  const out: SlidePlan[] = [];
  for (const s of slides) {
    // Un mapa que no es una clasificación real no se muestra
    if (s.pedagogicalRole === "mind_map" && (!content.realClassification || content.categories.length < 2)) continue;
    if (s.pedagogicalRole === "mind_map") {
      out.push({
        ...s,
        title: labels(content.language).classificationOf(content.title.charAt(0).toLowerCase() + content.title.slice(1)),
        contentBlocks: [{
          kind: "tree",
          center: content.mindMapCenter ?? content.title,
          branches: content.categories.slice(0, 4).map((c) => ({ label: c.label, emoji: emojiFor(c.label), children: c.items.slice(0, 4) })),
        }],
        covers: [...s.covers, ...content.categories.map((c) => c.id)],
      });
      continue;
    }
    if (["practice", "production", "quiz", "assessment", "reflection"].includes(s.pedagogicalRole)) {
      const done = completeActivity(s, content);
      if (done) out.push(done);
      continue;
    }
    out.push(s);
  }
  return out;
}

/** El vocabulario siempre lleva sus palabras (con icono o imagen); si la IA no hizo diapositiva de vocabulario, se añade. */
export function ensureVocabulary(slides: SlidePlan[], content: LessonContent): SlidePlan[] {
  const vocab = content.vocabulary.slice(0, 6);
  if (vocab.length < 3) return slides;
  const items = vocab.map((v) => ({ kind: "item", term: v.term, detail: v.meaning ? condense(v.meaning, 5) : undefined, emoji: v.emoji, imageUrl: v.imageUrl, refId: v.id }) as SlideContentBlock);
  const requests = vocab.map((v) => ({ type: "illustration", semanticQuery: v.term, purpose: "vocabulary", importance: 0.6, preferredUrl: v.imageUrl, emoji: v.emoji, orientation: "square" }) as VisualAssetRequest);
  let has = false;
  const out = slides.map((s) => {
    if (s.pedagogicalRole !== "vocabulary") return s;
    if (s.contentBlocks.filter((b) => b.kind === "item").length >= 2) {
      has = true;
      return s;
    }
    has = true;
    return { ...s, contentBlocks: items, visualAssetRequests: requests, covers: [...s.covers, ...vocab.map((v) => v.id)], mainIdea: "" };
  });
  if (has) return out;
  const at = out.findIndex((s) => !["cover", "hook", "objectives", "explanation"].includes(s.pedagogicalRole));
  out.splice(at < 0 ? out.length : at, 0, {
    id: "l_vocab", order: 0, pedagogicalRole: "vocabulary", title: labels(content.language).vocabulary, mainIdea: "",
    contentBlocks: items, visualIntent: "Rejilla de vocabulario", preferredLayouts: [], visualAssetRequests: requests,
    speakerNotes: vocab.map((v) => `${v.term}: ${v.meaning ?? ""}`), covers: vocab.map((v) => v.id), importance: 5,
  });
  return out;
}

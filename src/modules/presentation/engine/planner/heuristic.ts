import type { LessonContent, PresentationPlan, SlideContentBlock, SlidePlan, VisualAssetRequest, LessonConcept, DesignMode } from "../types";
import { labels } from "../i18n";
import { emojiFor, ROLE_EMOJI } from "../icons";
import { capitalize, condense, keyPoints, mentions, normalize, seededRandom, similarity, splitObjectives } from "../text";
import { finalizePlan } from "./finalize";
import { classifyBlocks, matchingBlocks } from "./activities";

/**
 * Planificador pedagógico sin IA (gratis y de respaldo). Transforma el
 * contenido extraído en una secuencia de clase: activación → objetivos →
 * presentación (vocabulario, comparación, conceptos) → organización (mapa) →
 * práctica guiada y libre → evaluación → cierre. Nunca convierte párrafos en
 * diapositivas uno a uno: agrupa por función pedagógica.
 */

export type TextDensity = "minimo" | "estandar" | "detallado";

export interface PlannerOptions {
  density: TextDensity;
  /** Número de diapositivas pedido por el profesor; sin él, se calcula por complejidad */
  targetSlides?: number;
  designMode: DesignMode;
  templateId?: string;
}

const DENSITY = {
  minimo: { bullets: 2, words: 6, gridMax: 4 },
  estandar: { bullets: 3, words: 8, gridMax: 6 },
  detallado: { bullets: 4, words: 12, gridMax: 6 },
} as const;

let counter = 0;
const sid = (role: string) => `s_${role}_${(++counter).toString(36)}`;

function slide(partial: Omit<SlidePlan, "id" | "order" | "speakerNotes" | "covers" | "visualAssetRequests" | "preferredLayouts"> & Partial<SlidePlan>): SlidePlan {
  return {
    id: sid(partial.pedagogicalRole),
    order: 0,
    speakerNotes: [],
    covers: [],
    visualAssetRequests: [],
    preferredLayouts: [],
    ...partial,
  };
}

function conceptAsset(c: LessonConcept, purpose: VisualAssetRequest["purpose"] = "concept"): VisualAssetRequest {
  return { type: "illustration", semanticQuery: c.term, purpose, importance: 0.8, preferredUrl: c.imageUrl, emoji: c.emoji ?? emojiFor(c.term), orientation: "landscape" };
}

const OBJECTIVE_ICONS: Array<[RegExp, string]> = [
  [/^(reconoc|identific|nombr|recogn|identif|name)/i, "🔍"],
  [/^(diferenci|compar|distingu|clasific|tell|compare|classif)/i, "⚖️"],
  [/^(us|aplic|habl|describ|use|apply|speak|describe|talk)/i, "💬"],
  [/^(explic|comprend|entend|explain|understand)/i, "💡"],
  [/^(escrib|redact|write)/i, "✏️"],
  [/^(le|lee|read)/i, "📖"],
];
const FALLBACK_ICONS = ["🎯", "🧩", "🚀", "⭐"];

/** ¿La viñeta repite lo que ya dice la frase principal? */
function isEcho(point: string, lead: string): boolean {
  const p = normalize(point.replace(/…$/, ""));
  return normalize(lead).includes(p.slice(0, Math.max(12, p.length - 2))) || similarity(point, lead) > 0.5;
}

function objectiveEmoji(text: string, index: number): string {
  const t = text.trim().toLowerCase();
  return OBJECTIVE_ICONS.find(([re]) => re.test(t))?.[1] ?? FALLBACK_ICONS[index % FALLBACK_ICONS.length];
}

/** Objetivos redactados a partir del contenido cuando la lección no los trae. */
function deriveObjectives(c: LessonContent, lang: "es" | "en"): string[] {
  const vocab = c.vocabulary.slice(0, 4).map((v) => v.term.toLowerCase());
  const out: string[] = [];
  if (vocab.length >= 2) out.push(lang === "en" ? `Recognise ${vocab.slice(0, 3).join(", ")}…` : `Reconocer ${vocab.slice(0, 3).join(", ")}…`);
  if (c.categories.length >= 2) {
    out.push(lang === "en"
      ? `Tell the difference between ${c.categories[0].label.toLowerCase()} and ${c.categories[1].label.toLowerCase()}`
      : `Diferenciar ${c.categories[0].label.toLowerCase()} y ${c.categories[1].label.toLowerCase()}`);
  } else if (c.concepts.length) {
    out.push(lang === "en" ? `Explain what ${c.concepts[0].term.toLowerCase()} means` : `Explicar qué es ${c.concepts[0].term.toLowerCase()}`);
  }
  out.push(lang === "en" ? `Use what you learn about ${c.title.toLowerCase()} in real examples` : `Usar lo aprendido sobre ${c.title.toLowerCase()} en ejemplos reales`);
  return out.slice(0, 3);
}

export function planFromContent(content: LessonContent, opts: PlannerOptions): PresentationPlan {
  counter = 0;
  const L = labels(content.language);
  const lang = L === labels("en") ? "en" : "es";
  const d = DENSITY[opts.density];
  const kids = content.tone === "kids";
  const rnd = seededRandom(`${content.lessonId ?? content.title}`);
  const slides: SlidePlan[] = [];
  const topic = content.title;
  const topicLower = topic.charAt(0).toLowerCase() + topic.slice(1);
  const heroImage = content.images.find((i) => !i.conceptId) ?? content.images[0];

  // 1. Portada
  slides.push(slide({
    pedagogicalRole: "cover",
    title: topic,
    mainIdea: content.courseTitle && content.courseTitle !== topic ? content.courseTitle : "",
    contentBlocks: content.level ? [{ kind: "text", text: `${L.level} ${content.level}` }] : [],
    visualIntent: "Portada con el tema grande y una imagen protagonista relacionada",
    visualAssetRequests: [{ type: "illustration", semanticQuery: topic, purpose: "hero", importance: 1, preferredUrl: heroImage?.url, emoji: emojiFor(topic) ?? "📘" }],
    importance: 5,
  }));

  // 2. Activación
  const reflection = content.exercises.find((e) => /reflex|reflect/i.test(e.kind));
  const hookQuestion = reflection ? condense(reflection.instruction, 14) : L.hookQuestion(topicLower);
  const hookImage = content.images.find((i) => !i.conceptId && i.url !== heroImage?.url);
  const pictureHook = Boolean(hookImage) && rnd() > 0.3;
  slides.push(slide({
    pedagogicalRole: "hook",
    activity: pictureHook ? "guess" : undefined,
    title: pictureHook ? L.guess : L.hook,
    mainIdea: hookQuestion,
    contentBlocks: [{ kind: "question", text: hookQuestion }, { kind: "text", text: L.hookPrompt }],
    visualIntent: pictureHook ? "Imagen grande para observar y predecir" : "Pregunta grande que activa conocimientos previos",
    visualAssetRequests: [{ type: "illustration", semanticQuery: topic, purpose: "activity", importance: pictureHook ? 0.9 : 0.5, preferredUrl: pictureHook ? hookImage?.url : undefined, emoji: ROLE_EMOJI.hook }],
    speakerNotes: [reflection?.instruction ?? "", ...(content.teacherNotes.slice(0, 1))].filter(Boolean),
    covers: reflection ? [reflection.id] : [],
    importance: 4,
  }));

  // 3. Objetivos
  const explicit = content.objectives.flatMap((o) => splitObjectives(o));
  const objectives = [...new Set([...explicit, ...(explicit.length >= 2 ? [] : deriveObjectives(content, lang))])].slice(0, kids ? 3 : 4);
  slides.push(slide({
    pedagogicalRole: "objectives",
    title: kids ? L.objectivesShort : L.objectives,
    mainIdea: objectives[0] ?? "",
    contentBlocks: objectives.map((o, i) => ({ kind: "item", term: capitalize(condense(o, 16)), emoji: objectiveEmoji(o, i) }) as SlideContentBlock),
    visualIntent: "Tarjetas o pasos con icono, uno por objetivo",
    preferredLayouts: ["OBJECTIVES_CARDS", "PROCESS_STEPS"],
    speakerNotes: objectives,
    importance: 4,
  }));

  // 4. Visión general (qué es…)
  const categoryConceptIds = new Set(
    content.categories.flatMap((cat) => content.concepts.filter((c) => normalize(c.term) === normalize(cat.label) || mentions(c.term, cat.label)).map((c) => c.id))
  );
  if (content.explanation.length) {
    const points = keyPoints(content.explanation.slice(0, 3).join(" "), d.bullets, d.words + 2);
    slides.push(slide({
      pedagogicalRole: "explanation",
      title: lang === "en" ? `What ${/s$/i.test(topic) ? "are" : "is"} ${topicLower}?` : `¿Qué ${/s$/i.test(topic.split(" ")[0]) ? "son" : "es"} ${topicLower}?`,
      mainIdea: condense(content.explanation[0], 16),
      contentBlocks: [{ kind: "text", text: condense(content.explanation[0], 18) }, ...(points.length > 1 ? [{ kind: "bullets", items: points.slice(1) } as SlideContentBlock] : [])],
      visualIntent: "Idea central con una imagen de contexto",
      visualAssetRequests: [{ type: "illustration", semanticQuery: topic, purpose: "concept", importance: 0.7, preferredUrl: content.images.find((i) => !i.conceptId && i.url !== heroImage?.url)?.url, emoji: emojiFor(topic) }],
      speakerNotes: content.explanation,
      importance: 4,
    }));
  }

  // 5. Vocabulario visual (rejillas de hasta 4-6 tarjetas)
  const vocab = content.vocabulary;
  if (vocab.length >= 3) {
    const per = Math.min(d.gridMax, kids ? 4 : 6);
    const groups = Math.ceil(vocab.length / per);
    const size = Math.ceil(vocab.length / groups);
    for (let g = 0; g < groups; g++) {
      const items = vocab.slice(g * size, (g + 1) * size);
      slides.push(slide({
        pedagogicalRole: "vocabulary",
        title: groups > 1 ? `${L.vocabulary} (${g + 1}/${groups})` : L.vocabulary,
        mainIdea: items.map((v) => v.term).join(", "),
        contentBlocks: items.map((v) => ({ kind: "item", term: v.term, detail: v.meaning ? condense(v.meaning, 5) : undefined, emoji: v.emoji, imageUrl: v.imageUrl, refId: v.id }) as SlideContentBlock),
        visualIntent: "Rejilla de tarjetas: imagen o icono grande + palabra",
        visualAssetRequests: items.map((v) => ({ type: "illustration", semanticQuery: v.term, purpose: "vocabulary", importance: 0.6, preferredUrl: v.imageUrl, emoji: v.emoji, orientation: "square" }) as VisualAssetRequest),
        speakerNotes: items.map((v) => `${v.term}: ${v.meaning ?? ""}`),
        covers: items.map((v) => v.id),
        importance: 5,
      }));
    }
  }

  // 6. Comparación VS solo cuando la lección distingue exactamente dos categorías
  if (content.categories.length === 2) {
    const [a, b] = content.categories;
    // "Público" ↔ "Transporte público": el concepto cuyo término contiene la etiqueta
    const conceptOf = (label: string) =>
      content.concepts.find((c) => normalize(c.term) === normalize(label)) ??
      content.concepts.find((c) => mentions(c.term, label));
    const traits = (label: string) => {
      const c = conceptOf(label);
      return c ? keyPoints(c.definition, d.bullets, 5) : [];
    };
    slides.push(slide({
      pedagogicalRole: "comparison",
      title: `${a.label} ${L.vs.toLowerCase() === "vs" ? "vs." : L.vs} ${b.label}`,
      mainIdea: `${a.label} / ${b.label}`,
      contentBlocks: [{
        kind: "columns",
        columns: [a, b].map((cat) => ({
          heading: cat.label,
          emoji: emojiFor(cat.label) ?? emojiFor(cat.items[0] ?? ""),
          items: [...traits(cat.label).slice(0, 2), ...cat.items.slice(0, 3).map((i) => `${emojiFor(i) ?? "•"} ${i}`)],
        })),
      }],
      visualIntent: "Dos columnas enfrentadas con icono y rasgos",
      preferredLayouts: ["VS_LAYOUT", "COMPARISON_SPLIT"],
      speakerNotes: [a, b].map((cat) => `${cat.label}: ${conceptOf(cat.label)?.definition ?? cat.items.join(", ")}`),
      covers: [a.id, b.id, ...[a.label, b.label].map((l) => conceptOf(l)?.id).filter((x): x is string => Boolean(x))],
      importance: 4,
    }));
  }

  // 7. Conceptos: uno por diapositiva (con imagen y ejemplo) o en tarjetas si son muchos
  const concepts = content.concepts.filter((c) => !categoryConceptIds.has(c.id) || content.categories.length < 2);
  const individual = opts.density !== "minimo" || concepts.length <= 6;
  if (individual) {
    for (const c of concepts) {
      const lead = condense(c.definition, kids ? 10 : 16);
      const points = keyPoints(c.definition, d.bullets + 1, d.words).filter((p) => !isEcho(p, lead));
      slides.push(slide({
        pedagogicalRole: "concept",
        title: c.term,
        mainIdea: condense(c.definition, 12),
        contentBlocks: [
          { kind: "text", text: lead },
          ...(points.length ? [{ kind: "bullets", items: points.slice(0, d.bullets) } as SlideContentBlock] : []),
          ...(c.example ? [{ kind: "example", text: condense(c.example, 18) } as SlideContentBlock] : []),
        ],
        visualIntent: "Concepto con imagen protagonista, rasgos clave y ejemplo destacado",
        visualAssetRequests: [conceptAsset(c)],
        speakerNotes: [c.definition, ...c.details, c.example ? `${L.example}: ${c.example}` : ""].filter(Boolean),
        covers: [c.id, ...content.vocabulary.filter((v) => normalize(v.term) === normalize(c.term)).map((v) => v.id)],
        importance: 3,
      }));
    }
  } else {
    for (let i = 0; i < concepts.length; i += 3) {
      const group = concepts.slice(i, i + 3);
      slides.push(slide({
        pedagogicalRole: "concept",
        title: group.map((c) => c.term).join(" · "),
        mainIdea: group.map((c) => c.term).join(", "),
        contentBlocks: group.map((c) => ({ kind: "item", term: c.term, detail: condense(c.definition, 9), emoji: c.emoji, imageUrl: c.imageUrl, refId: c.id }) as SlideContentBlock),
        visualIntent: "Tres tarjetas de concepto con icono",
        preferredLayouts: ["THREE_CARDS"],
        visualAssetRequests: group.map((c) => conceptAsset(c)),
        speakerNotes: group.map((c) => `${c.term}: ${c.definition}`),
        covers: group.map((c) => c.id),
        importance: 3,
      }));
    }
  }

  // 8. Gramática como fórmula
  for (const g of content.grammar) {
    const parts = g.formula.split(/\s*\+\s*/).filter(Boolean);
    slides.push(slide({
      pedagogicalRole: "grammar",
      title: g.title || L.grammar,
      mainIdea: g.formula,
      contentBlocks: [{ kind: "formula", parts: parts.length >= 2 ? parts : [g.formula], examples: g.examples.slice(0, 2) }],
      visualIntent: "Fórmula con piezas de color y ejemplos debajo",
      speakerNotes: [g.formula, ...g.examples],
      covers: [g.id],
      importance: 4,
    }));
  }

  // 9. Ejemplos sueltos de la lección
  if (content.examples.length >= 2) {
    const ex = content.examples.slice(0, 4);
    slides.push(slide({
      pedagogicalRole: "example",
      title: content.examples.length > 1 ? `${L.example}s` : L.example,
      mainIdea: ex[0].text,
      contentBlocks: ex.map((e) => ({ kind: "item", term: condense(e.text, 14), emoji: emojiFor(e.text) ?? "📌", refId: e.id }) as SlideContentBlock),
      visualIntent: "Ejemplos en tarjetas con icono",
      speakerNotes: content.examples.map((e) => e.text),
      covers: ex.map((e) => e.id),
      importance: 3,
    }));
  }

  // 10. Clasificación del tema: solo con una clasificación real (no con grupos deducidos de los conceptos)
  if (content.realClassification && content.categories.length >= 2) {
    slides.push(slide({
      pedagogicalRole: "mind_map",
      title: content.mindMapCenter ? L.classificationOf(topicLower) : L.mindMap,
      mainIdea: content.mindMapCenter ?? topic,
      contentBlocks: [{
        kind: "tree",
        center: content.mindMapCenter ?? topic,
        branches: content.categories.slice(0, 4).map((c) => ({ label: c.label, emoji: emojiFor(c.label), children: c.items.slice(0, 4) })),
      }],
      visualIntent: "Árbol con nodos y conectores",
      speakerNotes: content.categories.map((c) => `${c.label}: ${c.items.join(", ")}`),
      covers: content.categories.map((c) => c.id),
      importance: 4,
    }));
  }

  // 10b. Lectura de comprensión (siempre: de la lección o compuesta con sus ejemplos)
  for (const r of content.readings.slice(0, 2)) slides.push(...readingSlides(r, L, lang));

  // 11. Diálogos
  for (const dlg of content.dialogues.slice(0, 2)) {
    slides.push(slide({
      pedagogicalRole: "dialogue",
      title: dlg.title || L.dialogue,
      mainIdea: dlg.lines[0]?.text ?? "",
      contentBlocks: [{ kind: "dialogue", lines: dlg.lines.slice(0, 6) }],
      visualIntent: "Bocadillos alternos por personaje",
      speakerNotes: dlg.lines.map((l) => `${l.speaker}: ${l.text}`),
      covers: [dlg.id],
      importance: 3,
    }));
  }

  // 12. Práctica: relacionar, clasificar, completar, verdadero/falso, hablar
  const matching = matchingBlocks(content);
  if (matching) {
    const pairs = matching.find((b): b is Extract<SlideContentBlock, { kind: "pairs" }> => b.kind === "pairs")!;
    slides.push(slide({
      pedagogicalRole: "practice",
      activity: "matching",
      title: L.matching,
      mainIdea: L.matchingPrompt,
      contentBlocks: matching,
      visualIntent: "Dos columnas para unir con flechas",
      speakerNotes: pairs.left.map((l, i) => `${l} → ${pairs.right[pairs.answers.indexOf(i)] ?? ""}`),
      covers: ["ACTIVITY_MATCHING"],
      importance: 4,
    }));
  }

  const classify = classifyBlocks(content);
  if (classify) {
    slides.push(slide({
      pedagogicalRole: "practice",
      activity: "classify",
      title: L.classify,
      mainIdea: L.classifyPrompt,
      contentBlocks: classify,
      visualIntent: "Fichas de palabras y cajas de grupo",
      speakerNotes: content.categories.map((c) => `${c.label}: ${c.items.join(", ")}`),
      covers: ["ACTIVITY_CLASSIFY"],
      importance: 3,
    }));
  }

  const blankSource = [...content.concepts.map((c) => c.example).filter((e): e is string => Boolean(e)), ...content.examples.map((e) => e.text)];
  const blanks = blankSource
    .map((sentence) => {
      const term = vocab.find((v) => mentions(sentence, v.term));
      if (!term) return null;
      const re = new RegExp(`\\b${term.term.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*`, "i");
      if (!re.test(sentence)) return null;
      return { sentence: condense(sentence.replace(re, "______"), 16), answer: term.term };
    })
    .filter((x): x is { sentence: string; answer: string } => Boolean(x))
    .slice(0, 3);
  const explicitBlank = content.exercises.find((e) => /_{3,}/.test(e.instruction));
  if (explicitBlank || blanks.length >= 2) {
    slides.push(slide({
      pedagogicalRole: "practice",
      activity: "fill_blank",
      title: L.fillBlank,
      mainIdea: explicitBlank?.instruction ?? blanks[0].sentence,
      contentBlocks: [
        ...(explicitBlank ? [{ kind: "blank", sentence: condense(explicitBlank.instruction.replace(/^[^:]{0,30}:\s*/, ""), 24), answer: (explicitBlank.solution ?? "").split(/\s*[/,;(]\s*/)[0].trim() || undefined } as SlideContentBlock] : []),
        ...blanks.slice(0, explicitBlank ? 2 : 3).map((b) => ({ kind: "blank", sentence: b.sentence, answer: b.answer }) as SlideContentBlock),
      ],
      visualIntent: "Frases con hueco destacado",
      speakerNotes: explicitBlank ? [explicitBlank.solution ?? ""] : blanks.map((b) => `${b.sentence} → ${b.answer}`),
      covers: explicitBlank ? [explicitBlank.id, "ACTIVITY_FILL_BLANK"] : ["ACTIVITY_FILL_BLANK"],
      importance: 3,
    }));
  }

  // Ejercicios restantes de la lección (sin hueco): producción o práctica guiada
  for (const ex of content.exercises.filter((e) => e !== reflection && e !== explicitBlank).slice(0, 2)) {
    const production = /produc|escrib|write|habla|speak|conversa/i.test(`${ex.kind} ${ex.instruction}`);
    slides.push(slide({
      pedagogicalRole: production ? "production" : "practice",
      activity: production ? "speaking" : undefined,
      title: production ? L.speaking : L.practice,
      mainIdea: condense(ex.instruction, 18),
      contentBlocks: [{ kind: "question", text: condense(ex.instruction.replace(/^(habla con tu compa[ñn]ero|talk to your partner|en parejas|in pairs)\s*[:,.-]\s*/i, ""), 22) }],
      visualIntent: production ? "Consigna de conversación con icono de diálogo" : "Consigna de práctica destacada",
      speakerNotes: [ex.instruction, ex.solution ? `Solución: ${ex.solution}` : ""].filter(Boolean),
      covers: [ex.id],
      importance: 3,
    }));
  }

  if (!slides.some((s) => s.activity === "speaking")) {
    const q = lang === "en" ? `Which ${vocab[0] ? "one" : "idea"} do you use most? Why?` : `¿Cuál usas más tú? ¿Por qué?`;
    slides.push(slide({
      pedagogicalRole: "production",
      activity: "speaking",
      title: L.speaking,
      mainIdea: q,
      contentBlocks: [{ kind: "question", text: q }, { kind: "text", text: L.speakingPrompt }],
      visualIntent: "Consigna de conversación en parejas",
      speakerNotes: [L.speakingPrompt],
      covers: ["ACTIVITY_SPEAKING"],
      importance: 2,
    }));
  }

  // 13. Evaluación: preguntas de la lección (respuesta en las notas)
  for (const q of content.quizzes.slice(0, 4)) {
    slides.push(slide({
      pedagogicalRole: "quiz",
      activity: "multiple_choice",
      title: L.quiz,
      mainIdea: q.question,
      contentBlocks: [{ kind: "question", text: q.question }, { kind: "options", options: q.options, correctIndex: q.correctIndex }],
      visualIntent: "Pregunta grande y opciones A-D en color",
      speakerNotes: [`✓ ${q.options[q.correctIndex]}`, q.explanation ?? ""].filter(Boolean),
      covers: [q.id],
      importance: 4,
    }));
  }
  if (!content.quizzes.length && content.concepts.length >= 3) {
    // Verdadero o falso a partir de los conceptos (una afirmación falsa cruza definiciones)
    const picks = content.concepts.slice(0, 3);
    const statements = picks.map((c, i) => {
      const isTrue = i !== 1;
      const def = isTrue ? c.definition : picks[(i + 1) % picks.length].definition;
      return { text: `${c.term}: ${condense(def, 9)}`, isTrue };
    });
    slides.push(slide({
      pedagogicalRole: "assessment",
      activity: "true_false",
      title: L.trueFalse,
      mainIdea: statements[0].text,
      contentBlocks: [{ kind: "statements", items: statements }],
      visualIntent: "Afirmaciones con casillas V/F",
      speakerNotes: statements.map((s) => `${s.isTrue ? "V" : "F"} — ${s.text}`),
      covers: ["ACTIVITY_TRUE_FALSE"],
      importance: 3,
    }));
  }

  // 14. Resumen (3-5 ideas)
  const takeaways = content.concepts
    .slice(0, 4)
    .map((c) => `${c.term}: ${(keyPoints(c.definition, 1, 7)[0] ?? condense(c.definition, 7)).replace(/…$/, "").toLowerCase()}`);
  if (takeaways.length) {
    slides.push(slide({
      pedagogicalRole: "summary",
      title: L.summary,
      mainIdea: takeaways[0],
      contentBlocks: takeaways.map((t) => ({ kind: "item", term: t, emoji: emojiFor(t) ?? "⭐" }) as SlideContentBlock),
      visualIntent: "3-4 ideas clave con check",
      speakerNotes: [content.homework ? `Tarea: ${content.homework}` : ""].filter(Boolean),
      importance: 5,
    }));
  }

  // 15. Ticket de salida
  slides.push(slide({
    pedagogicalRole: "exit_ticket",
    title: L.exitTicket,
    mainIdea: L.nameThree(topicLower),
    contentBlocks: [{ kind: "question", text: L.nameThree(topicLower) }, { kind: "bullets", items: [...L.selfCheckScale] }],
    visualIntent: "Pregunta rápida y autoevaluación con caras",
    importance: 4,
  }));

  const essentialIds = [
    ...content.concepts.map((c) => c.id),
    ...content.vocabulary.map((v) => v.id),
    ...content.categories.map((c) => c.id),
    ...content.quizzes.map((q) => q.id),
    ...content.grammar.map((g) => g.id),
    ...content.readings.map((r) => r.id),
  ];

  return finalizePlan(
    {
      id: `plan_${Date.now().toString(36)}`,
      title: topic,
      language: content.language,
      cefrLevel: /^[ABC][12]$/i.test(content.level ?? "") ? content.level : undefined,
      tone: content.tone,
      estimatedDuration: content.durationMinutes,
      learningObjectives: objectives,
      essentialIds,
      slides,
      metadata: { sourceLessonId: content.lessonId, templateId: opts.templateId, designMode: opts.designMode, planner: "heuristic", generatedAt: new Date().toISOString() },
    },
    content,
    { targetSlides: opts.targetSlides }
  );
}


const READING_WORDS_PER_SLIDE = 150;

/** Lectura: el texto completo (en 1-2 diapositivas) con sus tareas, y luego sus preguntas de comprensión. */
export function readingSlides(r: LessonContent["readings"][number], L: ReturnType<typeof labels>, lang: "es" | "en"): SlidePlan[] {
  const out: SlidePlan[] = [];
  // Reparte los párrafos en páginas de ~150 palabras sin partir un párrafo
  const pages: string[][] = [[]];
  let count = 0;
  for (const p of r.paragraphs) {
    const words = p.split(/\s+/).length;
    if (count && count + words > READING_WORDS_PER_SLIDE && pages.length < 3) {
      pages.push([]);
      count = 0;
    }
    pages[pages.length - 1].push(p);
    count += words;
  }
  const tasks = r.tasks.length ? r.tasks.slice(0, 3) : lang === "en"
    ? ["Read the text carefully.", "Underline the key words.", "Answer the questions."]
    : ["Lee el texto con atención.", "Subraya las palabras clave.", "Responde las preguntas."];
  pages.forEach((paragraphs, i) => {
    out.push(slide({
      pedagogicalRole: "reading",
      title: pages.length > 1 ? `${r.title} (${i + 1}/${pages.length})` : r.title,
      mainIdea: "",
      contentBlocks: [
        { kind: "passage", title: r.title, paragraphs },
        ...(i === pages.length - 1 ? [{ kind: "bullets", items: tasks } as SlideContentBlock] : []),
      ],
      visualIntent: "Texto de lectura legible con tareas de comprensión",
      // La lectura siempre lleva su imagen (la de la lección o una generada de su escena)
      visualAssetRequests: i === 0 ? [{ type: "photo", semanticQuery: `${r.title}: ${r.paragraphs[0]?.slice(0, 120) ?? ""}`, label: r.title, purpose: "example", importance: 0.9, preferredUrl: r.imageUrl, emoji: "📖" }] : [],
      speakerNotes: [
        r.composed ? (lang === "en" ? "Short reading composed with the lesson's own example sentences." : "Lectura breve compuesta con las frases de ejemplo de la propia lección.") : "",
        ...tasks,
      ].filter(Boolean),
      covers: [r.id],
      importance: 5,
    }));
  });
  for (const q of r.questions.slice(0, 3)) {
    out.push(slide({
      pedagogicalRole: "practice",
      activity: "multiple_choice",
      title: lang === "en" ? "Reading comprehension" : "Comprensión lectora",
      mainIdea: q.question,
      contentBlocks: [{ kind: "question", text: q.question }, { kind: "options", options: q.options, correctIndex: q.correctIndex }],
      visualIntent: "Pregunta de comprensión de la lectura",
      speakerNotes: [`✓ ${q.options[q.correctIndex]}`, q.explanation ?? ""].filter(Boolean),
      covers: [q.id],
      importance: 4,
    }));
  }
  void L;
  return out;
}

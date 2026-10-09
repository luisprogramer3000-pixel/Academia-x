import type { EducationTone, LessonConcept, LessonContent, LessonCategory } from "../types";
import { emojiFor, splitLeadingEmoji } from "../icons";
import { capitalize, listItems, mentions, normalize, semanticId, sentences, splitExample, splitObjectives, stripMarkdown, wordCount } from "../text";

/**
 * Extracción semántica: convierte los bloques de una lección (lo que guarda el
 * editor) en contenido estructurado — conceptos, vocabulario, categorías,
 * ejemplos, actividades — con IDs semánticos estables. No decide diapositivas.
 */

export interface LessonBlockInput {
  type: string;
  title?: string;
  content?: string;
  url?: string;
  question?: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
  answer?: string;
  label?: string;
  cards?: Array<{ front: string; back: string }>;
  lines?: Array<{ speaker: string; text: string; translation?: string }>;
  mindMap?: { center: string; branches: Array<{ label: string; children: string[] }> };
}

export interface TeacherPlanInput {
  objective?: string;
  prerequisites?: string[];
  classFlow?: Array<{ minute: number; durationMinutes: number; activity: string }>;
  homework?: string;
  teacherNotes?: string[];
}

export interface ExtractInput {
  lessonId?: string;
  title: string;
  courseTitle?: string;
  academyName: string;
  language: string;
  level?: string;
  blocks: LessonBlockInput[];
  teacherPlan?: TeacherPlanInput | null;
}

const RE = {
  explanation: /^(explicaci|introducci|teor[ií]a|qu[eé] (es|son)|what (is|are)|overview|presentaci[oó]n|contexto|context)/i,
  examples: /^(ejemplos?|examples?)\b/i,
  exercise: /^(ejercicio|exercise|actividad|activity|pr[aá]ctica|practice|tarea|task)/i,
  keyConcepts: /^(conceptos? clave|key concepts?|conceptos?)$/i,
  grammar: /^(gram[aá]tica|grammar|estructura|structure|f[oó]rmula|formula|regla|rule)/i,
  objectives: /^(objetivos?|objectives?|goals?|metas?)/i,
  vocabulary: /^(vocabulario|vocabulary|palabras clave|key words|glosario|glossary)/i,
  summary: /^(resumen|conclusi[oó]n|summary|conclusion|recap|repaso)/i,
  reading: /(lectura|reading|comprensi[oó]n lectora|texto de lectura|cuento|story|art[ií]culo)/i,
};

/** Ramas de un mapa que no son categorías de una clasificación ("Tipos", "Ejemplos", "Usos"…). */
const META_BRANCH = /^(tipos?|clases?|categor[ií]as?|ejemplos?|usos?|utilidad(es)?|caracter[ií]sticas?|ventajas?|desventajas?|definici[oó]n(es)?|partes|funci[oó]n(es)?|importancia|beneficios?|riesgos?|causas?|consecuencias?|conceptos?|vocabulario|resumen|otros?|types?|kinds?|examples?|uses?|features?|characteristics?|advantages?|disadvantages?|definitions?|parts|functions?|benefits?|risks?|causes?|effects?|vocabulary|summary|others?)$/i;

/** ¿Las ramas forman una clasificación real (categorías con ejemplos)? */
export function isRealClassification(branches: Array<{ label: string; children: string[] }>): boolean {
  const real = branches.filter((b) => !META_BRANCH.test(b.label.trim()) && b.children.length > 0);
  return real.length >= 2 && real.length === branches.length;
}

/** Párrafos de una lectura (sin marcado, sin líneas vacías). */
function paragraphsOf(text: string): string[] {
  return text.split(/\n\s*\n|\n/).map((p) => stripMarkdown(p)).filter((p) => wordCount(p) >= 3);
}

function detectTone(level: string | undefined, text: string): EducationTone {
  const t = normalize(`${level ?? ""} ${text.slice(0, 4000)}`);
  if (/\b(primaria|ninos|ninas|infantil|kids|children|preescolar|kinder|elementary)\b/.test(t)) return "kids";
  if (/\b(secundaria|adolescentes|teens?|bachillerato|high school|colegio)\b/.test(t)) return "teen";
  if (/\b(empresa|corporativ|corporate|profesionales|business|oficina)\b/.test(t)) return "corporate";
  if (/\b(universidad|universit|academic|posgrado|master)\b/.test(t)) return "academic";
  if (/\b(adultos|adults)\b/.test(t)) return "professional";
  return "school";
}

/** Parte "Instrucción … Solución: …" */
function splitSolution(text: string): { instruction: string; solution?: string } {
  const m = text.match(/\n?\s*(?:\*\*)?(?:soluci[oó]n|respuesta|answer|solution|clave)s?(?:\*\*)?\s*:\s*([\s\S]+)$/i);
  if (!m) return { instruction: stripMarkdown(text) };
  return { instruction: stripMarkdown(text.slice(0, m.index)), solution: stripMarkdown(m[1]) };
}

/** "• término: definición\n Ejemplo: …" (formato antiguo de "Conceptos clave") */
function parseConceptList(content: string): Array<{ term: string; definition: string; example?: string }> {
  const out: Array<{ term: string; definition: string; example?: string }> = [];
  for (const chunk of content.split(/\n\s*\n|\n(?=\s*[•\-*]\s)/)) {
    const m = chunk.match(/^\s*[•\-*]?\s*([^:\n]{2,60}):\s*([\s\S]+)$/);
    if (!m) continue;
    const { body, example } = splitExample(m[2]);
    out.push({ term: stripMarkdown(m[1]), definition: stripMarkdown(body), example });
  }
  return out;
}

function makeConcept(term: string, definition: string, extra: { example?: string; url?: string } = {}): LessonConcept {
  const lead = splitLeadingEmoji(term);
  const all = sentences(definition);
  return {
    id: semanticId("CONCEPT", lead.text),
    term: capitalize(lead.text.replace(/[:.]+$/, "")),
    definition: all.slice(0, 2).join(" ") || stripMarkdown(definition),
    details: all.slice(2),
    example: extra.example,
    imageUrl: extra.url,
    emoji: lead.emoji ?? emojiFor(lead.text),
  };
}

export function extractLessonContent(input: ExtractInput): LessonContent {
  const plan = input.teacherPlan ?? {};
  const content: LessonContent = {
    lessonId: input.lessonId,
    title: input.title,
    courseTitle: input.courseTitle,
    academyName: input.academyName,
    language: input.language,
    level: input.level,
    tone: "school",
    objectives: [],
    explanation: [],
    concepts: [],
    vocabulary: [],
    categories: [],
    examples: [],
    quizzes: [],
    exercises: [],
    dialogues: [],
    readings: [],
    grammar: [],
    images: [],
    homework: plan.homework || undefined,
    teacherNotes: [...(plan.teacherNotes ?? [])],
    durationMinutes: plan.classFlow?.length
      ? Math.max(...plan.classFlow.map((f) => (f.minute ?? 0) + (f.durationMinutes ?? 0)))
      : undefined,
  };

  if (plan.objective) {
    content.objectives = splitObjectives(plan.objective);
  }

  let n = 0;
  // Capítulo en curso: dentro de "Lectura de comprensión" los textos son la lectura y las preguntas, de comprensión
  let reading: LessonContent["readings"][number] | null = null;
  for (const b of input.blocks) {
    n++;
    const title = stripMarkdown(b.title ?? "").trim();
    const body = b.content ?? "";
    if (b.type === "chapter") {
      reading = RE.reading.test(`${b.label ?? ""} ${title}`)
        ? { id: semanticId("READING", title || `${content.readings.length + 1}`), title: title || "Lectura", paragraphs: [], questions: [], tasks: [] }
        : null;
      if (reading) content.readings.push(reading);
      continue;
    }
    if (!reading && b.type === "text" && RE.reading.test(title) && body.trim()) {
      content.readings.push({ id: semanticId("READING", title), title, paragraphs: paragraphsOf(body), questions: [], tasks: [], imageUrl: b.url });
      continue;
    }
    if (reading) {
      if (b.type === "text" && !RE.vocabulary.test(title) && !/vocabulario de la lectura|reading vocabulary/i.test(title) && body.trim()) {
        if (title && !reading.paragraphs.length && title !== reading.title) reading.title = title;
        reading.paragraphs.push(...paragraphsOf(body));
        if (b.url && !reading.imageUrl) reading.imageUrl = b.url;
        continue;
      }
      if (b.type === "image" && b.url && !reading.imageUrl) {
        reading.imageUrl = b.url;
        continue;
      }
      if (b.type === "quiz" && b.question && (b.options?.length ?? 0) >= 2) {
        reading.questions.push({
          id: semanticId("READING_Q", `${reading.questions.length + 1}`),
          question: stripMarkdown(b.question),
          options: b.options!.map((o) => stripMarkdown(o)).slice(0, 4),
          correctIndex: Math.max(0, Math.min((b.options?.length ?? 1) - 1, b.correctOptionIndex ?? 0)),
          explanation: b.explanation,
        });
        continue;
      }
      if (b.type === "practice" && b.question) {
        reading.tasks.push(stripMarkdown(b.question));
        continue;
      }
    }
    switch (b.type) {
      case "text":
      case "chapter": {
        if (!body.trim() && !title) break;
        if (RE.objectives.test(title)) {
          const items = listItems(body);
          content.objectives.push(...(items.length ? items : splitObjectives(body)).slice(0, 4));
        } else if (RE.examples.test(title)) {
          const items = listItems(body);
          for (const e of items.length ? items : sentences(body)) content.examples.push({ id: semanticId("EXAMPLE", e.slice(0, 30)), text: e });
        } else if (RE.exercise.test(title)) {
          const { instruction, solution } = splitSolution(body);
          const kind = title.match(/\(([^)]+)\)/)?.[1]?.toLowerCase() ?? "practica";
          content.exercises.push({ id: semanticId("ACTIVITY", `${kind}_${n}`), instruction, kind, solution });
        } else if (RE.keyConcepts.test(title) && parseConceptList(body).length >= 2) {
          for (const c of parseConceptList(body)) content.concepts.push(makeConcept(c.term, c.definition, { example: c.example }));
        } else if (RE.grammar.test(title)) {
          const lines = body.split(/\n+/).map((l) => stripMarkdown(l)).filter(Boolean);
          const formula = lines.find((l) => l.includes("+")) ?? lines[0] ?? "";
          content.grammar.push({ id: semanticId("GRAMMAR", title), title, formula, examples: lines.filter((l) => l !== formula).slice(0, 3) });
        } else if (RE.vocabulary.test(title)) {
          for (const item of listItems(body)) {
            const [term, meaning] = item.split(/\s*[:–—-]\s+/, 2);
            if (term) content.vocabulary.push({ id: semanticId("VOCAB", term), term: capitalize(term), meaning, emoji: emojiFor(term) });
          }
        } else if (RE.summary.test(title)) {
          content.teacherNotes.push(stripMarkdown(body));
        } else if (title && !RE.explanation.test(title) && b.type === "text") {
          const { body: def, example } = splitExample(body);
          content.concepts.push(makeConcept(title, def, { example, url: b.url }));
          if (b.url) content.images.push({ url: b.url, caption: title, conceptId: content.concepts[content.concepts.length - 1].id });
        } else {
          content.explanation.push(...sentences(body));
          if (b.url) content.images.push({ url: b.url, caption: title || input.title });
        }
        break;
      }
      case "image":
        if (b.url) content.images.push({ url: b.url, caption: stripMarkdown(b.title || b.content || "") });
        break;
      case "quiz":
        if (b.question && (b.options?.length ?? 0) >= 2) {
          content.quizzes.push({
            id: semanticId("QUIZ", `${content.quizzes.length + 1}`),
            question: stripMarkdown(b.question),
            options: b.options!.map((o) => stripMarkdown(o)).slice(0, 4),
            correctIndex: Math.max(0, Math.min((b.options?.length ?? 1) - 1, b.correctOptionIndex ?? 0)),
            explanation: b.explanation,
          });
        }
        break;
      case "practice":
        if (b.question) content.exercises.push({ id: semanticId("ACTIVITY", `practice_${n}`), instruction: stripMarkdown(b.question), kind: "practica", solution: b.answer });
        break;
      case "flashcards":
        for (const c of b.cards ?? []) {
          if (c.front?.trim()) content.vocabulary.push({ id: semanticId("VOCAB", c.front), term: stripMarkdown(c.front), meaning: stripMarkdown(c.back ?? ""), emoji: emojiFor(c.front) ?? emojiFor(`${c.front} ${c.back}`) });
        }
        break;
      case "dialogue":
        if (b.lines?.length) content.dialogues.push({ id: semanticId("DIALOGUE", `${content.dialogues.length + 1}`), title: title || undefined, lines: b.lines.map((l) => ({ speaker: l.speaker, text: l.text })) });
        break;
      case "mindmap":
        if (b.mindMap?.branches?.length) {
          // Solo es la clasificación del tema si sus ramas son categorías reales; si mezcla
          // "Tipos / Ejemplos / Usos", se descartan esas ramas y, si no quedan 2, no hay clasificación
          const branches = b.mindMap.branches.filter((br) => !META_BRANCH.test(br.label.trim()) && br.children.length);
          if (branches.length >= 2) {
            content.realClassification = true;
            content.mindMapCenter = b.mindMap.center;
            for (const br of branches) {
              content.categories.push({ id: semanticId("CATEGORY", br.label), label: capitalize(stripMarkdown(br.label)), items: br.children.map((c) => capitalize(stripMarkdown(c))).filter(Boolean) });
            }
          }
        }
        break;
      default:
        break;
    }
  }

  deriveVocabulary(content);
  deriveCategories(content);
  content.readings = content.readings.filter((r) => r.paragraphs.length);
  if (!content.readings.length) {
    const composed = composeReading(content);
    if (composed) content.readings.push(composed);
  }
  // Una categoría ("Transporte público") no es una palabra de vocabulario
  const categoryLabels = new Set(content.categories.map((cat) => normalize(cat.label)));
  content.vocabulary = content.vocabulary.filter((v) => !categoryLabels.has(normalize(v.term)) && normalize(v.term) !== normalize(input.title));
  content.tone = detectTone(input.level, [input.title, input.courseTitle, ...content.explanation].join(" "));
  // Si no hay objetivos explícitos se dejan vacíos: el planificador los redacta a partir de los conceptos
  content.objectives = [...new Set(content.objectives)].slice(0, 4);
  return content;
}

/** Los conceptos de nombre corto (1-3 palabras) que no son categorías funcionan como vocabulario visual. */
function deriveVocabulary(c: LessonContent) {
  const known = new Set(c.vocabulary.map((v) => normalize(v.term)));
  // Un concepto que agrupa a otros ("Transporte público: autobús, tren…") es una categoría, no una palabra
  const groups = (concept: LessonConcept) =>
    c.concepts.filter((o) => o !== concept && mentions(`${concept.definition} ${concept.example ?? ""}`, o.term)).length >= 2;
  for (const concept of c.concepts) {
    if (wordCount(concept.term) > 3 || known.has(normalize(concept.term)) || groups(concept)) continue;
    c.vocabulary.push({
      id: semanticId("VOCAB", concept.term),
      term: concept.term,
      meaning: concept.definition,
      emoji: concept.emoji,
      imageUrl: concept.imageUrl,
    });
    known.add(normalize(concept.term));
  }
}

/**
 * Categorías: las del mapa mental, o conceptos que agrupan a otros (su
 * definición o ejemplo menciona 2+ términos del vocabulario).
 */
function deriveCategories(c: LessonContent) {
  if (c.categories.length >= 2) return;
  c.categories = [];
  const terms = c.vocabulary.map((v) => v.term);
  const found: LessonCategory[] = [];
  for (const concept of c.concepts) {
    const text = `${concept.definition} ${concept.example ?? ""} ${concept.details.join(" ")}`;
    const items = terms.filter((t) => normalize(t) !== normalize(concept.term) && mentions(text, t));
    if (items.length >= 2) found.push({ id: semanticId("CATEGORY", concept.term), label: concept.term, items });
  }
  if (found.length >= 2) c.categories = found.slice(0, 4);
}

/**
 * Sin lectura en la lección: se compone una lectura breve con la explicación y
 * las frases de ejemplo (todo es contenido real de la lección, nada inventado),
 * con tareas de lectura sobre su vocabulario.
 */
export function composeReading(c: LessonContent): LessonContent["readings"][number] | null {
  const en = /^en|^ingl/i.test(c.language);
  const examples = [...c.concepts.map((x) => x.example).filter((e): e is string => Boolean(e)), ...c.examples.map((e) => e.text)]
    .map((e) => stripMarkdown(e).replace(/^["“]|["”]$/g, "").trim())
    .filter((e, i, all) => e && all.findIndex((x) => normalize(x) === normalize(e)) === i)
    .map((e) => (/[.!?]$/.test(e) ? e : `${e}.`));
  if (examples.length < 3) return null;
  const intro = c.explanation[0] ?? c.concepts[0]?.definition;
  const first = examples.slice(0, Math.ceil(examples.length / 2));
  const second = examples.slice(Math.ceil(examples.length / 2));
  const paragraphs = [[intro, ...first].filter(Boolean).join(" "), second.join(" ")].filter((p) => wordCount(p) >= 5);
  const words = c.vocabulary.slice(0, 5).map((v) => v.term.toLowerCase());
  const tasks = en
    ? ["Read the text aloud with a partner.", words.length ? `Underline these words: ${words.join(", ")}.` : "Underline the key words.", "Which sentence describes you? Why?"]
    : ["Lee el texto en voz alta con tu compañero.", words.length ? `Subraya estas palabras: ${words.join(", ")}.` : "Subraya las palabras clave.", "¿Qué frase se parece a tu vida? ¿Por qué?"];
  return {
    id: semanticId("READING", c.title),
    title: en ? `Reading: ${c.title}` : `Lectura: ${c.title}`,
    paragraphs,
    questions: [],
    tasks,
    composed: true,
  };
}

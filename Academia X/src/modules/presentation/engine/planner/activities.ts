import type { ActivityKind, LessonContent, SlideContentBlock, SlidePlan } from "../types";
import { labels } from "../i18n";
import { emojiFor } from "../icons";
import { condense, mentions, normalize, seededRandom } from "../text";

/**
 * Constructores de actividades a partir del contenido REAL de la lección.
 * Los usa el planificador interno y también sirven para completar
 * actividades que la IA dejó a medias (consigna sin elementos).
 */

type Blocks = SlideContentBlock[];

function shuffle<T>(list: T[], seed: string): T[] {
  const rnd = seededRandom(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Relacionar: palabra ↔ categoría (si todas tienen una) o ↔ significado breve. */
export function matchingBlocks(c: LessonContent, prompt?: string): Blocks | null {
  const vocab = c.vocabulary;
  if (vocab.length < 3) return null;
  const withMeaning = vocab.filter((v) => v.meaning);
  const categoryOf = (term: string) => c.categories.find((cat) => cat.items.some((i) => normalize(i) === normalize(term)))?.label;
  // Con categorías, una palabra de cada categoría: las respuestas tienen que ser distintas
  const onePerCategory = c.categories
    .map((cat) => vocab.find((v) => categoryOf(v.term) === cat.label))
    .filter((v): v is (typeof vocab)[number] => Boolean(v))
    .slice(0, 4);
  const useCategories = onePerCategory.length >= 3;
  const items = useCategories ? onePerCategory : (withMeaning.length >= 3 ? withMeaning : vocab).slice(0, 4);
  if (!useCategories && withMeaning.length < 3) return null;
  const right = items.map((v) => (useCategories ? categoryOf(v.term)! : condense(v.meaning ?? "", 10)));
  let order = shuffle(right.map((_, i) => i), `${c.title}:match`);
  if (order.every((o, i) => o === i) && order.length > 1) order = [...order.slice(1), order[0]];
  return [
    { kind: "text", text: prompt ?? labels(c.language).matchingPrompt },
    { kind: "pairs", left: items.map((v) => v.term), leftEmoji: items.map((v) => v.emoji ?? emojiFor(v.term) ?? ""), right: order.map((o) => right[o]), answers: order },
  ];
}

/** Clasificar: palabras de la lección en las categorías de su clasificación. */
export function classifyBlocks(c: LessonContent, prompt?: string): Blocks | null {
  if (!c.realClassification || c.categories.length < 2) return null;
  const cats = c.categories.slice(0, 3);
  const words = shuffle(cats.flatMap((cat) => cat.items.slice(0, 3)), `${c.title}:classify`);
  if (words.length < 3) return null;
  return [
    { kind: "text", text: prompt ?? labels(c.language).classifyPrompt },
    { kind: "columns", columns: cats.map((cat) => ({ heading: cat.label, emoji: emojiFor(cat.label), items: [] })) },
    { kind: "bullets", items: words.map((w) => `${emojiFor(w) ?? ""} ${w}`.trim()) },
  ];
}

/** Completar: frases de ejemplo de la lección con la palabra clave en blanco. */
export function fillBlankBlocks(c: LessonContent): Blocks | null {
  const sources = [...c.concepts.map((x) => x.example).filter((e): e is string => Boolean(e)), ...c.examples.map((e) => e.text)];
  const blanks: Blocks = [];
  for (const sentence of sources) {
    const term = c.vocabulary.find((v) => mentions(sentence, v.term));
    if (!term) continue;
    const re = new RegExp(`\\b${term.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w*`, "i");
    if (!re.test(sentence)) continue;
    blanks.push({ kind: "blank", sentence: condense(sentence.replace(re, "______"), 16), answer: term.term });
    if (blanks.length >= 3) break;
  }
  return blanks.length >= 2 ? blanks : null;
}

/** Verdadero o falso con las definiciones de la lección (una afirmación falsa cruza definiciones). */
export function trueFalseBlocks(c: LessonContent): Blocks | null {
  const picks = c.concepts.slice(0, 3);
  if (picks.length < 3) return null;
  return [{
    kind: "statements",
    items: picks.map((x, i) => ({ text: `${x.term}: ${condense(i === 1 ? picks[2].definition : x.definition, 9)}`, isTrue: i !== 1 })),
  }];
}

/** Opción múltiple: adivinar la palabra a partir de su significado. */
export function vocabQuizBlocks(c: LessonContent): Blocks | null {
  const withMeaning = c.vocabulary.filter((v) => v.meaning);
  if (withMeaning.length < 4) return null;
  const target = withMeaning[0];
  const options = shuffle([target, ...withMeaning.slice(1, 4)], `${c.title}:quiz`);
  return [
    { kind: "question", text: condense(target.meaning!, 14) },
    { kind: "options", options: options.map((o) => o.term), correctIndex: options.indexOf(target) },
  ];
}

const INTENT: Array<[RegExp, ActivityKind]> = [
  [/relacion|asocia|une |unir|empareja|match|connect|link/i, "matching"],
  [/clasific|agrupa|ordena en grupos|classify|sort|group/i, "classify"],
  [/complet|rellena|hueco|fill|gap|blank/i, "fill_blank"],
  [/verdadero|falso|true|false/i, "true_false"],
  [/elige|escoge|selecciona|opci[oó]n correcta|choose|select|which/i, "multiple_choice"],
];

const HAS: Record<string, (b: SlideContentBlock[]) => boolean> = {
  matching: (b) => b.some((x) => x.kind === "pairs"),
  classify: (b) => b.some((x) => x.kind === "columns") && b.some((x) => x.kind === "bullets"),
  fill_blank: (b) => b.some((x) => x.kind === "blank"),
  true_false: (b) => b.some((x) => x.kind === "statements"),
  multiple_choice: (b) => b.some((x) => x.kind === "options"),
};

/**
 * Completa una actividad incompleta (consigna sin elementos) con contenido
 * real de la lección. Devuelve null si no se puede: la diapositiva se descarta
 * antes que mostrar un ejercicio vacío.
 */
export function completeActivity(slide: SlidePlan, c: LessonContent): SlidePlan | null {
  const instruction = slide.contentBlocks.find((b): b is Extract<SlideContentBlock, { kind: "text" | "question" }> => b.kind === "text" || b.kind === "question")?.text;
  const intent = slide.activity ?? INTENT.find(([re]) => re.test(`${slide.title} ${instruction ?? ""}`))?.[1];
  if (!intent || !HAS[intent]) return slide;
  if (HAS[intent](slide.contentBlocks)) return { ...slide, activity: intent };
  const built =
    intent === "matching" ? matchingBlocks(c, instruction)
    : intent === "classify" ? classifyBlocks(c, instruction)
    : intent === "fill_blank" ? fillBlankBlocks(c)
    : intent === "true_false" ? trueFalseBlocks(c)
    : vocabQuizBlocks(c);
  if (!built) return null;
  return { ...slide, activity: intent, contentBlocks: built, speakerNotes: [...slide.speakerNotes, "Actividad completada con el contenido de la lección."] };
}

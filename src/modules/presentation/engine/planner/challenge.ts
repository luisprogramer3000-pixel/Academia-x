import type { LessonChallenge, LessonContent, SlideContentBlock, SlidePlan } from "../types";
import { normalize } from "../text";
import { missingMaterial } from "@/modules/ai/exercise-integrity";

/**
 * Reto práctico (situación-problema) en la presentación: se proyecta COMPLETO
 * en una sola diapositiva —escenario, misión, pistas, imagen de la lección y
 * la pregunta con sus opciones— o no se proyecta. Una pregunta suelta como
 * "¿Dónde crees que está escondido el objeto?" sin el escenario no se entiende.
 *
 * Antes de proyectar se revisa además cada actividad: la que depende de un
 * material que no está en la diapositiva se descarta (la clase sigue con
 * conceptos y vocabulario).
 */

/** Límites para que el reto quepa legible en una diapositiva */
const MAX_SCENE_WORDS = 110;
const MAX_QUESTION_WORDS = 25;
const MAX_OPTION_WORDS = 8;

const words = (s: string) => (s.match(/\S+/g) ?? []).length;

/** Elige la pregunta del reto que se entiende sin el diálogo (no nombra a sus personajes). */
function pickQuestion(ch: LessonChallenge) {
  const speakers = [...new Set(ch.dialogue.map((l) => normalize(l.speaker)).filter(Boolean))];
  return ch.questions.find((q) =>
    words(q.question) <= MAX_QUESTION_WORDS &&
    q.options.length >= 2 && q.options.length <= 4 &&
    q.options.every((o) => words(o) <= MAX_OPTION_WORDS) &&
    !speakers.some((s) => normalize(q.question).includes(s))
  );
}

/** Diapositiva del reto completo, o null si no cabe entero. */
export function challengeSlide(ch: LessonChallenge, lang: "es" | "en"): SlidePlan | null {
  const q = pickQuestion(ch);
  if (!q || !ch.scenario.length) return null;
  const sceneWords = words([...ch.scenario, ch.mission ?? "", ...ch.clues].join(" "));
  if (sceneWords > MAX_SCENE_WORDS) return null;
  const blocks: SlideContentBlock[] = [
    { kind: "passage", title: ch.title, paragraphs: [...ch.scenario, ...(ch.mission ? [ch.mission] : [])] },
    ...(ch.clues.length ? [{ kind: "bullets", items: ch.clues } as SlideContentBlock] : []),
    { kind: "question", text: q.question },
    { kind: "options", options: q.options, correctIndex: q.correctIndex },
  ];
  return {
    id: `challenge_${ch.id}`,
    order: 0,
    pedagogicalRole: "hook",
    title: ch.title,
    mainIdea: q.question,
    contentBlocks: blocks,
    visualIntent: "Reto: escenario con su imagen, misión, pistas y la pregunta con opciones",
    preferredLayouts: ["CHALLENGE_SCENE"],
    visualAssetRequests: [{ type: "photo", semanticQuery: `${ch.title}: ${ch.scenario[0].slice(0, 120)}`, label: ch.title, purpose: "example", importance: 0.95, preferredUrl: ch.imageUrl, emoji: "🧩" }],
    speakerNotes: [
      `✓ ${q.options[q.correctIndex]}`,
      q.explanation ?? "",
      ...(ch.dialogue.length ? [(lang === "en" ? "Dialogue: " : "Diálogo: ") + ch.dialogue.map((l) => `${l.speaker}: ${l.text}`).join(" / ")] : []),
    ].filter(Boolean),
    covers: [ch.id, q.id],
    importance: 5,
  };
}

const ACTIVITY_ROLES = new Set(["hook", "practice", "production", "reflection", "quiz", "assessment", "exit_ticket"]);

/** Texto de la pregunta de una diapositiva de actividad. */
function questionOf(s: SlidePlan): string | undefined {
  return s.contentBlocks.find((b): b is Extract<SlideContentBlock, { kind: "question" }> => b.kind === "question")?.text;
}

/**
 * Revisa la secuencia antes de proyectarla: pone el reto completo como
 * activación (si cabe) y quita las actividades que dependen de un material
 * ausente (las preguntas del reto fuera de su escenario, "lee el párrafo" sin
 * párrafo, "observa la imagen" sin imagen…).
 */
export function applyChallenge(slides: SlidePlan[], content: LessonContent): SlidePlan[] {
  const lang = /^en|^ingl/i.test(content.language) ? "en" : "es";
  const challenges = content.challenges ?? [];
  const challengeQuestions = new Set(challenges.flatMap((c) => c.questions.map((q) => normalize(q.question))));
  const readingAvailable = content.readings.length > 0 || slides.some((s) => s.contentBlocks.some((b) => b.kind === "passage"));

  const kept = slides.filter((s) => {
    if (!ACTIVITY_ROLES.has(s.pedagogicalRole) || s.contentBlocks.some((b) => b.kind === "passage")) return true;
    const q = questionOf(s);
    if (!q) return true;
    if (challengeQuestions.has(normalize(q))) return false;
    return !missingMaterial(q, { readingAvailable });
  });

  const scene = challenges.map((c) => challengeSlide(c, lang)).find(Boolean);
  if (!scene) return kept;
  // El reto es la activación: sustituye a la pregunta de activación genérica
  const withoutHook = kept.filter((s) => s.pedagogicalRole !== "hook");
  const at = withoutHook.findIndex((s) => s.pedagogicalRole !== "cover");
  withoutHook.splice(at < 0 ? withoutHook.length : at, 0, scene);
  return withoutHook;
}

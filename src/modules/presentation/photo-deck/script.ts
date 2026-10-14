import { z } from "zod";
import type { LessonContent, PresentationPlan, SlideContentBlock, SlidePlan } from "../engine/types";

/**
 * Presentación "foto + texto" (modelo mixto por diapositiva): una fotografía
 * generada con IA ocupa la mitad derecha y el texto va en cajas reales de
 * PowerPoint (exacto, editable y buscable). El guion lo escribe la IA, lo
 * revisa el profesor y solo después se generan las fotos.
 */

export const SLIDE_TYPES = [
  "cover", "objectives", "concept", "classification", "vocabulary", "grammar", "dialogue", "reading", "exercise",
] as const;
export type ScriptSlideType = (typeof SLIDE_TYPES)[number];

export const SLIDE_TYPE_LABELS: Record<ScriptSlideType, string> = {
  cover: "Portada",
  objectives: "Objetivos",
  concept: "Concepto",
  classification: "Clasificación",
  vocabulary: "Vocabulario",
  grammar: "Gramática",
  dialogue: "Diálogo",
  reading: "Lectura",
  exercise: "Ejercicio",
};

/** Foto realista (Flux 1.1 Pro, 2 créditos) o económica (Flux Schnell, 1 crédito). */
export type PhotoQuality = "realistic" | "economic";

export const PHOTO_CREDITS: Record<PhotoQuality, number> = { realistic: 2, economic: 1 };
/** Escribir el guion (operación LESSON_GENERATION) */
export const SCRIPT_CREDITS = 2;
/** Cambiar una foto ya generada (operación IMAGE_GENERATION) */
export const PHOTO_CHANGE_CREDITS = 1;

export const scriptSlideSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(SLIDE_TYPES),
  title: z.string().trim().max(140),
  /** Texto visible. **palabra** = resaltada con el color de la academia */
  text: z.string().max(1600).default(""),
  /** Lista numerada / viñetas / preguntas (una por línea) */
  items: z.array(z.string().max(260)).max(14).default([]),
  /** Descripción de la fotografía (quién, qué hace, dónde, luz) */
  imagePrompt: z.string().trim().max(700).default(""),
  photo: z.enum(["realistic", "economic"]).default("realistic"),
  /** Notas del orador (respuestas de los ejercicios, indicaciones) */
  notes: z.string().max(4000).default(""),
  imageUrl: z.string().max(400).optional(),
  /** "lesson": imagen que ya tenía la lección (gratis); "ai": foto generada */
  imageSource: z.enum(["lesson", "ai"]).optional(),
});
export type ScriptSlide = z.infer<typeof scriptSlideSchema>;

export const deckScriptSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slides: z.array(scriptSlideSchema).min(1).max(30),
});
export type DeckScript = z.infer<typeof deckScriptSchema>;

export const newSlideId = () => `s${Math.random().toString(36).slice(2, 10)}`;

/** Lectura y ejercicios llevan foto económica; el resto, realista. */
export const defaultPhotoFor = (type: ScriptSlideType): PhotoQuality =>
  type === "reading" || type === "exercise" || type === "objectives" || type === "grammar" ? "economic" : "realistic";

/** Créditos de las fotos que faltan por generar. */
/** Imágenes que se pueden reutilizar sin generar (de la plataforma o https). */
const reusable = (url?: string): url is string => Boolean(url && (url.startsWith("/api/uploads/") || /^https:\/\//.test(url)));

export function photosCost(slides: ScriptSlide[]): number {
  return slides.filter((s) => !s.imageUrl).reduce((acc, s) => acc + PHOTO_CREDITS[s.photo], 0);
}

// ─── Del plan pedagógico al guion ────────────────────────────────────────────

const ROLE_TO_TYPE: Partial<Record<SlidePlan["pedagogicalRole"], ScriptSlideType>> = {
  cover: "cover",
  objectives: "objectives",
  hook: "concept",
  explanation: "concept",
  concept: "concept",
  example: "concept",
  comparison: "classification",
  process: "concept",
  mind_map: "classification",
  vocabulary: "vocabulary",
  grammar: "grammar",
  dialogue: "dialogue",
  reading: "reading",
  practice: "exercise",
  production: "exercise",
  reflection: "exercise",
  quiz: "exercise",
  assessment: "exercise",
  exit_ticket: "exercise",
  // summary: se quita (decisión de la academia)
};

const LETTERS = "abcdefgh";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Bloques del plan → texto visible, lista y respuestas (para las notas). */
function blocksToText(blocks: SlideContentBlock[]) {
  const text: string[] = [];
  const items: string[] = [];
  const answers: string[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "heading":
      case "text":
      case "example":
        text.push(b.text);
        break;
      case "note":
        text.push(b.label ? `**${b.label}:** ${b.text}` : b.text);
        break;
      case "bullets":
        items.push(...b.items);
        break;
      case "item":
        items.push(b.detail ? `**${b.term}**: ${b.detail}` : `**${b.term}**`);
        break;
      case "table":
        items.push(...b.rows.map((r) => r.map((c, i) => (i === 0 ? `**${c}**` : c)).join(" · ")));
        break;
      case "columns":
        items.push(...b.columns.map((c) => `**${c.heading}**: ${c.items.join(", ")}`));
        break;
      case "tree":
        if (b.center) text.push(`**${b.center}**`);
        items.push(...b.branches.map((br) => `**${br.label}**: ${br.children.join(", ")}`));
        break;
      case "steps":
        items.push(...b.steps.map((s) => (s.text ? `**${s.heading}**: ${s.text}` : `**${s.heading}**`)));
        break;
      case "formula":
        text.push(`**${b.parts.join(" + ")}**${b.result ? ` = ${b.result}` : ""}`);
        items.push(...b.examples);
        break;
      case "dialogue":
        items.push(...b.lines.map((l) => `**${l.speaker}:** ${l.text}`));
        break;
      case "question":
        items.push(b.text);
        break;
      case "options":
        items.push(b.options.map((o, i) => `${LETTERS[i]}) ${o}`).join("   "));
        if (b.correctIndex !== undefined && b.options[b.correctIndex]) answers.push(`Respuesta: ${LETTERS[b.correctIndex]}) ${b.options[b.correctIndex]}`);
        break;
      case "blank":
        items.push(b.sentence.includes("___") ? b.sentence : `${b.sentence} ______`);
        if (b.answer) answers.push(`${b.sentence.replace(/_{2,}/g, b.answer)}`);
        break;
      case "statements":
        items.push(...b.items.map((s) => `${s.text}  (V / F)`));
        answers.push(...b.items.filter((s) => s.isTrue !== undefined).map((s, i) => `${i + 1}. ${s.isTrue ? "Verdadero" : "Falso"}`));
        break;
      case "pairs":
        items.push(...b.left.map((l, i) => `${i + 1}. ${l}   →   ${LETTERS[i]}) ${b.right[i] ?? ""}`));
        answers.push(...b.answers.map((a, i) => `${i + 1} → ${LETTERS[a]}) ${b.right[a] ?? ""}`));
        break;
      case "passage":
        text.push(...b.paragraphs);
        break;
    }
  }
  return { text: text.map(clean).filter(Boolean), items: items.map(clean).filter(Boolean), answers };
}

/**
 * Convierte el plan del motor (objetivos reales, clasificación real, lectura y
 * ejercicios completos) en el guion editable. Sin diapositiva de resumen.
 */
export function planToScript(plan: PresentationPlan, content: LessonContent, target?: number): DeckScript {
  const slides: ScriptSlide[] = [];
  /** Imágenes de la lección que el plan sugiere para cada diapositiva */
  const suggested = new Map<string, string[]>();
  for (const s of [...plan.slides].sort((a, b) => a.order - b.order)) {
    const type = ROLE_TO_TYPE[s.pedagogicalRole];
    if (!type) continue;
    const { text, items, answers } = blocksToText(s.contentBlocks);
    const request = s.visualAssetRequests[0];
    let slideText = text.join("\n\n");
    let slideItems = items;

    if (type === "cover") {
      slideText = [content.level ? `Nivel ${content.level}` : "", content.courseTitle ?? ""].filter(Boolean).join(" · ");
      slideItems = [];
    } else if (type === "objectives" && !slideItems.length) {
      slideItems = plan.learningObjectives;
    } else if (!slideText && s.mainIdea && type !== "reading") {
      slideText = s.mainIdea;
    }

    const notes = [...s.speakerNotes, ...(answers.length ? ["", "RESPUESTAS:", ...answers] : [])].filter((l, i, a) => l || a[i - 1]).join("\n");
    const id = newSlideId();
    suggested.set(id, [
      ...s.visualAssetRequests.map((r) => r.preferredUrl),
      ...s.contentBlocks.map((b) => (b.kind === "item" ? b.imageUrl : undefined)),
      ...(type === "reading" ? content.readings.map((r) => r.imageUrl) : []),
    ].filter(reusable));
    slides.push({
      id,
      type,
      title: clean(type === "cover" ? plan.title || content.title : s.title).slice(0, 140),
      text: slideText.slice(0, 1600),
      items: slideItems.slice(0, 14).map((i) => i.slice(0, 260)),
      imagePrompt: clean(request?.semanticQuery || s.visualIntent || s.title).slice(0, 700),
      photo: defaultPhotoFor(type),
      notes: notes.slice(0, 4000),
    });
  }
  useRealComprehension(slides, content);
  const kept = target ? trimSlides(slides, target) : slides;
  return { title: clean(plan.title || content.title).slice(0, 160), slides: reuseLessonImages(kept, suggested, content) };
}

/**
 * Las imágenes que ya tiene la lección se reutilizan antes de generar nada:
 * primero la que el plan sugiere para cada diapositiva y después las que
 * sobren, empezando por la portada. Solo las diapositivas que se quedan sin
 * imagen cuestan créditos (y el profesor puede pedir una foto nueva si quiere).
 */
function reuseLessonImages(slides: ScriptSlide[], suggested: Map<string, string[]>, content: LessonContent): ScriptSlide[] {
  const used = new Set<string>();
  const out = slides.map((s) => {
    const url = (suggested.get(s.id) ?? []).find((u) => !used.has(u));
    if (!url) return s;
    used.add(url);
    return { ...s, imageUrl: url, imageSource: "lesson" as const };
  });
  const pool = [
    ...content.images.map((i) => i.url),
    ...content.concepts.map((c) => c.imageUrl),
    ...content.vocabulary.map((v) => v.imageUrl),
    ...content.readings.map((r) => r.imageUrl),
  ].filter((u): u is string => reusable(u) && !used.has(u));
  const leftovers = [...new Set(pool)];
  // La portada primero; luego en orden
  const order = [...out.keys()].sort((a, b) => Number(out[b].type === "cover") - Number(out[a].type === "cover") || a - b);
  for (const i of order) {
    if (!leftovers.length) break;
    if (out[i].imageUrl) continue;
    out[i] = { ...out[i], imageUrl: leftovers.shift(), imageSource: "lesson" };
  }
  return out;
}

/** "Lee el texto", "Subraya…": instrucciones genéricas, no preguntas sobre la lectura. */
const GENERIC_TASK = /^(lee|leer|vuelve a leer|subraya|responde|contesta|escucha|observa|comenta)\b/i;

/**
 * Bajo la lectura van preguntas de comprensión reales: si el planificador solo
 * dejó tareas genéricas, se usan las preguntas de la lección o las del ejercicio
 * de comprensión (que se elimina si solo repetía esas preguntas).
 */
function useRealComprehension(slides: ScriptSlide[], content: LessonContent) {
  const reading = slides.find((s) => s.type === "reading");
  if (!reading || (reading.items.length && !reading.items.every((i) => GENERIC_TASK.test(i.replace(/^\d+[.)]\s*/, ""))))) return;
  const fromLesson = content.readings[0]?.questions.map((q) => q.question).filter(Boolean) ?? [];
  if (fromLesson.length) {
    reading.items = fromLesson.slice(0, 5);
    return;
  }
  const at = slides.indexOf(reading);
  const quiz = slides.slice(at + 1).find((s) => s.type === "exercise" && s.items.some((i) => i.includes("?")));
  if (!quiz) return;
  const questions = quiz.items.filter((i) => i.includes("?") && !/^[a-h]\)/.test(i));
  if (!questions.length) return;
  reading.items = questions.slice(0, 5);
  // El ejercicio solo eran esas preguntas: no se repite (sus respuestas pasan a las notas de la lectura)
  if (quiz.items.every((i) => questions.includes(i)) && /comprensi/i.test(quiz.title)) {
    reading.notes = [reading.notes, quiz.notes].filter(Boolean).join("\n\n");
    slides.splice(slides.indexOf(quiz), 1);
  }
}

/**
 * Recorta a `target` diapositivas sin perder lo que la academia pidió mantener:
 * portada, objetivos, lectura, al menos 3 ejercicios y la clasificación real.
 * Sale primero lo repetido (segundo bloque de vocabulario, de ejemplos…).
 */
export function trimSlides(slides: ScriptSlide[], target: number): ScriptSlide[] {
  if (slides.length <= target) return slides;
  const seen = new Map<ScriptSlideType, number>();
  const scored = slides.map((s, index) => {
    const n = (seen.get(s.type) ?? 0) + 1;
    seen.set(s.type, n);
    const base: Record<ScriptSlideType, number> = {
      cover: 100, reading: 96, objectives: 92, exercise: 88, classification: 84, vocabulary: 78, grammar: 74, concept: 72, dialogue: 64,
    };
    let score = base[s.type];
    if (s.type === "exercise") score = n <= 3 ? 88 - n : 40 - n;
    else if (s.type !== "cover" && s.type !== "objectives" && n > 1) score = 50 - n * 4;
    return { s, index, score };
  });
  const keep = new Set(
    [...scored].sort((a, b) => b.score - a.score || a.index - b.index).slice(0, target).map((x) => x.index)
  );
  return scored.filter((x) => keep.has(x.index)).map((x) => x.s);
}

// ─── Prompt de la fotografía ─────────────────────────────────────────────────

/**
 * Bloque de estilo fijo para todas las fotos de la presentación: así se ven de
 * la misma serie. Sin texto dentro de la imagen (el texto va en PowerPoint).
 */
export function photoPrompt(slide: ScriptSlide, ctx: { topic: string; tone?: string }): string {
  const kids = ctx.tone === "kids";
  return [
    slide.imagePrompt || slide.title,
    `Tema de la clase: ${ctx.topic}.`,
    kids
      ? "Fotografía realista y alegre para niños, colores vivos pero naturales."
      : "Fotografía editorial realista y profesional, como de revista educativa.",
    "Luz natural cálida, nitidez alta, profundidad de campo suave, fondo limpio y ordenado.",
    slide.type === "cover"
      ? "Composición horizontal amplia con espacio despejado a la izquierda."
      : "Composición vertical con el sujeto principal centrado.",
    "Personas diversas y naturales si aparecen. Sin texto, letras, números, carteles, logotipos ni marcas de agua.",
  ].join(" ");
}

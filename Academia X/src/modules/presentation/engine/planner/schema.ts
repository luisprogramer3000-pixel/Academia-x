import { z } from "zod";

/**
 * Esquema de la salida del planificador con IA. La respuesta del modelo nunca
 * se usa sin pasar por aquí: tamaños, enums, número de diapositivas y de
 * bloques quedan acotados. El modelo NO da coordenadas ni estilos.
 */

const s = (max: number) => z.string().trim().min(1).max(max);
const short = s(120);
const line = s(240);

export const ROLES = [
  "cover", "hook", "objectives", "explanation", "concept", "vocabulary", "grammar", "example", "comparison", "process",
  "mind_map", "dialogue", "practice", "production", "reflection", "quiz", "assessment", "summary", "exit_ticket", "reading",
] as const;

export const ACTIVITIES = ["matching", "multiple_choice", "true_false", "fill_blank", "speaking", "classify", "ordering", "guess"] as const;

export const BlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: line }),
  z.object({ kind: z.literal("bullets"), items: z.array(short).min(1).max(5) }),
  z.object({ kind: z.literal("item"), term: short, detail: s(140).optional(), emoji: z.string().max(16).optional(), refId: z.string().max(60).optional(), translation: s(160).optional(), imageQuery: s(160).optional() }),
  z.object({ kind: z.literal("table"), headers: z.array(s(40)).min(2).max(5), rows: z.array(z.array(z.string().trim().max(60)).min(1).max(5)).min(1).max(7) }),
  z.object({ kind: z.literal("note"), label: s(40).optional(), text: s(300) }),
  z.object({ kind: z.literal("example"), text: line }),
  z.object({ kind: z.literal("question"), text: line }),
  z.object({ kind: z.literal("options"), options: z.array(short).min(2).max(4), correctIndex: z.number().int().min(0).max(3) }),
  z.object({
    kind: z.literal("pairs"),
    left: z.array(short).min(2).max(5),
    right: z.array(short).min(2).max(5),
    answers: z.array(z.number().int().min(0).max(4)).min(2).max(5),
    leftEmoji: z.array(z.string().max(16)).max(5).optional(),
  }),
  z.object({ kind: z.literal("columns"), columns: z.array(z.object({ heading: short, emoji: z.string().max(16).optional(), items: z.array(short).max(5) })).min(2).max(3) }),
  z.object({ kind: z.literal("steps"), steps: z.array(z.object({ heading: short, text: s(160).optional() })).min(2).max(5) }),
  z.object({
    kind: z.literal("tree"),
    center: short,
    branches: z.array(z.object({ label: short, emoji: z.string().max(16).optional(), children: z.array(short).max(4) })).min(2).max(4),
  }),
  z.object({ kind: z.literal("formula"), parts: z.array(s(60)).min(1).max(5), examples: z.array(line).max(4), result: s(80).optional() }),
  z.object({ kind: z.literal("dialogue"), lines: z.array(z.object({ speaker: s(40), text: line })).min(2).max(6) }),
  z.object({ kind: z.literal("blank"), sentence: line, answer: short.optional() }),
  z.object({ kind: z.literal("statements"), items: z.array(z.object({ text: line, isTrue: z.boolean() })).min(2).max(4) }),
  z.object({ kind: z.literal("passage"), title: s(120).optional(), paragraphs: z.array(s(900)).min(1).max(4) }),
]);

export const LlmSlideSchema = z.object({
  role: z.enum(ROLES),
  activity: z.enum(ACTIVITIES).optional(),
  title: s(90),
  mainIdea: z.string().trim().max(200).default(""),
  // Vocabulario y tarjetas usan un bloque "item" por elemento
  blocks: z.array(BlockSchema).max(9).default([]),
  visualIntent: z.string().trim().max(200).default(""),
  /** Qué debe mostrar la imagen (en el idioma de la clase). Sin coordenadas. */
  imageQuery: z.string().trim().max(120).optional(),
  emoji: z.string().max(16).optional(),
  notes: z.array(z.string().trim().max(500)).max(6).default([]),
  covers: z.array(z.string().max(60)).max(12).default([]),
  importance: z.number().int().min(1).max(5).default(3),
});

export const PresentationPlanSchema = z.object({
  title: s(120),
  objectives: z.array(short).min(1).max(4),
  /** Lengua materna del alumnado para traducciones (opcional) */
  translationLanguage: z.string().trim().max(30).optional(),
  slides: z.array(LlmSlideSchema).min(6).max(32),
});

export type LlmPresentationPlan = z.infer<typeof PresentationPlanSchema>;
export type LlmSlide = z.infer<typeof LlmSlideSchema>;

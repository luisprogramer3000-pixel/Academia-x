import { normalizeMaterial, type ClassMaterialKind, type ClassPlanMaterial } from "./class-plan.schema";
import { bilingualRules, CONSISTENCY_RULES, DIALOGUE_RULES, readingRules, VOCABULARY_RULES } from "./reading-guidance";
import { SELF_CONTAINED_RULE } from "./exercise-integrity";

/**
 * Herramientas IA sueltas: cada una genera UN material listo para usar
 * (quiz, examen, flashcards, rúbrica...). Todas comparten el formato de
 * material del plan de clase, así se ven, imprimen, proyectan y convierten
 * en lección con los mismos componentes.
 */

export type MaterialToolId =
  | "quiz" | "examen" | "flashcards" | "rubrica" | "lectura" | "apuntes" | "reto" | "conversacion";

export interface MaterialTool {
  id: MaterialToolId;
  kind: ClassMaterialKind;
  name: string;
  emoji: string;
  description: string;
  /** Qué se le pide al modelo, concreto y con cantidades */
  instructions: (count: number, grade?: string) => string;
  countLabel: string;
  defaultCount: number;
  maxCount: number;
  liveQuiz?: boolean;
}

export const MATERIAL_TOOLS: MaterialTool[] = [
  {
    id: "quiz", kind: "quiz", name: "Quiz interactivo", emoji: "🎲", liveQuiz: true,
    description: "Preguntas de opción múltiple para repasar o jugar en vivo con la clase.",
    countLabel: "Preguntas", defaultCount: 10, maxCount: 20,
    instructions: (n) => `Genera ${n} preguntas de opción múltiple con 4 opciones cada una, dificultad progresiva (fácil → difícil), distractores plausibles basados en errores reales de los alumnos y una explicación breve por pregunta. "sections" y "cards" vacíos.`,
  },
  {
    id: "examen", kind: "ejercicios", name: "Examen / Hoja de ejercicios", emoji: "📝", liveQuiz: true,
    description: "Evaluación mixta con opción múltiple y preguntas abiertas, con clave de respuestas.",
    countLabel: "Preguntas", defaultCount: 12, maxCount: 25,
    instructions: (n) => `Genera un examen de ${n} preguntas: alrededor del 60% de opción múltiple (4 opciones) y el resto abiertas (completar huecos, transformar, redactar). Incluye "answer" con la respuesta modelo en todas. Añade 1 sección con las instrucciones generales del examen y los criterios de puntuación. "cards" vacío.`,
  },
  {
    id: "flashcards", kind: "flashcards", name: "Flashcards", emoji: "🃏",
    description: "Tarjetas de repaso con término y significado o ejemplo.",
    countLabel: "Tarjetas", defaultCount: 16, maxCount: 40,
    instructions: (n) => `Genera ${n} flashcards. "front": término, expresión o pregunta breve. "back": significado claro + un ejemplo de uso. "sections" y "questions" vacíos.`,
  },
  {
    id: "rubrica", kind: "rubrica", name: "Rúbrica de evaluación", emoji: "📊",
    description: "Criterios y niveles de desempeño para evaluar una tarea o producción.",
    countLabel: "Criterios", defaultCount: 5, maxCount: 8,
    instructions: (n) => `Genera una rúbrica con ${n} criterios. Sección 1: "Rúbrica" cuyo "body" es una tabla con pipes: | Criterio | Excelente (4) | Bueno (3) | Suficiente (2) | Insuficiente (1) |, con descriptores observables y concretos en cada celda. Sección 2: "Cómo puntuar" con la escala final y consejos para dar feedback. "questions" y "cards" vacíos.`,
  },
  {
    id: "lectura", kind: "lectura", name: "Lectura comprensiva", emoji: "📖", liveQuiz: true,
    description: "Texto original adaptado al nivel con preguntas de comprensión.",
    countLabel: "Preguntas", defaultCount: 6, maxCount: 12,
    instructions: (n, grade = "") =>
      `Sección 1: el texto, con título o titular en "heading" y los párrafos en "body". ${readingRules(grade)} ` +
      `Sección 2: "Vocabulario del texto" con la tabla de vocabulario en "body" (palabras tomadas del texto). ${VOCABULARY_RULES} ` +
      `Después ${n} preguntas de comprensión (idea principal, detalles, inferencia, vocabulario en contexto y opinión; mezcla de opción múltiple y abiertas, todas con "answer"). "cards" vacío.`,
  },
  {
    id: "apuntes", kind: "resumen", name: "Apuntes / Resumen del tema", emoji: "📘",
    description: "Explicación teórica completa con reglas, tablas, ejemplos y errores comunes.",
    countLabel: "Secciones", defaultCount: 6, maxCount: 10,
    instructions: (n) => `Genera ${n} secciones de apuntes: introducción, reglas o conceptos con tablas en pipes cuando ayuden, ejemplos en contexto, errores frecuentes con su corrección y un resumen final. Usa **negrita** y recuadros "💡 Consejo:" cuando aporten. "questions" y "cards" vacíos.`,
  },
  {
    id: "reto", kind: "reto", name: "Reto / Situación-problema", emoji: "🧩",
    description: "Un caso o misterio que los alumnos resuelven aplicando el tema.",
    countLabel: "Pistas / tareas", defaultCount: 4, maxCount: 8,
    instructions: (n) => `Crea una situación-problema atractiva con narrativa (sección 1: la situación), ${n} secciones con pistas o tareas progresivas que obliguen a usar el tema, y una sección final "Solución para el profesor". Añade 3 preguntas de opción múltiple para comprobar la resolución. "cards" vacío.`,
  },
  {
    id: "conversacion", kind: "reto", name: "Actividad de conversación", emoji: "🗣️",
    description: "Juego de rol con tarjetas de personaje, expresiones útiles y pasos.",
    countLabel: "Roles", defaultCount: 3, maxCount: 6,
    instructions: (n) => `Diseña un juego de rol para practicar el tema oralmente. Sección 1: contexto y objetivo comunicativo. Luego ${n} secciones, una por rol, con su tarjeta (quién es, qué quiere, qué información tiene) en "body" y frases útiles en "bullets". Sección final: "Pasos de la actividad" con tiempos. "questions" y "cards" vacíos.`,
  },
];

export function getMaterialTool(id: string): MaterialTool | undefined {
  return MATERIAL_TOOLS.find((t) => t.id === id);
}

export interface MaterialGenParams {
  toolId: MaterialToolId;
  topic: string;
  grade: string;
  subject: string;
  language: string;
  count: number;
  context?: string;
  /** Clase bilingüe: idioma nativo del alumno */
  nativeLanguage?: string;
}

export interface MaterialGenOutput {
  material: ClassPlanMaterial;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export function buildMaterialSystemPrompt(p: MaterialGenParams): string {
  const tool = getMaterialTool(p.toolId)!;
  return [
    `Eres un profesor experto en ${p.subject} que crea materiales didácticos listos para usar en clase.`,
    `Material: ${tool.name}. Grado/nivel: ${p.grade}. Idioma de toda la salida: ${p.language}.`,
    p.context ? `Indicaciones del docente: ${p.context}` : "",
    "",
    tool.instructions(p.count, p.grade),
    "",
    "Reglas: contenido real y concreto sobre el tema, nada de marcadores de posición. En preguntas de opción múltiple \"correctIndex\" es el índice correcto y \"answer\" repite su texto; en abiertas \"options\" va vacío y \"correctIndex\" es -1.",
    SELF_CONTAINED_RULE,
    "En los \"body\" puedes usar formato ligero: párrafos separados por línea en blanco, listas con \"- \", tablas con pipes y **negrita**.",
    CONSISTENCY_RULES,
    DIALOGUE_RULES(p.grade),
    p.nativeLanguage ? bilingualRules(p.nativeLanguage) : "",
    "",
    "Devuelve EXCLUSIVAMENTE este JSON:",
    `{ "title": string, "description": string,`,
    `  "sections": [{ "heading": string, "body": string, "bullets": string[], "imagePrompt"?: string, "dialogue"?: [{ "speaker": string, "text": string, "translation"?: string }] }],`,
    `  "questions": [{ "prompt": string, "difficulty": "Fácil"|"Medio"|"Difícil", "options": string[], "correctIndex": number, "answer": string, "explanation": string }],`,
    `  "cards": [{ "front": string, "back": string }] }`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function normalizeMaterialOutput(raw: Record<string, unknown>, p: MaterialGenParams): ClassPlanMaterial {
  const tool = getMaterialTool(p.toolId)!;
  const m = normalizeMaterial({ ...raw, id: "m1", kind: tool.kind }, 0, tool.kind);
  return { ...m, title: m.title === "Material 1" ? `${tool.name}: ${p.topic}` : m.title };
}

/**
 * PLAN DE CLASE POR MOMENTOS
 *
 * La clase se entrega organizada en momentos con minutos asignados (inicio,
 * reto, teoría, comprobación...) y cada momento enlaza los materiales que el
 * profesor usa en ese punto. Los minutos deben sumar la duración total.
 */

import {
  bilingualRules,
  CONSISTENCY_RULES,
  DIALOGUE_RULES,
  exerciseRules,
  readingRules,
  SUMMARY_RULES,
  VOCABULARY_RULES,
} from "./reading-guidance";
import { classStructureFor, methodologyStructureFor } from "./class-structure";

export interface ClassPlanParams {
  topic: string;
  grade: string;
  subject: string;
  durationMinutes: number;
  methodology: string;
  language: string;
  competencies: Array<{ code: string; description: string }>;
  context?: string;
  /** Clase bilingüe: explicaciones con apoyo en el idioma nativo del alumno */
  nativeLanguage?: string;
  /** Id de la metodología (activo, 5e, invertida…) para cargar su documento */
  methodologyId?: string;
}

export type ClassMaterialKind = "reto" | "resumen" | "ejercicios" | "quiz" | "flashcards" | "lectura" | "rubrica";

export interface ClassPlanQuestion {
  prompt: string;
  difficulty: "Fácil" | "Medio" | "Difícil";
  /** Vacío = pregunta abierta */
  options: string[];
  correctIndex: number;
  answer: string;
  explanation: string;
}

/** Línea de un diálogo tipo libro de idiomas */
export interface DialogueLine {
  speaker: string;
  text: string;
  /** Traducción al idioma nativo (clase bilingüe) */
  translation?: string;
}

export interface ClassPlanSection {
  heading: string;
  body: string;
  bullets: string[];
  /** Diálogo entre personajes, mostrado con burbujas */
  dialogue?: DialogueLine[];
  /** Ilustración sugerida por la IA (se genera solo si el profesor pide imágenes) */
  imagePrompt?: string;
  imageUrl?: string;
}

export interface ClassPlanMaterial {
  id: string;
  kind: ClassMaterialKind;
  title: string;
  description: string;
  sections: ClassPlanSection[];
  questions: ClassPlanQuestion[];
  cards: Array<{ front: string; back: string }>;
}

export interface ClassPlanStep {
  label: string;
  minutes: number;
  text: string;
}

export interface ClassPlanMoment {
  phase: string;
  title: string;
  minutes: number;
  guide: string[];
  steps: ClassPlanStep[];
  materialIds: string[];
}

export interface ClassPlanOutput {
  title: string;
  summary: string;
  durationMinutes: number;
  methodology: string;
  objectives: string[];
  competencies: Array<{ code: string; description: string }>;
  moments: ClassPlanMoment[];
  materials: ClassPlanMaterial[];
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export const METHODOLOGIES: Array<{ id: string; label: string; description: string }> = [
  { id: "activo", label: "Aprendizaje activo", description: "Los estudiantes participan activamente, realizando actividades prácticas y proyectos colaborativos." },
  { id: "socioemocional", label: "Aprendizaje social y emocional", description: "Combina contenido escolar con habilidades socioemocionales, como la empatía y el trabajo en equipo." },
  { id: "practico", label: "Aprendizaje práctico", description: "Muestra cómo el contenido se aplica a profesiones reales, preparándolos para los desafíos del mercado." },
  { id: "5e", label: "Modelo 5E", description: "Enganchar, Explorar, Explicar, Elaborar y Evaluar: una secuencia de indagación guiada." },
  { id: "invertida", label: "Clase invertida", description: "Los alumnos revisan la teoría antes y el tiempo de clase se dedica a practicar y resolver dudas." },
  { id: "gamificacion", label: "Gamificación", description: "Retos, puntos y dinámicas de juego para aumentar la motivación y la participación." },
  { id: "comunicativo", label: "Enfoque comunicativo", description: "Prioriza el uso real de la lengua en situaciones auténticas de comunicación." },
  { id: "tradicional", label: "Clase expositiva guiada", description: "Explicación estructurada del docente seguida de práctica guiada e individual." },
];

export const DURATIONS = [30, 50, 100, 150];

export function buildClassPlanSystemPrompt(p: ClassPlanParams): string {
  const competencies = p.competencies.length
    ? p.competencies.map((c) => `- ${c.code}: ${c.description}`).join("\n")
    : "- (el docente no indicó competencias; propón las adecuadas)";

  return [
    "Eres un diseñador instruccional experto que prepara planes de clase listos para impartir.",
    "Entregas la clase organizada en MOMENTOS con minutos asignados y los MATERIALES que el profesor usará en cada momento.",
    "",
    `Asignatura: ${p.subject}. Grado/nivel: ${p.grade}. Duración total: ${p.durationMinutes} minutos.`,
    `Metodología: ${p.methodology}. Idioma de toda la salida: ${p.language}.`,
    "Competencias y aprendizajes a trabajar:",
    competencies,
    p.context ? `Contexto que pide el docente: ${p.context}` : "",
    // Bilingüe arriba del todo: con instrucciones largas, el modelo tiende a ignorar lo que va al final
    p.nativeLanguage ? `\n⚠️ REQUISITO PRINCIPAL — ${bilingualRules(p.nativeLanguage)}` : "",
    "",
    "Reglas innegociables:",
    `1. Entre 4 y 5 momentos. La suma de "minutes" de todos los momentos debe ser EXACTAMENTE ${p.durationMinutes}. Los "steps" de cada momento suman los minutos de ese momento.`,
    p.methodologyId
      ? "2. Los momentos (nombres, orden y proporción de minutos) son los que indica el documento de METODOLOGÍA de más abajo; si alguno no tiene minutos de clase (p. ej. preparación en casa), inclúyelo igualmente con \"minutes\": 0 y el resto suma la duración total."
      : "2. Momentos típicos: Inicio (enganche con pregunta vinculada a la vida del alumno), Reto práctico (situación-problema), Conexión con la teoría (explicación formal), Comprobación (verificación del aprendizaje). Adáptalos a la metodología.",
    "3. \"guide\" son 2-4 párrafos dirigidos al profesor, en segunda persona, concretos: qué decir, qué pregunta hacer (entre comillas), qué anotar en la pizarra, qué errores vigilar.",
    "4. Los materiales son lo que LEE EL ALUMNO en su lección: deben explicar el tema por completo, sin depender del profesor. Genera exactamente 6 materiales con ids m1..m6:",
    "   m1 \"reto\": situación-problema con narrativa atractiva (personajes, lugar, misterio), 3-4 secciones (El escenario, Tu misión, Pistas…) y 2 preguntas de opción múltiple para comprobar que la resolvió.",
    "   m2 \"resumen\": la TEORÍA COMPLETA en 5-7 secciones, una por concepto. Cada sección: definición clara, la regla o estructura (con tabla en pipes si hay formas o conjugaciones), AL MENOS 3 ejemplos en oraciones completas y contextualizadas, y los errores típicos con su corrección. Cierra con una sección \"Resumen\" (ver RESUMEN). En \"questions\", UN ejercicio por concepto (excepto el resumen), en el mismo orden que las secciones: se mostrará al alumno justo después de ese concepto, así que debe aplicarlo en un contexto nuevo según las reglas de EJERCICIOS.",
    "   m3 \"lectura\": LECTURA DE COMPRENSIÓN obligatoria. Sección 1: el texto (título o titular en \"heading\", párrafos en \"body\"). Sección 2: \"Vocabulario de la lectura\" con la tabla de vocabulario en \"body\" (palabras tomadas de la lectura). Después 6 preguntas de comprensión: 4 de opción múltiple (idea principal, detalles, inferencia, vocabulario en contexto) y 2 abiertas (opinión argumentada y relación con la vida del alumno).",
    `      ${readingRules(p.grade)}`,
    `      ${VOCABULARY_RULES}`,
    "   m4 \"ejercicios\": 10 ejercicios de dificultad progresiva: completar huecos (con ____), elegir la forma correcta, verdadero/falso (opción múltiple con 2 opciones), transformar oraciones, detectar y corregir errores y 2 de producción libre. Mezcla opción múltiple (4-5 opciones) y abiertas; todas con \"answer\" y \"explanation\".",
    "   m5 \"quiz\": 6 preguntas de opción múltiple con 4 opciones que apliquen los conceptos a situaciones nuevas (no preguntes la regla), con explicación.",
    `   ${exerciseRules(p.grade)}`,
    `   ${SUMMARY_RULES}`,
    "   m6 \"flashcards\": 12 tarjetas con término y significado + ejemplo.",
    "   Si la teoría (m2) incluye vocabulario del tema, usa también la tabla de vocabulario descrita arriba (mínimo 10 filas).",
    "5. En el \"body\" usa formato ligero: párrafos separados por línea en blanco, \"### \" para subtítulos, \"- \" para listas, tablas con pipes, **negrita** para lo clave, y recuadros en su propio párrafo que empiecen por \"✨ Pregunta clave:\", \"💡 Consejo:\", \"⚠️ Atención:\" o \"📌 Recuerda:\". Incluye al menos una \"✨ Pregunta clave:\" en el reto y en la teoría.",
    "6. En 3-4 secciones donde una ilustración ayude a entender (escena del reto, personajes del diálogo, escena de la lectura, esquema de un concepto), añade \"imagePrompt\": descripción visual concreta (personajes, lugar, acción), sin texto dentro de la imagen. En el resto de secciones, omítelo.",
    `   ${DIALOGUE_RULES(p.grade)}`,
    `   ${CONSISTENCY_RULES}`,
    "7. Cada momento enlaza en \"materialIds\" los materiales que usa (0 a 2). Todos los materiales deben aparecer en algún momento.",
    "8. En preguntas de opción múltiple, \"correctIndex\" es el índice de la opción correcta y \"answer\" repite su texto. En preguntas abiertas, \"options\" va vacío, \"correctIndex\" es -1 y \"answer\" es la respuesta modelo.",
    "9. 2-3 objetivos de aprendizaje medibles que empiecen con verbo en infinitivo.",
    "10. Nada de relleno ni marcadores de posición: todo contenido real sobre el tema.",
    "",
    "",
    classStructureFor(p.grade),
    "",
    methodologyStructureFor(p.methodologyId),
    p.nativeLanguage ? `\nRECUERDA: la clase es BILINGÜE (apoyo en ${p.nativeLanguage}) en todos los materiales, incluidos los diálogos (\"translation\").` : "",
    "",
    "Devuelve EXCLUSIVAMENTE este JSON:",
    "{",
    '  "title": string,',
    '  "summary": string,',
    '  "objectives": string[],',
    '  "competencies": [{ "code": string, "description": string }],',
    '  "moments": [{ "phase": string, "title": string, "minutes": number, "guide": string[], "steps": [{ "label": string, "minutes": number, "text": string }], "materialIds": string[] }],',
    '  "materials": [{ "id": string, "kind": "reto"|"resumen"|"lectura"|"ejercicios"|"quiz"|"flashcards", "title": string, "description": string,',
    '     "sections": [{ "heading": string, "body": string, "bullets": string[], "imagePrompt"?: string, "dialogue"?: [{ "speaker": string, "text": string, "translation"?: string }] }],',
    '     "questions": [{ "prompt": string, "difficulty": "Fácil"|"Medio"|"Difícil", "options": string[], "correctIndex": number, "answer": string, "explanation": string }],',
    '     "cards": [{ "front": string, "back": string }] }]',
    "}",
    "Los campos que no apliquen a un tipo de material van como arrays vacíos.",
  ]
    .filter(Boolean)
    .join("\n");
}

const KINDS: ClassMaterialKind[] = ["reto", "resumen", "ejercicios", "quiz", "flashcards", "lectura", "rubrica"];
const DIFFICULTIES = ["Fácil", "Medio", "Difícil"] as const;

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const str = (v: unknown, fb = ""): string => (typeof v === "string" && v.trim() ? v.trim() : fb);
const num = (v: unknown, fb = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fb);
const strs = (v: unknown): string[] => arr<unknown>(v).filter((x): x is string => typeof x === "string" && !!x.trim());

function dialogueOf(v: unknown): DialogueLine[] {
  return arr<Record<string, unknown>>(v)
    .filter((l) => l && typeof l.text === "string" && str(l.text))
    .slice(0, 16)
    .map((l) => ({
      speaker: str(l.speaker, "Persona").slice(0, 30),
      text: str(l.text).slice(0, 400),
      ...(str(l.translation) ? { translation: str(l.translation).slice(0, 400) } : {}),
    }));
}

export function normalizeMaterial(m: Record<string, unknown>, i: number, fallbackKind: ClassMaterialKind = "resumen"): ClassPlanMaterial {
  const kind = KINDS.includes(m.kind as ClassMaterialKind) ? (m.kind as ClassMaterialKind) : fallbackKind;
  return {
    id: str(m.id, `m${i + 1}`),
    kind,
    title: str(m.title, `Material ${i + 1}`),
    description: str(m.description),
    sections: arr<Record<string, unknown>>(m.sections).map((s) => ({
      heading: str(s?.heading),
      body: str(s?.body),
      // La IA a veces escribe "- " dentro de cada viñeta: se quita para no duplicarla
      bullets: strs(s?.bullets).map((b) => b.replace(/^[-*•]\s+/, "")),
      ...(dialogueOf(s?.dialogue).length ? { dialogue: dialogueOf(s?.dialogue) } : {}),
      ...(str(s?.imagePrompt) ? { imagePrompt: str(s?.imagePrompt).slice(0, 600) } : {}),
      ...(str(s?.imageUrl) ? { imageUrl: str(s?.imageUrl) } : {}),
    })),
    questions: arr<Record<string, unknown>>(m.questions)
      .filter((q) => q && typeof q.prompt === "string")
      .map((q) => {
        const options = strs(q.options);
        const idx = num(q.correctIndex, options.length ? 0 : -1);
        return {
          prompt: str(q.prompt),
          difficulty: DIFFICULTIES.includes(q.difficulty as never) ? (q.difficulty as ClassPlanQuestion["difficulty"]) : "Medio",
          options,
          correctIndex: options.length ? Math.min(Math.max(idx, 0), options.length - 1) : -1,
          answer: str(q.answer, options[idx] ?? ""),
          explanation: str(q.explanation),
        };
      }),
    cards: arr<Record<string, unknown>>(m.cards)
      .filter((c) => c && typeof c.front === "string")
      .map((c) => ({ front: str(c.front), back: str(c.back) })),
  };
}

export function normalizeClassPlanOutput(
  raw: Record<string, unknown>,
  p: ClassPlanParams
): Omit<ClassPlanOutput, "promptTokens" | "completionTokens" | "estimatedCost"> {
  const materials: ClassPlanMaterial[] = arr<Record<string, unknown>>(raw.materials)
    .filter((m) => m && typeof m === "object")
    .map((m, i) => normalizeMaterial(m, i));

  const materialIdSet = new Set(materials.map((m) => m.id));

  const moments: ClassPlanMoment[] = arr<Record<string, unknown>>(raw.moments)
    .filter((m) => m && typeof m.title === "string")
    .map((m) => ({
      phase: str(m.phase, "Momento"),
      title: str(m.title),
      // 0 minutos = preparación fuera de clase (p. ej. clase invertida)
      minutes: Math.max(0, Math.round(num(m.minutes, 5))),
      guide: strs(m.guide),
      steps: arr<Record<string, unknown>>(m.steps)
        .filter((s) => s && typeof s.text === "string")
        .map((s) => ({ label: str(s.label, "Paso"), minutes: Math.max(0, Math.round(num(s.minutes))), text: str(s.text) })),
      materialIds: strs(m.materialIds).filter((id) => materialIdSet.has(id)),
    }));

  // Materiales huérfanos: se cuelgan del último momento para que no se pierdan
  const linked = new Set(moments.flatMap((m) => m.materialIds));
  const orphans = materials.filter((m) => !linked.has(m.id)).map((m) => m.id);
  if (orphans.length && moments.length) moments[moments.length - 1].materialIds.push(...orphans);

  const competencies = arr<Record<string, unknown>>(raw.competencies)
    .map((c) => ({ code: str(c?.code), description: str(c?.description) }))
    .filter((c) => c.description);

  return {
    title: str(raw.title, p.topic),
    summary: str(raw.summary),
    durationMinutes: p.durationMinutes,
    methodology: p.methodology,
    objectives: strs(raw.objectives),
    competencies: competencies.length ? competencies : p.competencies,
    moments,
    materials,
  };
}

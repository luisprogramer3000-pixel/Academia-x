/**
 * ESQUEMA PEDAGÓGICO DEL AGENTE DE CLASE
 *
 * Este es el contrato que el modelo debe rellenar siempre. Existe por una razón
 * económica concreta: una IA genérica devuelve "un texto sobre el tema", el
 * profesor lo ve pobre, regenera dos o tres veces y quema créditos sin llegar a
 * una clase usable. Obligando al modelo a completar todas las piezas de una
 * clase real (objetivo medible, conceptos con ejemplo, práctica con solución,
 * guion de tiempos y notas para el docente), la primera salida ya sirve.
 */

export interface ClassAgentParams {
  topic: string;
  level: string;
  language: string;
  /** Duración de la clase en minutos: condiciona cuánta materia cabe */
  durationMinutes: number;
  /** A quién va dirigida: adultos, adolescentes, profesionales... */
  audience?: string;
  /** Qué quiere conseguir el profesor con esta clase */
  goal?: string;
  /** Enfoque didáctico preferido */
  methodology?: string;
  /** Cuántas ilustraciones pide (cada una se cobra aparte) */
  imageCount?: number;
}

export interface KeyConcept {
  term: string;
  definition: string;
  example: string;
}

export interface ClassExercise {
  instruction: string;
  /** practica | produccion | reflexion */
  type: string;
  solution: string;
}

export interface MindMapBranch {
  label: string;
  children: string[];
}

export interface MindMap {
  center: string;
  branches: MindMapBranch[];
}

export interface ClassQuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface ClassFlowStep {
  minute: number;
  durationMinutes: number;
  activity: string;
}

export interface ClassImageBrief {
  /** Para qué sirve dentro de la clase */
  purpose: string;
  /** Instrucción para el generador de imágenes */
  prompt: string;
  /** Texto alternativo, necesario para accesibilidad */
  altText: string;
  /** Término del concepto clave que ilustra (la imagen se muestra dentro de ese concepto) */
  concept?: string;
  /** URL, solo si el profesor pidió generarla */
  url?: string;
}

export interface ClassAgentOutput {
  lessonTitle: string;
  objective: string;
  prerequisites: string[];
  keyConcepts: KeyConcept[];
  explanation: string;
  mindMap: MindMap;
  examples: string[];
  exercises: ClassExercise[];
  quiz: ClassQuizQuestion[];
  classFlow: ClassFlowStep[];
  homework: string;
  teacherNotes: string[];
  images: ClassImageBrief[];
  /** Lectura de comprensión de la clase */
  reading?: { title: string; text: string; questions: Array<{ question: string; options: string[]; correctAnswerIndex: number }> };
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

/**
 * Instrucción de sistema. Es deliberadamente exigente: describe el rol, el
 * formato exacto y los criterios de calidad que distinguen una clase preparada
 * de un texto informativo.
 */
export function buildClassAgentSystemPrompt(params: ClassAgentParams): string {
  return [
    "Eres un diseñador instruccional con veinte años de experiencia formando profesores.",
    "Tu trabajo NO es explicar un tema: es entregar una clase lista para impartir hoy mismo.",
    "",
    "Reglas de calidad innegociables:",
    "1. El objetivo se redacta de forma medible y observable: 'Al finalizar, el alumno será capaz de...' seguido de un verbo de acción.",
    "2. Cada concepto clave lleva definición breve Y un ejemplo concreto del mundo real, nunca un ejemplo abstracto.",
    "3. Los ejercicios incluyen siempre su solución, porque el profesor la necesita para corregir en clase.",
    "4. El guion de clase reparte los minutos hasta cubrir la duración indicada, sin dejar huecos ni pasarse.",
    "5. Las notas para el profesor recogen los errores más frecuentes de los alumnos con este tema y cómo anticiparlos.",
    "6. El mapa mental ES la clasificación real del tema, con el criterio que usan los libros de texto (p. ej. medios de transporte → terrestres, aéreos, acuáticos; seres vivos → animales, plantas, hongos; palabras → sustantivos, verbos, adjetivos): 2 a 5 categorías, cada una con 2 a 4 ejemplos reales. Otras distinciones del tema (p. ej. público/privado) van en la explicación o en los conceptos clave, NO en el mapa. PROHIBIDO usar ramas como \"Tipos\", \"Ejemplos\", \"Usos\", \"Características\" o \"Ventajas\": cada rama es UNA categoría (\"Terrestres\", \"Aéreos\", \"Acuáticos\").",
    "6b. La lectura de comprensión es obligatoria: un texto breve y natural (80-160 palabras, adecuado al nivel) que use el vocabulario y los conceptos de la clase, con 3 preguntas de comprensión de opción múltiple (idea principal, detalle, vocabulario en contexto).",
    "7. Nada de relleno ni frases genéricas: si algo no aporta a la clase, se omite.",
    "",
    `Idioma de toda la salida: ${params.language}.`,
    `Nivel del alumnado: ${params.level}.`,
    `Duración total de la clase: ${params.durationMinutes} minutos.`,
    params.audience ? `Perfil del alumnado: ${params.audience}.` : "",
    params.goal ? `Meta concreta del profesor: ${params.goal}.` : "",
    params.methodology ? `Enfoque didáctico preferido: ${params.methodology}.` : "",
    "",
    "Devuelve EXCLUSIVAMENTE un objeto JSON con esta forma exacta:",
    "{",
    '  "lessonTitle": string,',
    '  "objective": string,',
    '  "prerequisites": string[],',
    '  "keyConcepts": [{ "term": string, "definition": string, "example": string }],',
    '  "explanation": string,',
    '  "mindMap": { "center": string, "branches": [{ "label": string, "children": string[] }] },  // la clasificación real del tema',
    '  "reading": { "title": string, "text": string, "questions": [{ "question": string, "options": string[4], "correctAnswerIndex": 0-3 }] },',
    '  "examples": string[],',
    '  "exercises": [{ "instruction": string, "type": "practica"|"produccion"|"reflexion", "solution": string }],',
    '  "quiz": [{ "question": string, "options": string[4], "correctAnswerIndex": 0-3, "explanation": string }],',
    '  "classFlow": [{ "minute": number, "durationMinutes": number, "activity": string }],',
    '  "homework": string,',
    '  "teacherNotes": string[],',
    `  "images": [{ "concept": string, "purpose": string, "prompt": string, "altText": string }]  // exactamente ${params.imageCount ?? 0} elementos`,
    "}",
    "",
    `Genera entre 4 y 6 conceptos clave, 3 y 5 ejercicios, y 4 preguntas de quiz.`,
    params.imageCount
      ? `Cada imagen ilustra UN concepto clave distinto (los ${params.imageCount} más visuales): en "concept" copia exactamente su "term". El prompt describe en inglés o español una escena concreta y visual que muestre ese concepto (objetos, personas, lugar, acción), sin texto, letras ni números dentro de la imagen.`
      : `El array "images" debe ir vacío.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Normaliza y valida la salida del modelo, que puede venir incompleta. */
export function normalizeClassAgentOutput(
  raw: Record<string, unknown>,
  params: ClassAgentParams
): Omit<ClassAgentOutput, "promptTokens" | "completionTokens" | "estimatedCost"> {
  const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  const asString = (value: unknown, fallback = ""): string =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;

  const mindMapRaw = (raw.mindMap || {}) as { center?: unknown; branches?: unknown };

  return {
    lessonTitle: asString(raw.lessonTitle, params.topic),
    objective: asString(raw.objective),
    prerequisites: asArray<string>(raw.prerequisites).filter((x) => typeof x === "string"),
    keyConcepts: asArray<KeyConcept>(raw.keyConcepts)
      .filter((c) => c && typeof c.term === "string")
      .map((c) => ({
        term: asString(c.term),
        definition: asString(c.definition),
        example: asString(c.example),
      })),
    explanation: asString(raw.explanation),
    mindMap: {
      center: asString(mindMapRaw.center, params.topic),
      branches: asArray<MindMapBranch>(mindMapRaw.branches)
        .filter((b) => b && typeof b.label === "string")
        .map((b) => ({
          label: asString(b.label),
          children: asArray<string>(b.children).filter((x) => typeof x === "string"),
        })),
    },
    examples: asArray<string>(raw.examples).filter((x) => typeof x === "string"),
    exercises: asArray<ClassExercise>(raw.exercises)
      .filter((e) => e && typeof e.instruction === "string")
      .map((e) => ({
        instruction: asString(e.instruction),
        type: asString(e.type, "practica"),
        solution: asString(e.solution),
      })),
    quiz: asArray<ClassQuizQuestion>(raw.quiz)
      .filter((q) => q && typeof q.question === "string" && Array.isArray(q.options))
      .map((q) => ({
        question: asString(q.question),
        options: q.options.map((o) => asString(o)),
        correctAnswerIndex:
          typeof q.correctAnswerIndex === "number" && q.correctAnswerIndex >= 0 ? q.correctAnswerIndex : 0,
        explanation: asString(q.explanation),
      })),
    classFlow: asArray<ClassFlowStep>(raw.classFlow)
      .filter((f) => f && typeof f.activity === "string")
      .map((f) => ({
        minute: typeof f.minute === "number" ? f.minute : 0,
        durationMinutes: typeof f.durationMinutes === "number" ? f.durationMinutes : 5,
        activity: asString(f.activity),
      })),
    homework: asString(raw.homework),
    teacherNotes: asArray<string>(raw.teacherNotes).filter((x) => typeof x === "string"),
    reading: normalizeReading(raw.reading, asString),
    images: linkImagesToConcepts(
      asArray<ClassImageBrief>(raw.images)
        .filter((i) => i && typeof i.prompt === "string")
        .slice(0, params.imageCount ?? 0)
        .map((i) => ({
          purpose: asString(i.purpose),
          prompt: asString(i.prompt),
          altText: asString(i.altText, asString(i.purpose)),
          concept: asString(i.concept) || undefined,
        })),
      asArray<KeyConcept>(raw.keyConcepts).map((c) => (c && typeof c.term === "string" ? c.term.trim() : "")).filter(Boolean)
    ),
  };
}

/**
 * Cada imagen queda ligada a un concepto clave distinto. Si el modelo no indicó
 * el concepto (o escribió otro), se le asigna el primer concepto aún sin imagen.
 */
function linkImagesToConcepts(images: ClassImageBrief[], terms: string[]): ClassImageBrief[] {
  const norm = (t: string) => t.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const used = new Set<string>();
  const matched = images.map((img) => {
    const term = img.concept ? terms.find((t) => norm(t) === norm(img.concept!) && !used.has(t)) : undefined;
    if (term) used.add(term);
    return { ...img, concept: term };
  });
  return matched.map((img) => {
    if (img.concept) return img;
    const free = terms.find((t) => !used.has(t));
    if (!free) return img;
    used.add(free);
    return { ...img, concept: free, prompt: `${img.prompt} (Concepto: ${free})` };
  });
}

function normalizeReading(value: unknown, asString: (v: unknown, f?: string) => string): ClassAgentOutput["reading"] {
  const r = (value ?? {}) as { title?: unknown; text?: unknown; questions?: unknown };
  const text = asString(r.text);
  if (text.split(/\s+/).length < 30) return undefined;
  const questions = (Array.isArray(r.questions) ? r.questions : [])
    .map((q: { question?: unknown; options?: unknown; correctAnswerIndex?: unknown }) => ({
      question: asString(q?.question),
      options: Array.isArray(q?.options) ? q.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).slice(0, 4) : [],
      correctAnswerIndex: typeof q?.correctAnswerIndex === "number" ? q.correctAnswerIndex : 0,
    }))
    .filter((q) => q.question && q.options.length >= 2 && q.correctAnswerIndex >= 0 && q.correctAnswerIndex < q.options.length)
    .slice(0, 4);
  return { title: asString(r.title, "Lectura"), text, questions };
}

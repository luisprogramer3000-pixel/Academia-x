import { FallbackAIAdapter } from "./ai.fallback";
import { AnthropicAdapter } from "./ai.anthropic";
import {
  ClassAgentParams,
  ClassAgentOutput,
  buildClassAgentSystemPrompt,
  normalizeClassAgentOutput,
} from "./class-agent.schema";
import {
  ClassPlanParams,
  ClassPlanOutput,
  buildClassPlanSystemPrompt,
  normalizeClassPlanOutput,
} from "./class-plan.schema";
import { buildLessonContentSystemPrompt, buildLessonContentUserPrompt } from "./lesson-content.prompt";
import {
  MaterialGenParams,
  MaterialGenOutput,
  buildMaterialSystemPrompt,
  normalizeMaterialOutput,
} from "./material-tools";
import {
  type AiDeckParams,
  type AiDeckOutput,
  buildAiDeckPrompt,
  normalizeAiDeck,
} from "@/modules/presentation/ai-deck.schema";
import OpenAI from "openai";

export interface CourseGenParams {
  topic: string;
  level: string;
  language: string;
  audience?: string;
  modulesCount?: number;
  countryStandard?: string;
}

export interface LessonGenParams {
  topic: string;
  level: string;
  language: string;
  lessonTitle: string;
}

export interface GeneratedModule {
  title: string;
  description: string;
  lessons: Array<{
    title: string;
    summary: string;
  }>;
}

export interface CourseStructureOutput {
  title: string;
  description: string;
  level: string;
  modules: GeneratedModule[];
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface LessonContentBlock {
  id: string;
  type: "text" | "vocabulary" | "exercise";
  title: string;
  content: string;
  items?: string[];
}

export interface LessonGenOutput {
  lessonTitle: string;
  summary: string;
  blocks: LessonContentBlock[];
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface ActivityGenParams {
  topic: string;
  level?: string;
  language?: string;
  lessonId?: string;
}

export interface ActivityGenOutput {
  title: string;
  description: string;
  instructions: string[];
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface QuizGenParams {
  topic: string;
  level?: string;
  language?: string;
  questionCount?: number;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface QuizGenOutput {
  title: string;
  questions: QuizQuestion[];
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface LandingGenParams {
  courseTitle: string;
  targetAudience?: string;
  language?: string;
}

export interface LandingGenOutput {
  headline: string;
  subheadline: string;
  benefits: string[];
  callToAction: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface LessonRegenParams {
  topic: string;
  level?: string;
  language?: string;
  lessonTitle: string;
  feedback?: string;
}

export type LessonRegenOutput = LessonGenOutput;

export interface CourseRegenParams {
  topic: string;
  level?: string;
  language?: string;
  audience?: string;
  feedback?: string;
}

export type CourseRegenOutput = CourseStructureOutput;

export interface AITutorParams {
  question: string;
  context?: string;
  language?: string;
}

export interface AITutorOutput {
  answer: string;
  suggestedFollowUps: string[];
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface AIFeedbackParams {
  studentSubmission: string;
  exerciseContext: string;
  language?: string;
}

export interface AIFeedbackOutput {
  feedback: string;
  score: number;
  strengths: string[];
  areasToImprove: string[];
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

// ─── Lesson Document (PDF) ───────────────────────────────────────────────────

export interface LessonDocumentParams {
  topic: string;
  level: string;
  audience: string;
  subject: string;
  teacherLanguage?: string;
}

export interface LessonDocumentSection {
  number: string;
  theme: string;
  title: string;
  type: "vocabulary" | "grammar" | "practice" | "conversation" | "cover";
  body: string;
  table?: { headers: string[]; rows: string[][] };
  table2?: { headers: string[]; rows: string[][] };
  callout?: string;
  exercises?: Array<{
    label: string;
    instruction: string;
    items: string[];
    answerKey?: string;
  }>;
}

export interface LessonDocumentOutput {
  title: string;
  subtitle: string;
  level: string;
  audience: string;
  subject: string;
  tagline: string;
  learningPath: string[];
  sections: LessonDocumentSection[];
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

/** Llamada JSON genérica del planificador de presentaciones (motor v2). */
export interface PresentationPlanCall {
  system: string;
  user: string;
  /** Respuesta anterior + instrucciones de corrección (reintento) */
  history?: Array<{ role: "assistant" | "user"; content: string }>;
}

export interface PresentationPlanRaw {
  raw: unknown;
  text: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

export interface AIProviderAdapter {
  providerName: string;
  modelName: string;
  generateCourseStructure(params: CourseGenParams): Promise<CourseStructureOutput>;
  generateLessonContent(params: LessonGenParams): Promise<LessonGenOutput>;
  generateActivity(params: ActivityGenParams): Promise<ActivityGenOutput>;
  generateQuiz(params: QuizGenParams): Promise<QuizGenOutput>;
  generateLandingPage(params: LandingGenParams): Promise<LandingGenOutput>;
  regenerateLessonContent(params: LessonRegenParams): Promise<LessonRegenOutput>;
  regenerateCourseStructure(params: CourseRegenParams): Promise<CourseRegenOutput>;
  askAITutor(params: AITutorParams): Promise<AITutorOutput>;
  getAIFeedback(params: AIFeedbackParams): Promise<AIFeedbackOutput>;
  generateLessonDocument(params: LessonDocumentParams): Promise<LessonDocumentOutput>;
  /** Agente de clase: una llamada devuelve la clase completa según el esquema pedagógico */
  generateFullClass(params: ClassAgentParams): Promise<ClassAgentOutput>;
  generateClassPlan(params: ClassPlanParams): Promise<ClassPlanOutput>;
  generateMaterial(params: MaterialGenParams): Promise<MaterialGenOutput>;
  generatePresentationDeck(params: AiDeckParams): Promise<AiDeckOutput>;
  /** Plan pedagógico de la presentación (JSON validado después con Zod) */
  generatePresentationPlan(call: PresentationPlanCall): Promise<PresentationPlanRaw>;
}

/**
 * Adaptador Simulado (Mock) para pruebas locales, tests automatizados e iteraciones sin costo de API.
 */
export class MockAIAdapter implements AIProviderAdapter {
  providerName = "mock-ai";
  modelName = "mock-v1";

  async generateCourseStructure(params: CourseGenParams): Promise<CourseStructureOutput> {
    const modulesCount = params.modulesCount || 3;
    const modules: GeneratedModule[] = [];

    for (let i = 1; i <= modulesCount; i++) {
      modules.push({
        title: `Módulo ${i}: Fundamentos de ${params.topic} (${params.level})${params.countryStandard ? ` - ${params.countryStandard}` : ""}`,
        description: `Unidad práctica enfocada en aplicar ${params.topic} para el nivel ${params.level}.`,
        lessons: [
          {
            title: `Lección ${i}.1: Introducción a ${params.topic}`,
            summary: `Conceptos clave y vocabulario esencial.`,
          },
          {
            title: `Lección ${i}.2: Caso Práctico y Ejercicios`,
            summary: `Simulación interactiva y evaluación guiada.`,
          },
        ],
      });
    }

    return {
      title: `${params.topic} — Nivel ${params.level}`,
      description: `Programa de estudio estructurado de ${params.topic} orientado a ${params.audience || "estudiantes de idiomas"}.`,
      level: params.level,
      modules,
      promptTokens: 450,
      completionTokens: 850,
      estimatedCost: 0.0015,
    };
  }

  async generateLessonContent(params: LessonGenParams): Promise<LessonGenOutput> {
    const timestamp = Date.now();
    return {
      lessonTitle: params.lessonTitle,
      summary: `Contenido explicativo y ejercicios para ${params.lessonTitle} (${params.level}).`,
      blocks: [
        {
          id: `b_txt_${timestamp}`,
          type: "text",
          title: "Explicación Teórica",
          content: `En esta lección de ${params.topic} (${params.level}), exploraremos las expresiones indispensables y estructuras gramaticales avanzadas.`,
        },
        {
          id: `b_voc_${timestamp}`,
          type: "vocabulary",
          title: "Vocabulario Clave",
          content: "Términos esenciales para dominar el tema:",
          items: [
            "Término 1: Definición práctica",
            "Término 2: Ejemplo de uso",
            "Término 3: Expresión idiomática recomendada",
          ],
        },
        {
          id: `b_exe_${timestamp}`,
          type: "exercise",
          title: "Ejercicio Práctico",
          content: "Completa las oraciones o responde las preguntas planteadas según el contexto leído.",
        },
      ],
      promptTokens: 250,
      completionTokens: 500,
      estimatedCost: 0.0008,
    };
  }

  async generateActivity(params: ActivityGenParams): Promise<ActivityGenOutput> {
    return {
      title: `Actividad Práctica: ${params.topic}`,
      description: `Ejercicio formativo diseñado para reforzar ${params.topic} en nivel ${params.level || "B1"}.`,
      instructions: [
        "Lee el texto de estudio atentamente.",
        "Responde a las preguntas de comprensión de forma detallada.",
        "Completa los ejercicios de vocabulario y gramática aplicada.",
      ],
      promptTokens: 150,
      completionTokens: 300,
      estimatedCost: 0.0004,
    };
  }

  async generateQuiz(params: QuizGenParams): Promise<QuizGenOutput> {
    const count = params.questionCount || 3;
    const questions: QuizQuestion[] = [];
    for (let i = 1; i <= count; i++) {
      questions.push({
        question: `Pregunta ${i}: ¿Cuál es el concepto clave de ${params.topic} en nivel ${params.level || "B1"}?`,
        options: ["Opción Correcta A", "Opción Incorrecta B", "Opción Incorrecta C", "Opción Incorrecta D"],
        correctAnswerIndex: 0,
        explanation: `Explicación pedagógica detallada para la pregunta ${i}.`,
      });
    }
    return {
      title: `Quiz de Evaluación: ${params.topic}`,
      questions,
      promptTokens: 200,
      completionTokens: 400,
      estimatedCost: 0.0005,
    };
  }

  async generateLandingPage(params: LandingGenParams): Promise<LandingGenOutput> {
    return {
      headline: `Domina ${params.courseTitle} con Confianza`,
      subheadline: `Aprende de forma estructurada con explicaciones guiadas por IA adaptadas para ${params.targetAudience || "estudiantes"}.`,
      benefits: [
        "Acceso ilimitado a lecciones y ejercicios interactivos.",
        "Feedback instantáneo impulsado por inteligencia artificial.",
        "Certificación oficial de finalización del programa.",
      ],
      callToAction: "¡Inscríbete Ahora y Comienza a Aprender!",
      promptTokens: 350,
      completionTokens: 650,
      estimatedCost: 0.0012,
    };
  }

  async regenerateLessonContent(params: LessonRegenParams): Promise<LessonRegenOutput> {
    const timestamp = Date.now();
    return {
      lessonTitle: params.lessonTitle,
      summary: `Contenido regenerado con enfoque: ${params.feedback || "mejora pedagógica"}.`,
      blocks: [
        {
          id: `b_txt_regen_${timestamp}`,
          type: "text",
          title: "Explicación Mejorada",
          content: `Versión mejorada de la lección ${params.lessonTitle} (${params.level || "B1"}). Feedback aplicado: ${params.feedback || "Claridad y concisión"}.`,
        },
      ],
      promptTokens: 280,
      completionTokens: 520,
      estimatedCost: 0.0009,
    };
  }

  async regenerateCourseStructure(params: CourseRegenParams): Promise<CourseRegenOutput> {
    return this.generateCourseStructure({
      topic: `${params.topic} (Regenerado: ${params.feedback || "Optimización"})`,
      level: params.level || "B1",
      language: params.language || "es",
      audience: params.audience,
    });
  }

  async askAITutor(params: AITutorParams): Promise<AITutorOutput> {
    return {
      answer: `Respuesta del AI Tutor sobre: "${params.question}". Contexto considerado: ${params.context || "General"}.`,
      suggestedFollowUps: [
        "¿Podrías darme un ejemplo práctico de esto?",
        "¿Cómo se relaciona esto con la lección anterior?",
      ],
      promptTokens: 120,
      completionTokens: 250,
      estimatedCost: 0.0003,
    };
  }

  async getAIFeedback(params: AIFeedbackParams): Promise<AIFeedbackOutput> {
    return {
      feedback: `Evaluación detallada de la entrega en el ejercicio: "${params.exerciseContext}".`,
      score: 92,
      strengths: ["Excelente uso de gramática", "Vocabulario preciso y variado"],
      areasToImprove: ["Revisar concordancia de tiempos verbales en la segunda oración"],
      promptTokens: 180,
      completionTokens: 320,
      estimatedCost: 0.0004,
    };
  }

  async generateFullClass(params: ClassAgentParams): Promise<ClassAgentOutput> {
    const half = Math.floor(params.durationMinutes / 2);
    return {
      lessonTitle: `${params.topic} — clase de ${params.durationMinutes} min (${params.level})`,
      objective: `Al finalizar, el alumno será capaz de aplicar ${params.topic} en una situación real.`,
      prerequisites: [`Nociones básicas previas a ${params.level}`],
      keyConcepts: [
        { term: `${params.topic}: definición`, definition: "Explicación breve del concepto central.", example: "Ejemplo concreto de uso cotidiano." },
        { term: "Aplicación práctica", definition: "Cómo se usa en contexto real.", example: "Caso de una conversación de trabajo." },
      ],
      explanation: `Desarrollo teórico simulado sobre ${params.topic} adaptado al nivel ${params.level}.`,
      mindMap: {
        center: params.topic,
        branches: [
          { label: "Fundamentos", children: ["Definición", "Origen"] },
          { label: "Uso práctico", children: ["Ejemplos", "Errores frecuentes"] },
        ],
      },
      examples: [`Ejemplo 1 de ${params.topic}`, `Ejemplo 2 de ${params.topic}`],
      exercises: [
        { instruction: `Practica ${params.topic} completando cinco frases.`, type: "practica", solution: "Soluciones de referencia." },
      ],
      quiz: [
        {
          question: `¿Qué caracteriza a ${params.topic}?`,
          options: ["Opción correcta", "Distractor A", "Distractor B", "Distractor C"],
          correctAnswerIndex: 0,
          explanation: "La primera opción recoge la definición vista en clase.",
        },
      ],
      classFlow: [
        { minute: 0, durationMinutes: half, activity: "Presentación del objetivo y activación de conocimientos previos." },
        { minute: half, durationMinutes: params.durationMinutes - half, activity: "Práctica guiada y cierre con evaluación." },
      ],
      homework: `Redactar un texto breve aplicando ${params.topic}.`,
      teacherNotes: ["Error frecuente: confundir el concepto con su ejemplo.", "Evaluar con la solución de los ejercicios."],
      images: Array.from({ length: params.imageCount ?? 0 }, (_, i) => ({
        purpose: `Apoyo visual ${i + 1}`,
        prompt: `Ilustración educativa sobre ${params.topic}`,
        altText: `Ilustración sobre ${params.topic}`,
      })),
      promptTokens: 900,
      completionTokens: 1800,
      estimatedCost: 0.0021,
    };
  }

  async generateClassPlan(params: ClassPlanParams): Promise<ClassPlanOutput> {
    const d = params.durationMinutes;
    const m1 = Math.round(d * 0.15);
    const m2 = Math.round(d * 0.35);
    const m3 = Math.round(d * 0.3);
    const m4 = d - m1 - m2 - m3;
    const t = params.topic;
    const raw = {
      title: t,
      summary: `Plan de clase simulado sobre ${t} para ${params.grade}.`,
      objectives: [`Reconocer los elementos clave de ${t}.`, `Aplicar ${t} en situaciones comunicativas reales.`],
      competencies: params.competencies,
      moments: [
        { phase: "Inicio", title: `¿Qué sabes de ${t}?`, minutes: m1, guide: [`Plantea la pregunta: "¿Dónde has visto ${t} en tu día a día?"`, "Anota en la pizarra las respuestas sin corregir todavía."], steps: [{ label: "Paso 1", minutes: m1, text: "Lluvia de ideas en voz alta." }], materialIds: [] },
        { phase: "Reto práctico", title: "Resuelve el misterio", minutes: m2, guide: ["Forma grupos de 3 y entrega el reto.", "Circula por el aula y anota los errores frecuentes."], steps: [{ label: "Paso 1", minutes: Math.round(m2 / 2), text: "Lectura del reto." }, { label: "Paso 2", minutes: m2 - Math.round(m2 / 2), text: "Resolución en grupos." }], materialIds: ["m1"] },
        { phase: "Conexión con la teoría", title: `Estructura y uso de ${t}`, minutes: m3, guide: ["Retoma los errores anotados y conéctalos con la regla.", "Proyecta el resumen y repasa los ejemplos."], steps: [{ label: "Paso 1", minutes: m3, text: "Explicación guiada con el resumen." }], materialIds: ["m2", "m6", "m5"] },
        { phase: "Comprobación", title: "Comprobación práctica", minutes: m4, guide: ["Lanza el quiz interactivo en la pantalla.", "Reparte la hoja de ejercicios para casa."], steps: [{ label: "Paso 1", minutes: m4, text: "Quiz en directo y autocorrección." }], materialIds: ["m4", "m3"] },
      ],
      materials: [
        { id: "m1", kind: "reto", title: "El reto de la clase", description: `Situación-problema sobre ${t}.`, sections: [{ heading: "La situación", body: `Un grupo de amigos necesita usar ${t} para resolver un problema.`, bullets: ["Pista 1", "Pista 2"] }], questions: [], cards: [] },
        { id: "m2", kind: "resumen", title: `Estructura y uso de ${t}`, description: "Resumen teórico.", sections: [{ heading: "Regla principal", body: `Explicación de ${t}.`, bullets: ["Ejemplo 1", "Ejemplo 2"] }, { heading: "Errores frecuentes", body: "Lo que hay que evitar.", bullets: ["Error 1 → Corrección 1"] }], questions: [], cards: [] },
        { id: "m3", kind: "ejercicios", title: "Comprobación práctica", description: "Lista de ejercicios.", sections: [], questions: [
          { prompt: `Elige la opción correcta sobre ${t}.`, difficulty: "Medio", options: ["Correcta", "Incorrecta A", "Incorrecta B", "Incorrecta C"], correctIndex: 0, answer: "Correcta", explanation: "Es la que sigue la regla." },
          { prompt: `Escribe una oración usando ${t}.`, difficulty: "Fácil", options: [], correctIndex: -1, answer: "Respuesta modelo.", explanation: "" },
        ], cards: [] },
        { id: "m4", kind: "quiz", title: "Quiz interactivo de repaso", description: "Juego de preguntas.", sections: [], questions: [
          { prompt: `¿Qué caracteriza a ${t}?`, difficulty: "Fácil", options: ["La definición correcta", "Distractor A", "Distractor B", "Distractor C"], correctIndex: 0, answer: "La definición correcta", explanation: "Visto en la teoría." },
        ], cards: [] },
        { id: "m5", kind: "flashcards", title: "Flashcards", description: "Tarjetas de repaso.", sections: [], questions: [], cards: [{ front: t, back: "Definición" }, { front: "Ejemplo", back: "Uso en contexto" }] },
        { id: "m6", kind: "lectura", title: `Lectura: un día con ${t}`, description: "Lectura de comprensión.", sections: [
          { heading: "Un sábado diferente", body: `Texto de lectura simulado que usa **${t}** en contexto.\n\nSegundo párrafo de la lectura.`, bullets: [], imagePrompt: "Ilustración de dos amigos paseando por una plaza soleada" },
          { heading: "Vocabulario de la lectura", body: "| Palabra | Significado |\n| --- | --- |\n| plaza | espacio abierto en una ciudad |", bullets: [] },
        ], questions: [
          { prompt: "¿Dónde ocurre la historia?", difficulty: "Fácil", options: ["En una plaza", "En un barco", "En la luna", "En un hospital"], correctIndex: 0, answer: "En una plaza", explanation: "Lo dice el primer párrafo." },
          { prompt: "Resume la lectura en dos frases.", difficulty: "Medio", options: [], correctIndex: -1, answer: "Respuesta modelo del resumen.", explanation: "" },
        ], cards: [] },
      ],
    };
    return { ...normalizeClassPlanOutput(raw, params), promptTokens: 1200, completionTokens: 3000, estimatedCost: 0.003 };
  }

  async generateMaterial(params: MaterialGenParams): Promise<MaterialGenOutput> {
    const t = params.topic;
    const n = Math.min(params.count, 6);
    const raw = {
      title: `${t} (simulado)`,
      description: `Material simulado sobre ${t} para ${params.grade}.`,
      sections: [
        { heading: `Introducción a ${t}`, body: `Texto de ejemplo sobre **${t}**.\n\n| Término | Significado |\n| --- | --- |\n| ${t} | Definición |`, bullets: ["Idea 1", "Idea 2"] },
      ],
      questions: Array.from({ length: n }, (_, i) => ({
        prompt: `Pregunta ${i + 1} sobre ${t}`,
        difficulty: i < 2 ? "Fácil" : "Medio",
        options: ["Respuesta correcta", "Distractor A", "Distractor B", "Distractor C"],
        correctIndex: 0,
        answer: "Respuesta correcta",
        explanation: "Es la opción que sigue la regla.",
      })),
      cards: Array.from({ length: n }, (_, i) => ({ front: `Término ${i + 1}`, back: `Significado ${i + 1}` })),
    };
    return { material: normalizeMaterialOutput(raw, params), promptTokens: 400, completionTokens: 900, estimatedCost: 0.0007 };
  }

  async generatePresentationPlan(_call: PresentationPlanCall): Promise<PresentationPlanRaw> {
    // El simulador no planifica: el motor detecta el plan vacío y usa su planificador pedagógico interno
    return { raw: {}, text: "{}", promptTokens: 0, completionTokens: 0, estimatedCost: 0 };
  }

  async generatePresentationDeck(params: AiDeckParams): Promise<AiDeckOutput> {
    const t = params.lessonTitle;
    const raw = {
      slides: [
        { layout: "title", title: t, subtitle: "Presentación simulada", imagePrompt: params.imageCount ? "Aula luminosa con alumnos" : undefined },
        { layout: "agenda", title: "Índice", items: ["Conceptos clave", "Estructura", "Práctica", "Conclusión"] },
        { layout: "cards", title: "Conceptos clave", cards: [
          { icon: "🕐", heading: "Rutinas", text: "Acciones que repetimos." },
          { icon: "☀️", heading: "Hechos", text: "Verdades generales." },
          { icon: "🏠", heading: "Estados", text: "Situaciones permanentes." },
          { icon: "🚆", heading: "Horarios", text: "Eventos con hora fija." },
        ] },
        { layout: "two-columns", columns: [
          { heading: "I, You, We, They", text: "Forma base.", bullets: ["They play football."] },
          { heading: "He, She, It", text: "Añade -s/-es/-ies.", bullets: ["She plays football."] },
        ] },
        { layout: "table", title: "Conjugación", headers: ["Verbo", "I/You", "He/She"], rows: [["work", "I work", "He works"], ["study", "I study", "She studies"]] },
        { layout: "steps", title: "Demostración guiada", badge: "✏️ Demostración guiada", steps: [{ text: "Identifica el sujeto." }, { text: "Elige el verbo." }, { text: "Conjuga." }] },
        { layout: "quiz", question: "¿Cuál es correcta?", options: ["She goes", "She go", "She going", "She goed"], correctIndex: 0, explanation: "Tercera persona: -es." },
        { layout: "matching", title: "Relaciona las columnas", left: ["She", "They don't", "Does he"], right: ["go to school.", "speak English?", "goes to the gym."], answers: [1, 2, 0] },
        { layout: "discussion", badge: "👥 Discute con tu compañero", question: "¿Cómo es tu día?", prompt: "Describe tu rutina." },
        { layout: "conclusion", title: "Conclusión", bullets: ["Rutinas y hechos.", "3ª persona con -s.", "Auxiliares do/does."] },
      ],
    };
    return { slides: normalizeAiDeck(raw, params), promptTokens: 800, completionTokens: 1600, estimatedCost: 0.0012 };
  }

  async generateLessonDocument(params: LessonDocumentParams): Promise<LessonDocumentOutput> {
    return {
      title: `${params.topic}`,
      subtitle: params.topic,
      level: params.level,
      audience: params.audience,
      subject: params.subject,
      tagline: "Mock lesson document",
      learningPath: ["Secciones 01-03: Vocabulario", "Secciones 04-07: Gramática", "Secciones 08-10: Práctica"],
      sections: [
        {
          number: "01", theme: "VOCABULARIO", title: "Palabras clave",
          type: "vocabulary", body: "Vocabulario del tema.",
          table: { headers: ["Palabra", "Traducción", "Ejemplo"], rows: [["ejemplo", "example", "Un ejemplo."]] },
          callout: "Nota de práctica.",
        },
      ],
      promptTokens: 100,
      completionTokens: 200,
      estimatedCost: 0.0003,
    };
  }
}

/**
 * Adaptador de producción para el proveedor OpenAI API utilizando el SDK oficial.
 */
export class OpenAIAdapter implements AIProviderAdapter {
  providerName = "openai";
  modelName: string;
  private client: OpenAI;

  /**
   * Sirve para OpenAI y para cualquier proveedor compatible con su API
   * (OpenRouter, Groq, Together...). Solo cambia baseURL y la clave.
   */
  constructor(
    apiKey?: string,
    model?: string,
    options: { baseURL?: string; providerName?: string; jsonMode?: boolean; timeoutMs?: number; maxRetries?: number } = {}
  ) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error("OPENAI_API_KEY_MISSING: OpenAI API key is required to initialize OpenAIAdapter.");
    }

    if (options.providerName) this.providerName = options.providerName;
    this.nativeJsonMode = options.jsonMode ?? true;
    this.modelName = model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.client = new OpenAI({
      apiKey: key,
      baseURL: options.baseURL,
      timeout: options.timeoutMs ?? 30000,
      maxRetries: options.maxRetries ?? 2,
    });
  }

  /** false en proveedores que no aceptan response_format: el JSON se extrae del texto */
  private nativeJsonMode: boolean;

  /**
   * Algunos modelos (DeepSeek y otros) envuelven el JSON en ```json … ``` o
   * anteponen su razonamiento en <think>…</think>: se limpia antes de parsear.
   */
  private static extractJson(content: string): any {
    const cleaned = content
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
      throw new Error("no JSON object found");
    }
  }

  /**
   * Cálculo estimado de costos de tokens basado en tarifas oficiales de OpenAI.
   */
  private calculateEstimatedCost(promptTokens: number, completionTokens: number): number {
    // gpt-4o-mini: $0.15 / 1M prompt tokens, $0.60 / 1M completion tokens
    if (this.modelName.includes("mini")) {
      return (promptTokens * 0.00000015) + (completionTokens * 0.0000006);
    }
    // gpt-4o: $2.50 / 1M prompt tokens, $10.00 / 1M completion tokens
    return (promptTokens * 0.0000025) + (completionTokens * 0.00001);
  }

  private async callChatCompletion(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, jsonMode = true, timeoutMs?: number) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages,
        response_format: jsonMode && this.nativeJsonMode ? { type: "json_object" } : undefined,
        temperature: 0.7,
      }, timeoutMs ? { timeout: timeoutMs } : undefined);

      const choice = response.choices[0];
      const content = choice?.message?.content || "{}";
      const promptTokens = response.usage?.prompt_tokens || 0;
      const completionTokens = response.usage?.completion_tokens || 0;
      const estimatedCost = this.calculateEstimatedCost(promptTokens, completionTokens);

      let parsed: any = null;
      if (jsonMode) {
        try {
          parsed = OpenAIAdapter.extractJson(content);
        } catch {
          throw new Error("OPENAI_INVALID_JSON_RESPONSE: Failed to parse structured JSON response from OpenAI.");
        }
      }

      return {
        content,
        parsed,
        promptTokens,
        completionTokens,
        estimatedCost,
      };
    } catch (error: any) {
      // Sanitizar mensaje de error sin exponer secretos ni URLs internas
      const safeMessage = error?.message ? String(error.message).replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***") : "OpenAI API request failed";
      throw new Error(`OPENAI_PROVIDER_ERROR: ${safeMessage}`);
    }
  }

  async generateCourseStructure(params: CourseGenParams): Promise<CourseStructureOutput> {
    const systemPrompt = `Eres un diseñador curricular experto en plataformas EdTech. Genera una estructura de curso en formato JSON con las siguientes claves exactas:
{
  "title": string,
  "description": string,
  "level": string,
  "modules": [
    {
      "title": string,
      "description": string,
      "lessons": [
        { "title": string, "summary": string }
      ]
    }
  ]
}
Genera entre ${params.modulesCount || 4} y ${(params.modulesCount || 4) + 2} módulos, cada uno con entre 3 y 5 lecciones. Los títulos deben ser concretos y descriptivos. Responde SOLO con el JSON, sin texto adicional. Idioma: ${params.language || "es"}.`;
    const userPrompt = `Tema del curso: ${params.topic}. Nivel: ${params.level}. Audiencia: ${params.audience || "estudiantes generales"}.${params.countryStandard ? ` Estándar Educativo: ${params.countryStandard}.` : ""}`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const json = result.parsed || {};
    return {
      title: json.title || `${params.topic} — Nivel ${params.level}`,
      description: json.description || `Programa de estudio de ${params.topic}`,
      level: json.level || params.level,
      modules: Array.isArray(json.modules) ? json.modules : [],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async generateLessonContent(params: LessonGenParams): Promise<LessonGenOutput> {
    const lang = params.language || "es";
    const systemPrompt = buildLessonContentSystemPrompt(lang, params.level);
    const userPrompt = buildLessonContentUserPrompt(params, lang);

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], true, 115000);

    const json = result.parsed || {};
    return {
      lessonTitle: json.lessonTitle || params.lessonTitle,
      summary: json.summary || `Contenido de ${params.lessonTitle}`,
      blocks: Array.isArray(json.blocks) ? json.blocks : [],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async generateActivity(params: ActivityGenParams): Promise<ActivityGenOutput> {
    const systemPrompt = `Eres un diseñador de actividades pedagógicas. Genera una actividad en formato JSON con las claves: "title" (string), "description" (string), "instructions" (array de strings). Idioma: ${params.language || "es"}.`;
    const userPrompt = `Tema: ${params.topic}. Nivel: ${params.level || "B1"}.`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const json = result.parsed || {};
    return {
      title: json.title || `Actividad Práctica: ${params.topic}`,
      description: json.description || `Ejercicio formativo sobre ${params.topic}`,
      instructions: Array.isArray(json.instructions) ? json.instructions : ["Realizar los ejercicios correspondientes."],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async generateQuiz(params: QuizGenParams): Promise<QuizGenOutput> {
    const systemPrompt = `Eres un evaluador pedagógico. Genera un quiz de preguntas de opción múltiple en formato JSON con las claves: "title" (string), "questions" (array de objetos con "question", "options" [array de 4 opciones], "correctAnswerIndex" [número de 0 a 3], "explanation"). Idioma: ${params.language || "es"}.`;
    const userPrompt = `Tema: ${params.topic}. Nivel: ${params.level || "B1"}. Cantidad de preguntas: ${params.questionCount || 3}.`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const json = result.parsed || {};
    return {
      title: json.title || `Quiz de Evaluación: ${params.topic}`,
      questions: Array.isArray(json.questions) ? json.questions : [],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async generateLandingPage(params: LandingGenParams): Promise<LandingGenOutput> {
    const systemPrompt = `Eres un copywriter educativo de alta conversión. Genera el texto de una landing page en formato JSON con las claves: "headline" (string), "subheadline" (string), "benefits" (array de strings), "callToAction" (string). Idioma: ${params.language || "es"}.`;
    const userPrompt = `Curso: ${params.courseTitle}. Audiencia objetivo: ${params.targetAudience || "estudiantes"}.`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const json = result.parsed || {};
    return {
      headline: json.headline || `Aprende ${params.courseTitle}`,
      subheadline: json.subheadline || `Programa interactivo de ${params.courseTitle}`,
      benefits: Array.isArray(json.benefits) ? json.benefits : [],
      callToAction: json.callToAction || "¡Inscríbete Ahora!",
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async regenerateLessonContent(params: LessonRegenParams): Promise<LessonRegenOutput> {
    const systemPrompt = `Eres un profesor experto en optimización pedagógica. Regenera el contenido de una lección aplicando el feedback del docente en formato JSON con las claves: "lessonTitle" (string), "summary" (string), "blocks" (array con "id", "type", "title", "content"). Idioma: ${params.language || "es"}.`;
    const userPrompt = `Lección: ${params.lessonTitle}. Tema: ${params.topic}. Nivel: ${params.level || "B1"}. Feedback de mejora: ${params.feedback || "Mayor claridad y dinamismo"}.`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const json = result.parsed || {};
    return {
      lessonTitle: json.lessonTitle || params.lessonTitle,
      summary: json.summary || `Contenido optimizado de ${params.lessonTitle}`,
      blocks: Array.isArray(json.blocks) ? json.blocks : [],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async regenerateCourseStructure(params: CourseRegenParams): Promise<CourseRegenOutput> {
    const systemPrompt = `Eres un diseñador curricular experto en plataformas EdTech. Genera una estructura de curso en formato JSON con las siguientes claves exactas:
{
  "title": string,
  "description": string,
  "level": string,
  "modules": [
    {
      "title": string,
      "description": string,
      "lessons": [
        { "title": string, "summary": string }
      ]
    }
  ]
}
Genera entre 4 y 6 módulos, cada uno con entre 3 y 5 lecciones. Los títulos deben ser concretos y descriptivos. Responde SOLO con el JSON, sin texto adicional. Idioma: ${params.language || "es"}.`;
    const userPrompt = `Tema del curso: ${params.topic}. Nivel: ${params.level || "B1"}. Audiencia: ${params.audience || "estudiantes generales"}.${params.feedback ? ` Instrucciones adicionales: ${params.feedback}.` : ""}`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const json = result.parsed || {};
    return {
      title: json.title || `${params.topic} — Nivel ${params.level || "B1"}`,
      description: json.description || `Programa de estudio de ${params.topic}`,
      level: json.level || params.level || "B1",
      modules: Array.isArray(json.modules) ? json.modules : [],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async askAITutor(params: AITutorParams): Promise<AITutorOutput> {
    const systemPrompt = `Eres un tutor pedagógico virtual paciente y claro. Responde a la pregunta del estudiante en formato JSON con las claves: "answer" (string con explicación clara), "suggestedFollowUps" (array de strings con 2 preguntas de profundización). Idioma: ${params.language || "es"}.`;
    const userPrompt = `Pregunta: "${params.question}". Contexto de la lección: ${params.context || "General"}.`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const json = result.parsed || {};
    return {
      answer: json.answer || "No se pudo generar una respuesta en este momento.",
      suggestedFollowUps: Array.isArray(json.suggestedFollowUps) ? json.suggestedFollowUps : [],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async getAIFeedback(params: AIFeedbackParams): Promise<AIFeedbackOutput> {
    const systemPrompt = `Eres un evaluador docente que califica entregas de estudiantes. Analiza la respuesta en formato JSON con las claves: "feedback" (string detallado), "score" (número entero de 0 a 100), "strengths" (array de strings), "areasToImprove" (array de strings). Idioma: ${params.language || "es"}.`;
    const userPrompt = `Contexto del ejercicio: "${params.exerciseContext}". Entrega del estudiante: "${params.studentSubmission}".`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const json = result.parsed || {};
    return {
      feedback: json.feedback || "Evaluación completada.",
      score: typeof json.score === "number" ? Math.max(0, Math.min(100, json.score)) : 85,
      strengths: Array.isArray(json.strengths) ? json.strengths : ["Buen intento"],
      areasToImprove: Array.isArray(json.areasToImprove) ? json.areasToImprove : ["Continuar practicando"],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async generateFullClass(params: ClassAgentParams): Promise<ClassAgentOutput> {
    const systemPrompt = buildClassAgentSystemPrompt(params);
    const userPrompt = `Prepara la clase completa sobre: "${params.topic}".`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    const normalized = normalizeClassAgentOutput(result.parsed || {}, params);

    return {
      ...normalized,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async generateClassPlan(params: ClassPlanParams): Promise<ClassPlanOutput> {
    const result = await this.callChatCompletion([
      { role: "system", content: buildClassPlanSystemPrompt(params) },
      { role: "user", content: `Prepara el plan de clase completo sobre: "${params.topic}".` },
    ], true, 200000);

    return {
      ...normalizeClassPlanOutput(result.parsed || {}, params),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async generatePresentationPlan(call: PresentationPlanCall): Promise<PresentationPlanRaw> {
    const result = await this.callChatCompletion([
      { role: "system", content: call.system },
      { role: "user", content: call.user },
      ...(call.history ?? []),
    ], true, 150000);
    return { raw: result.parsed ?? {}, text: result.content, promptTokens: result.promptTokens, completionTokens: result.completionTokens, estimatedCost: result.estimatedCost };
  }

  async generatePresentationDeck(params: AiDeckParams): Promise<AiDeckOutput> {
    const result = await this.callChatCompletion([
      { role: "system", content: buildAiDeckPrompt(params) },
      { role: "user", content: `Lección: "${params.lessonTitle}".\n\n${params.lessonText}` },
    ], true, 150000);
    return {
      slides: normalizeAiDeck(result.parsed || {}, params),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async generateMaterial(params: MaterialGenParams): Promise<MaterialGenOutput> {
    const result = await this.callChatCompletion([
      { role: "system", content: buildMaterialSystemPrompt(params) },
      { role: "user", content: `Tema: "${params.topic}".` },
    ], true, 90000);

    return {
      material: normalizeMaterialOutput(result.parsed || {}, params),
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }

  async generateLessonDocument(params: LessonDocumentParams): Promise<LessonDocumentOutput> {
    const systemPrompt = `Eres un diseñador pedagógico experto en ${params.subject}. Genera un documento de lección completo y listo para imprimir en JSON con EXACTAMENTE esta estructura (completa y con datos reales, no placeholders):
{
  "title": "Título principal atractivo (máx 6 palabras)",
  "subtitle": "Subtítulo descriptivo del tema",
  "level": "${params.level}",
  "audience": "${params.audience}",
  "subject": "${params.subject}",
  "tagline": "Frase motivadora corta en español",
  "learningPath": ["Secciones 01-02: descripción breve", "Secciones 03-05: descripción breve", "Secciones 06-07: descripción breve", "Secciones 08-10: descripción breve"],
  "sections": [
    { "number": "01", "theme": "VOCABULARIO ESENCIAL", "title": "Título sección 01", "type": "vocabulary", "body": "Párrafo introductorio de 2-3 oraciones.", "table": { "headers": ["Español", "English", "Ejemplo"], "rows": [["palabra1","word1","oración1"], ["palabra2","word2","oración2"], ["palabra3","word3","oración3"], ["palabra4","word4","oración4"], ["palabra5","word5","oración5"], ["palabra6","word6","oración6"]] }, "callout": "Nota cultural o gramatical." },
    { "number": "02", "theme": "GRAMÁTICA 1", "title": "Título sección 02", "type": "grammar", "body": "Explicación gramatical clara.", "table": { "headers": ["Estructura", "Uso", "Ejemplo"], "rows": [["estructura1","uso1","ejemplo1"], ["estructura2","uso2","ejemplo2"], ["estructura3","uso3","ejemplo3"]] }, "callout": "Regla clave a recordar." },
    { "number": "03", "theme": "VOCABULARIO AVANZADO", "title": "Título sección 03", "type": "vocabulary", "body": "Ampliación de vocabulario.", "table": { "headers": ["Expresión", "Significado", "Contexto"], "rows": [["expr1","sig1","ctx1"], ["expr2","sig2","ctx2"], ["expr3","sig3","ctx3"], ["expr4","sig4","ctx4"]] }, "callout": "Nota de uso." },
    { "number": "04", "theme": "GRAMÁTICA 2", "title": "Título sección 04", "type": "grammar", "body": "Segunda estructura gramatical.", "table": { "headers": ["Forma", "Regla", "Ejemplo"], "rows": [["forma1","regla1","ej1"], ["forma2","regla2","ej2"], ["forma3","regla3","ej3"]] }, "callout": "Excepción importante." },
    { "number": "05", "theme": "USO EN CONTEXTO", "title": "Título sección 05", "type": "grammar", "body": "Aplicación en contexto real.", "table": { "headers": ["Situación", "Frase", "Nota"], "rows": [["sit1","frase1","nota1"], ["sit2","frase2","nota2"], ["sit3","frase3","nota3"]] }, "callout": "Tip de pronunciación o acento." },
    { "number": "06", "theme": "COMPARACIONES Y CONTRASTES", "title": "Título sección 06", "type": "vocabulary", "body": "Diferencias clave entre formas.", "table": { "headers": ["Evita", "Prefiere", "Por qué"], "rows": [["error1","correcto1","razón1"], ["error2","correcto2","razón2"], ["error3","correcto3","razón3"]] }, "callout": "Error más común entre angloparlantes." },
    { "number": "07", "theme": "CONVERSACIÓN REAL", "title": "Diálogo y expresiones orales", "type": "conversation", "body": "Diálogo completo entre dos personas (A y B) usando el vocabulario y gramática de la lección.", "table": { "headers": ["Expresión oral", "English", "Cuándo usarla"], "rows": [["expr1","eng1","ctx1"], ["expr2","eng2","ctx2"], ["expr3","eng3","ctx3"], ["expr4","eng4","ctx4"]] }, "table2": { "headers": ["Error común", "Corrección", "Regla"], "rows": [["err1","cor1","regla1"], ["err2","cor2","regla2"], ["err3","cor3","regla3"]] }, "callout": "Consejo para sonar más natural." },
    { "number": "08", "theme": "PRÁCTICA 1", "title": "Reconoce y construye", "type": "practice", "body": "Trabaja individualmente.", "exercises": [ { "label": "A. Relaciona", "instruction": "Une cada palabra o expresión con su traducción o significado.", "items": ["1. palabra1 ___", "2. palabra2 ___", "3. palabra3 ___", "4. palabra4 ___", "5. palabra5 ___", "a) sig5", "b) sig1", "c) sig3", "d) sig2", "e) sig4"], "answerKey": "1b, 2d, 3c, 4e, 5a." }, { "label": "B. Completa", "instruction": "Completa las oraciones con la forma correcta.", "items": ["1. Oración con hueco ___________.", "2. Oración con hueco ___________.", "3. Oración con hueco ___________.", "4. Oración con hueco ___________."], "answerKey": "1. respuesta1; 2. respuesta2; 3. respuesta3; 4. respuesta4." }, { "label": "C. Elige la opción correcta", "instruction": "Selecciona la opción que completa correctamente la frase.", "items": ["1. Oración (opción A / opción B / opción C).", "2. Oración (opción A / opción B / opción C).", "3. Oración (opción A / opción B / opción C)."], "answerKey": "1. opción correcta; 2. opción correcta; 3. opción correcta." }, { "label": "D. Transforma", "instruction": "Transforma las frases según el modelo.", "items": ["Modelo: frase original → frase transformada", "1. frase1 →", "2. frase2 →", "3. frase3 →"], "answerKey": "1. transformación1; 2. transformación2; 3. transformación3." } ] },
    { "number": "09", "theme": "LECTURA Y APLICACIÓN", "title": "Práctica 2 · Situación real", "type": "practice", "body": "Lee el siguiente texto corto y responde.", "exercises": [ { "label": "Texto", "instruction": "Lee atentamente: [texto corto de 80-100 palabras relacionado con el tema de la lección]", "items": [] }, { "label": "A. Comprensión", "instruction": "Responde en español.", "items": ["1. ¿Pregunta sobre el texto?", "2. ¿Pregunta sobre el texto?", "3. ¿Pregunta sobre el texto?"], "answerKey": "1. respuesta; 2. respuesta; 3. respuesta." }, { "label": "B. Aplica", "instruction": "Escribe una oración usando el vocabulario del texto.", "items": ["_______________________________________________"], "answerKey": "Modelo: oración modelo de aplicación." }, { "label": "C. Corrige el error", "instruction": "Estas frases tienen un error. Corrígelo.", "items": ["1. Frase incorrecta con error.", "2. Frase incorrecta con error.", "3. Frase incorrecta con error."], "answerKey": "1. Versión correcta. 2. Versión correcta. 3. Versión correcta." } ] },
    { "number": "10", "theme": "PRODUCCIÓN Y AUTOEVALUACIÓN", "title": "Práctica 3 · Tu propia producción", "type": "practice", "body": "Completa las actividades de producción libre.", "exercises": [ { "label": "A. Diseña tu propio ejemplo", "instruction": "Completa con información real tuya.", "items": ["Mi nombre / tema personal: ___________", "Datos relevantes 1: ___________", "Datos relevantes 2: ___________", "Mi oración con vocabulario nuevo: ___________"] }, { "label": "B. Escribe", "instruction": "Escribe un párrafo de 60-80 palabras usando las estructuras de la lección.", "items": ["_______________________________________________", "_______________________________________________", "_______________________________________________", "_______________________________________________"] }, { "label": "C. Ya puedo… (Autoevaluación)", "instruction": "Marca lo que ahora puedes hacer.", "items": ["☐ Habilidad 1 que se trabaja en esta lección.", "☐ Habilidad 2 que se trabaja en esta lección.", "☐ Habilidad 3 que se trabaja en esta lección.", "☐ Habilidad 4 que se trabaja en esta lección.", "☐ Habilidad 5 que se trabaja en esta lección."] } ] }
  ]
}
CRÍTICO: Sustituye TODO con contenido pedagógico REAL sobre el tema. Las tablas deben tener datos concretos. Los ejercicios deben tener ítems completos y respondibles. El diálogo en sección 07 debe ser real. Nunca escribas "placeholder" ni dejes campos vacíos.`;

    const result = await this.callChatCompletion([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Tema: "${params.topic}". Nivel: ${params.level}. Audiencia: ${params.audience}. Asignatura: ${params.subject}. Idioma de apoyo: ${params.teacherLanguage || "English"}.` },
    ], true, 120000);

    const json = result.parsed as Record<string, unknown>;
    return {
      title: (json.title as string) || params.topic,
      subtitle: (json.subtitle as string) || "",
      level: (json.level as string) || params.level,
      audience: (json.audience as string) || params.audience,
      subject: (json.subject as string) || params.subject,
      tagline: (json.tagline as string) || "",
      learningPath: Array.isArray(json.learningPath) ? (json.learningPath as string[]) : [],
      sections: Array.isArray(json.sections) ? (json.sections as LessonDocumentSection[]) : [],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCost: result.estimatedCost,
    };
  }
}

/**
 * Fábrica centralizada de adaptadores de IA que selecciona el proveedor activo según configuración y entorno.
 * Aplica Fail-Fast estricto cuando se solicita OpenAI y no se cuenta con OPENAI_API_KEY.
 */
/** Construye el adaptador de un proveedor concreto. */
function buildAdapter(provider: string, model?: string): AIProviderAdapter {
  switch (provider) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error("OPENAI_API_KEY_MISSING: falta la clave de OpenAI.");
      return new OpenAIAdapter(apiKey, model || process.env.OPENAI_MODEL, { providerName: "openai" });
    }
    case "openrouter": {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("OPENROUTER_API_KEY_MISSING: falta la clave de OpenRouter.");
      return new OpenAIAdapter(apiKey, model || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini", {
        baseURL: "https://openrouter.ai/api/v1",
        providerName: "openrouter",
      });
    }
    case "nvidia":
    case "deepseek": {
      // NVIDIA NIM (build.nvidia.com): API compatible con OpenAI
      const apiKey = process.env.NVIDIA_API_KEY;
      if (!apiKey) throw new Error("NVIDIA_API_KEY_MISSING: falta la clave de NVIDIA.");
      return new OpenAIAdapter(apiKey, model || process.env.NVIDIA_MODEL || "deepseek-ai/deepseek-v4.1-flash", {
        baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
        providerName: "nvidia",
        jsonMode: process.env.NVIDIA_JSON_MODE === "true",
        // El endpoint gratuito puede tardar minutos: sin reintentos, para que el respaldo entre antes
        timeoutMs: Number(process.env.NVIDIA_TIMEOUT_MS) || 180000,
        maxRetries: 0,
      });
    }
    case "anthropic":
    case "claude": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY_MISSING: falta la clave de Anthropic.");
      return new AnthropicAdapter(apiKey, model || process.env.ANTHROPIC_MODEL);
    }
    case "mock":
      return new MockAIAdapter();
    default:
      throw new Error(`AI_PROVIDER no reconocido: "${provider}". Usa openai, anthropic, openrouter, nvidia o mock.`);
  }
}

/**
 * Enrutador de proveedores.
 *
 * Existe por resiliencia, no por precio: el texto cuesta ~0.2% del ingreso, pero
 * si el proveedor principal se cae, la plataforma deja de generar clases. Con
 * AI_FALLBACK_PROVIDER configurado, el respaldo entra automáticamente.
 *
 * `tier` permite usar un modelo barato para tareas sencillas y uno mejor para
 * el Agente de Clase, sin tocar código.
 */
export function getAIAdapter(
  providerOverride?: string,
  tier: "simple" | "premium" = "premium"
): AIProviderAdapter {
  const isProduction = process.env.NODE_ENV === "production";
  const primary = (providerOverride || process.env.AI_PROVIDER || (isProduction ? "openai" : "mock")).toLowerCase();

  const model = tier === "simple" ? process.env.AI_MODEL_SIMPLE : process.env.AI_MODEL_PREMIUM;

  const primaryAdapter = buildAdapter(primary, model || undefined);

  if (primary === "mock" && isProduction) {
    console.warn("[AIProvider] ADVERTENCIA: Producción usando MockAIAdapter por override explícito.");
  }

  const fallbackName = (process.env.AI_FALLBACK_PROVIDER || "").toLowerCase();
  if (!fallbackName || fallbackName === primary) return primaryAdapter;

  try {
    const fallbackAdapter = buildAdapter(fallbackName, model || undefined);
    return new FallbackAIAdapter(primaryAdapter, fallbackAdapter);
  } catch (error) {
    // Un respaldo mal configurado no debe tumbar al proveedor principal
    console.warn("[AIProvider] Respaldo no disponible:", error instanceof Error ? error.message : error);
    return primaryAdapter;
  }
}

import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProviderAdapter,
  CourseGenParams, CourseStructureOutput,
  LessonGenParams, LessonGenOutput,
  ActivityGenParams, ActivityGenOutput,
  QuizGenParams, QuizGenOutput,
  LandingGenParams, LandingGenOutput,
  LessonRegenParams, LessonRegenOutput,
  CourseRegenParams, CourseRegenOutput,
  AITutorParams, AITutorOutput,
  AIFeedbackParams, AIFeedbackOutput,
} from "./ai.adapter";
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

/**
 * Proveedor Claude (Anthropic).
 *
 * Vive en su propio archivo, separado del adaptador de OpenAI: cada proveedor
 * tiene su SDK y sus particularidades, y mezclarlos complica el mantenimiento.
 * El enrutador (ai.adapter.ts) decide cuál se usa.
 *
 * Requiere ANTHROPIC_API_KEY de console.anthropic.com. La suscripción de
 * Claude.ai NO sirve: la API se factura por separado.
 */

const DEFAULT_MODEL = "claude-opus-5";

/** Precios por millón de tokens, para la auditoría económica. */
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export class AnthropicAdapter implements AIProviderAdapter {
  providerName = "anthropic";
  modelName: string;
  private client: Anthropic;

  constructor(apiKey?: string, model?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("ANTHROPIC_API_KEY_MISSING: falta la clave de Anthropic (console.anthropic.com).");
    }
    this.modelName = model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
    this.client = new Anthropic({ apiKey: key });
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    const price = PRICING[this.modelName] || PRICING[DEFAULT_MODEL];
    return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  }

  /**
   * Pide una respuesta en JSON y la analiza.
   *
   * Los prompts del sistema ya especifican las claves exactas del JSON, así que
   * se reutilizan tal cual entre proveedores. Se limpia el vallado de markdown
   * porque algunos modelos lo añaden aunque se pida JSON puro.
   */
  private async callJson(systemPrompt: string, userPrompt: string) {
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 16000,
      system: `${systemPrompt}\n\nResponde ÚNICAMENTE con el objeto JSON, sin texto antes ni después y sin vallado de markdown.`,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("ANTHROPIC_REFUSAL: el modelo declinó la petición por motivos de seguridad.");
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("ANTHROPIC_INVALID_JSON: la respuesta no era un JSON válido.");
    }

    const promptTokens = response.usage.input_tokens;
    const completionTokens = response.usage.output_tokens;

    return {
      parsed,
      promptTokens,
      completionTokens,
      estimatedCost: this.estimateCost(promptTokens, completionTokens),
    };
  }

  async generateCourseStructure(params: CourseGenParams): Promise<CourseStructureOutput> {
    const r = await this.callJson(
      `Eres un diseñador curricular experto. Genera una estructura de curso en JSON con las claves: "title" (string), "description" (string), "level" (string) y "modules" (array con "title", "description" y "lessons" (array con "title" y "summary")). Idioma: ${params.language || "es"}.`,
      `Tema: "${params.topic}". Nivel: ${params.level || "B1"}.${params.countryStandard ? ` Estándar: ${params.countryStandard}.` : ""}`
    );
    const json = r.parsed as Record<string, never>;
    return {
      title: (json.title as string) || params.topic,
      description: (json.description as string) || "",
      level: (json.level as string) || params.level || "B1",
      modules: Array.isArray(json.modules) ? json.modules : [],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async generateLessonContent(params: LessonGenParams): Promise<LessonGenOutput> {
    const lang = params.language || "es";
    const r = await this.callJson(
      buildLessonContentSystemPrompt(lang, params.level),
      buildLessonContentUserPrompt(params, lang)
    );
    const json = r.parsed as Record<string, never>;
    return {
      lessonTitle: (json.lessonTitle as string) || params.lessonTitle,
      summary: (json.summary as string) || "",
      blocks: Array.isArray(json.blocks) ? json.blocks : [],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async generateActivity(params: ActivityGenParams): Promise<ActivityGenOutput> {
    const r = await this.callJson(
      `Eres un diseñador de actividades pedagógicas. Genera una actividad en JSON con las claves: "title", "description" e "instructions" (array de strings). Idioma: ${params.language || "es"}.`,
      `Tema: "${params.topic}". Nivel: ${params.level || "B1"}.`
    );
    const json = r.parsed as Record<string, never>;
    return {
      title: (json.title as string) || "Actividad",
      description: (json.description as string) || "",
      instructions: Array.isArray(json.instructions) ? json.instructions : [],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async generateQuiz(params: QuizGenParams): Promise<QuizGenOutput> {
    const r = await this.callJson(
      `Eres un evaluador pedagógico. Genera un quiz en JSON con las claves: "title" y "questions" (array con "question", "options" [4 opciones], "correctAnswerIndex" [0-3] y "explanation"). Idioma: ${params.language || "es"}.`,
      `Tema: "${params.topic}". Nivel: ${params.level || "B1"}. Preguntas: ${params.questionCount || 5}.`
    );
    const json = r.parsed as Record<string, never>;
    return {
      title: (json.title as string) || `Quiz: ${params.topic}`,
      questions: Array.isArray(json.questions) ? json.questions : [],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async generateLandingPage(params: LandingGenParams): Promise<LandingGenOutput> {
    const r = await this.callJson(
      `Eres un copywriter educativo de alta conversión. Genera el texto de una landing en JSON con las claves: "headline", "subheadline", "benefits" (array de strings) y "callToAction". Idioma: ${params.language || "es"}.`,
      `Curso: "${params.courseTitle}". Público: ${params.targetAudience || "estudiantes"}.`
    );
    const json = r.parsed as Record<string, never>;
    return {
      headline: (json.headline as string) || params.courseTitle,
      subheadline: (json.subheadline as string) || "",
      benefits: Array.isArray(json.benefits) ? json.benefits : [],
      callToAction: (json.callToAction as string) || "Inscríbete ahora",
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async regenerateLessonContent(params: LessonRegenParams): Promise<LessonRegenOutput> {
    const r = await this.callJson(
      `Eres un profesor experto en optimización pedagógica. Regenera el contenido de una lección aplicando el feedback del docente, en JSON con las claves: "lessonTitle", "summary" y "blocks" (array con "id", "type", "title", "content"). Idioma: ${params.language || "es"}.`,
      `Lección: "${params.lessonTitle}". Tema: "${params.topic}". Nivel: ${params.level}. Feedback del profesor: ${params.feedback || "mejorar claridad"}.`
    );
    const json = r.parsed as Record<string, never>;
    return {
      lessonTitle: (json.lessonTitle as string) || params.lessonTitle,
      summary: (json.summary as string) || "",
      blocks: Array.isArray(json.blocks) ? json.blocks : [],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async regenerateCourseStructure(params: CourseRegenParams): Promise<CourseRegenOutput> {
    const r = await this.callJson(
      `Eres un diseñador curricular experto. Regenera la estructura del curso aplicando el feedback, en JSON con las claves: "title", "description", "level" y "modules". Idioma: ${params.language || "es"}.`,
      `Tema: "${params.topic}". Nivel: ${params.level}. Público: ${params.audience || "general"}. Feedback: ${params.feedback || "mejorar la progresión"}.`
    );
    const json = r.parsed as Record<string, never>;
    return {
      title: (json.title as string) || params.topic,
      description: (json.description as string) || "",
      level: (json.level as string) || params.level || "B1",
      modules: Array.isArray(json.modules) ? json.modules : [],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async askAITutor(params: AITutorParams): Promise<AITutorOutput> {
    const r = await this.callJson(
      `Eres un tutor pedagógico paciente y claro. Responde en JSON con las claves: "answer" (explicación clara) y "suggestedFollowUps" (array con 2 preguntas de profundización). Idioma: ${params.language || "es"}.`,
      `Contexto: "${params.context || "clase"}". Pregunta del alumno: "${params.question}".`
    );
    const json = r.parsed as Record<string, never>;
    return {
      answer: (json.answer as string) || "",
      suggestedFollowUps: Array.isArray(json.suggestedFollowUps) ? json.suggestedFollowUps : [],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async getAIFeedback(params: AIFeedbackParams): Promise<AIFeedbackOutput> {
    const r = await this.callJson(
      `Eres un evaluador docente. Analiza la entrega en JSON con las claves: "feedback" (string detallado), "score" (entero 0-100), "strengths" (array) y "areasToImprove" (array). Idioma: ${params.language || "es"}.`,
      `Ejercicio: "${params.exerciseContext}". Entrega del estudiante: "${params.studentSubmission}".`
    );
    const json = r.parsed as Record<string, never>;
    const rawScore = json.score as unknown;
    return {
      feedback: (json.feedback as string) || "",
      score: typeof rawScore === "number" ? Math.max(0, Math.min(100, rawScore)) : 85,
      strengths: Array.isArray(json.strengths) ? json.strengths : [],
      areasToImprove: Array.isArray(json.areasToImprove) ? json.areasToImprove : [],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async generateFullClass(params: ClassAgentParams): Promise<ClassAgentOutput> {
    const r = await this.callJson(
      buildClassAgentSystemPrompt(params),
      `Prepara la clase completa sobre: "${params.topic}".`
    );
    return {
      ...normalizeClassAgentOutput(r.parsed, params),
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async generateClassPlan(params: ClassPlanParams): Promise<ClassPlanOutput> {
    const r = await this.callJson(
      buildClassPlanSystemPrompt(params),
      `Prepara el plan de clase completo sobre: "${params.topic}".`
    );
    return {
      ...normalizeClassPlanOutput(r.parsed, params),
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async generatePresentationDeck(params: AiDeckParams): Promise<AiDeckOutput> {
    const r = await this.callJson(buildAiDeckPrompt(params), `Lección: "${params.lessonTitle}".\n\n${params.lessonText}`);
    return {
      slides: normalizeAiDeck(r.parsed, params),
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async generateMaterial(params: MaterialGenParams): Promise<MaterialGenOutput> {
    const r = await this.callJson(buildMaterialSystemPrompt(params), `Tema: "${params.topic}".`);
    return {
      material: normalizeMaterialOutput(r.parsed, params),
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }

  async generateLessonDocument(params: import("./ai.adapter").LessonDocumentParams): Promise<import("./ai.adapter").LessonDocumentOutput> {
    const systemPrompt = `Eres un diseñador pedagógico experto en ${params.subject}. Crea un documento de lección completo y listo para imprimir en JSON con esta estructura exacta:
{
  "title": "Título principal (máx 6 palabras, llamativo)",
  "subtitle": "Subtítulo en inglés o español describiendo el tema",
  "level": "${params.level}",
  "audience": "${params.audience}",
  "subject": "${params.subject}",
  "tagline": "Una frase corta motivadora en español",
  "learningPath": ["Sección 01-02: descripción breve", "Sección 03-05: descripción breve", "Sección 06-07: descripción breve", "Sección 08-10: descripción breve"],
  "sections": [
    {
      "number": "01",
      "theme": "TEMA DE LA SECCIÓN EN MAYÚSCULAS",
      "title": "Título de la sección",
      "type": "vocabulary",
      "body": "Párrafo explicativo de 2-3 oraciones con introducción al tema.",
      "table": {
        "headers": ["Columna 1", "Columna 2", "Columna 3"],
        "rows": [["celda", "celda", "celda"]]
      },
      "callout": "Nota cultural o gramatical importante en una oración."
    },
    {
      "number": "02",
      "theme": "TEMA",
      "title": "Título",
      "type": "grammar",
      "body": "Explicación...",
      "table": { "headers": [...], "rows": [[...]] },
      "callout": "Nota..."
    },
    {
      "number": "03",
      "theme": "TEMA",
      "title": "Título",
      "type": "grammar",
      "body": "Explicación...",
      "table": { "headers": [...], "rows": [[...]] },
      "callout": "Nota..."
    },
    {
      "number": "04",
      "theme": "TEMA",
      "title": "Título",
      "type": "vocabulary",
      "body": "Explicación...",
      "table": { "headers": [...], "rows": [[...]] },
      "callout": "Nota..."
    },
    {
      "number": "05",
      "theme": "TEMA",
      "title": "Título",
      "type": "grammar",
      "body": "Explicación...",
      "table": { "headers": [...], "rows": [[...]] },
      "callout": "Nota..."
    },
    {
      "number": "06",
      "theme": "TEMA",
      "title": "Título",
      "type": "vocabulary",
      "body": "Explicación...",
      "table": { "headers": [...], "rows": [[...]] },
      "callout": "Nota..."
    },
    {
      "number": "07",
      "theme": "CONVERSACIÓN Y ERRORES",
      "title": "Del tema a la práctica oral",
      "type": "conversation",
      "body": "Diálogo de ejemplo entre dos personas...",
      "table": {
        "headers": ["Expresión", "English", "Ejemplo"],
        "rows": [["expresión", "traducción", "ejemplo"]]
      },
      "table2": {
        "headers": ["Evita", "Usa", "Recuerda"],
        "rows": [["error", "correcto", "regla"]]
      },
      "callout": "Nota..."
    },
    {
      "number": "08",
      "theme": "PRÁCTICA 1",
      "title": "Reconoce y construye",
      "type": "practice",
      "body": "Resuelve individualmente.",
      "exercises": [
        {
          "label": "A. Actividad tipo matching",
          "instruction": "Une cada palabra con su significado.",
          "items": ["1. palabra ___", "2. palabra ___"],
          "answerKey": "A: 1b, 2a."
        },
        {
          "label": "B. Completa",
          "instruction": "Completa con la forma correcta.",
          "items": ["1. Oración con hueco ___________.", "2. Oración con hueco ___________."],
          "answerKey": "B: 1 respuesta, 2 respuesta."
        },
        {
          "label": "C. Transforma",
          "instruction": "Transforma las frases.",
          "items": ["1. Frase original. → ___________", "2. Frase original. → ___________"],
          "answerKey": "C: 1 respuesta; 2 respuesta."
        },
        {
          "label": "D. Elige",
          "instruction": "Elige la opción correcta.",
          "items": ["1. Frase (opción A / opción B).", "2. Frase (opción A / opción B)."],
          "answerKey": "D: 1 opción A, 2 opción B."
        }
      ]
    },
    {
      "number": "09",
      "theme": "LECTURA Y APLICACIÓN",
      "title": "Práctica 2 · Situación real",
      "type": "practice",
      "body": "Lee el texto y responde.",
      "exercises": [
        {
          "label": "A. Comprende",
          "instruction": "Responde en español.",
          "items": ["1. Pregunta ___________", "2. Pregunta ___________"],
          "answerKey": "A1 respuesta. A2 respuesta."
        },
        {
          "label": "B. Relaciona",
          "instruction": "Explica con una frase completa.",
          "items": ["Pregunta abierta de aplicación."],
          "answerKey": "Modelo: respuesta modelo."
        },
        {
          "label": "C. Corrige",
          "instruction": "Corrige el error.",
          "items": ["1. Frase incorrecta."],
          "answerKey": "C: Frase correcta."
        }
      ]
    },
    {
      "number": "10",
      "theme": "PRODUCCIÓN Y AUTOEVALUACIÓN",
      "title": "Práctica 3 · Tu propia producción",
      "type": "practice",
      "body": "Produce de forma individual.",
      "exercises": [
        {
          "label": "A. Diseña",
          "instruction": "Completa la tabla con tus propios datos.",
          "items": ["Información: ___________", "Dato 1: ___________", "Dato 2: ___________"]
        },
        {
          "label": "B. Escribe",
          "instruction": "Escribe un párrafo de 60-80 palabras usando las estructuras de la lección.",
          "items": ["_______________________________________________", "_______________________________________________", "_______________________________________________"]
        },
        {
          "label": "C. Ya puedo… (self-evaluation)",
          "instruction": "Marca lo que puedes hacer.",
          "items": ["☐ Habilidad 1 aprendida en esta lección.", "☐ Habilidad 2.", "☐ Habilidad 3.", "☐ Habilidad 4."]
        }
      ]
    }
  ]
}
IMPORTANTE: Genera contenido pedagógico real y completo para el tema dado. Todas las tablas deben tener datos reales relacionados con el tema. Los ejercicios deben tener ítems concretos, no placeholders. La clave de respuestas (answerKey) debe ser precisa.`;

    const r = await this.callJson(
      systemPrompt,
      `Tema: "${params.topic}". Nivel: ${params.level}. Audiencia: ${params.audience}. Asignatura: ${params.subject}. Idioma de apoyo: ${params.teacherLanguage || "English"}.`
    );

    const json = r.parsed as Record<string, unknown>;
    return {
      title: (json.title as string) || params.topic,
      subtitle: (json.subtitle as string) || "",
      level: (json.level as string) || params.level,
      audience: (json.audience as string) || params.audience,
      subject: (json.subject as string) || params.subject,
      tagline: (json.tagline as string) || "",
      learningPath: Array.isArray(json.learningPath) ? (json.learningPath as string[]) : [],
      sections: Array.isArray(json.sections) ? (json.sections as import("./ai.adapter").LessonDocumentSection[]) : [],
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      estimatedCost: r.estimatedCost,
    };
  }
}

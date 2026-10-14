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
  LessonDocumentParams, LessonDocumentOutput,
} from "./ai.adapter";
import type { ClassAgentParams, ClassAgentOutput } from "./class-agent.schema";
import type { ClassPlanParams, ClassPlanOutput } from "./class-plan.schema";
import type { MaterialGenParams, MaterialGenOutput } from "./material-tools";
import type { AiDeckParams, AiDeckOutput } from "@/modules/presentation/ai-deck.schema";
import type { PresentationPlanCall, PresentationPlanRaw } from "./ai.adapter";

/**
 * Adaptador con proveedor de respaldo.
 *
 * Si el principal falla (caída, límite de cuota, timeout), reintenta con el
 * secundario antes de dar error al profesor. El objetivo no es ahorrar: es que
 * una caída de OpenAI no deje la plataforma sin generar clases.
 *
 * Importante: solo se reintenta cuando el fallo es del proveedor. Un error de
 * créditos o de validación ocurre antes de llegar aquí, en el motor de créditos.
 */
export class FallbackAIAdapter implements AIProviderAdapter {
  providerName: string;
  modelName: string;

  constructor(
    private primary: AIProviderAdapter,
    private fallback: AIProviderAdapter
  ) {
    this.providerName = primary.providerName;
    this.modelName = primary.modelName;
  }

  private async withFallback<T>(operation: string, run: (adapter: AIProviderAdapter) => Promise<T>): Promise<T> {
    try {
      return await run(this.primary);
    } catch (error) {
      console.warn(
        `[AIProvider] ${this.primary.providerName} falló en ${operation}; reintentando con ${this.fallback.providerName}.`,
        error instanceof Error ? error.message : error
      );
      // El registro de uso debe reflejar quién respondió de verdad
      this.providerName = this.fallback.providerName;
      this.modelName = this.fallback.modelName;
      return await run(this.fallback);
    }
  }

  generateCourseStructure(p: CourseGenParams): Promise<CourseStructureOutput> {
    return this.withFallback("generateCourseStructure", (a) => a.generateCourseStructure(p));
  }
  generateLessonContent(p: LessonGenParams): Promise<LessonGenOutput> {
    return this.withFallback("generateLessonContent", (a) => a.generateLessonContent(p));
  }
  generateActivity(p: ActivityGenParams): Promise<ActivityGenOutput> {
    return this.withFallback("generateActivity", (a) => a.generateActivity(p));
  }
  generateQuiz(p: QuizGenParams): Promise<QuizGenOutput> {
    return this.withFallback("generateQuiz", (a) => a.generateQuiz(p));
  }
  generateLandingPage(p: LandingGenParams): Promise<LandingGenOutput> {
    return this.withFallback("generateLandingPage", (a) => a.generateLandingPage(p));
  }
  regenerateLessonContent(p: LessonRegenParams): Promise<LessonRegenOutput> {
    return this.withFallback("regenerateLessonContent", (a) => a.regenerateLessonContent(p));
  }
  regenerateCourseStructure(p: CourseRegenParams): Promise<CourseRegenOutput> {
    return this.withFallback("regenerateCourseStructure", (a) => a.regenerateCourseStructure(p));
  }
  askAITutor(p: AITutorParams): Promise<AITutorOutput> {
    return this.withFallback("askAITutor", (a) => a.askAITutor(p));
  }
  getAIFeedback(p: AIFeedbackParams): Promise<AIFeedbackOutput> {
    return this.withFallback("getAIFeedback", (a) => a.getAIFeedback(p));
  }
  generateFullClass(p: ClassAgentParams): Promise<ClassAgentOutput> {
    return this.withFallback("generateFullClass", (a) => a.generateFullClass(p));
  }
  generateClassPlan(p: ClassPlanParams): Promise<ClassPlanOutput> {
    return this.withFallback("generateClassPlan", (a) => a.generateClassPlan(p));
  }
  generatePresentationDeck(p: AiDeckParams): Promise<AiDeckOutput> {
    return this.withFallback("generatePresentationDeck", (a) => a.generatePresentationDeck(p));
  }
  generatePresentationPlan(p: PresentationPlanCall): Promise<PresentationPlanRaw> {
    return this.withFallback("generatePresentationPlan", (a) => a.generatePresentationPlan(p));
  }
  generateMaterial(p: MaterialGenParams): Promise<MaterialGenOutput> {
    return this.withFallback("generateMaterial", (a) => a.generateMaterial(p));
  }
  generateLessonDocument(p: LessonDocumentParams): Promise<LessonDocumentOutput> {
    return this.withFallback("generateLessonDocument", (a) => a.generateLessonDocument(p));
  }
}

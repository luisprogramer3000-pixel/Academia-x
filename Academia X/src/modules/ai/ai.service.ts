import { prisma } from "@/lib/db";
import {
  getAIAdapter,
  CourseGenParams,
  LessonGenParams,
  ActivityGenParams,
  QuizGenParams,
  LandingGenParams,
  LessonRegenParams,
  CourseRegenParams,
  AITutorParams,
  AIFeedbackParams,
  LessonDocumentParams,
  LessonDocumentOutput,
} from "./ai.adapter";
import { CourseService } from "@/modules/course/course.service";
import { AICreditEngine } from "./ai.credit-engine";
import { AIOperation } from "@prisma/client";
import { getPlanAIConfig } from "./ai.config";
import { ClassAgentParams, ClassAgentOutput } from "./class-agent.schema";
import { ClassPlanParams, ClassPlanOutput, type ClassPlanMaterial } from "./class-plan.schema";
import type { MaterialGenParams, MaterialGenOutput } from "./material-tools";
import type { AiDeckParams, AiDeckOutput } from "@/modules/presentation/ai-deck.schema";
import { generateClassImage, ImageQuality } from "./image.adapter";
import { saveGeneratedImage } from "@/lib/uploads";

export interface GenerateCourseDraftInput extends CourseGenParams {
  tenantId: string;
  userId: string;
  idempotencyKey?: string;
}

export interface GenerateLessonContentInput extends LessonGenParams {
  tenantId: string;
  userId: string;
  lessonId: string;
  idempotencyKey?: string;
}

export interface GenerateActivityInput extends ActivityGenParams {
  tenantId: string;
  userId: string;
  idempotencyKey?: string;
}

export interface GenerateQuizInput extends QuizGenParams {
  tenantId: string;
  userId: string;
  idempotencyKey?: string;
}

export interface GenerateLandingPageInput extends LandingGenParams {
  tenantId: string;
  userId: string;
  idempotencyKey?: string;
}

export interface RegenerateLessonContentInput extends LessonRegenParams {
  tenantId: string;
  userId: string;
  lessonId: string;
  idempotencyKey?: string;
}

export interface RegenerateCourseStructureInput extends CourseRegenParams {
  tenantId: string;
  userId: string;
  courseId?: string;
  idempotencyKey?: string;
}

export interface AskAITutorInput extends AITutorParams {
  tenantId: string;
  userId: string;
  idempotencyKey?: string;
}

export interface GetAIFeedbackInput extends AIFeedbackParams {
  tenantId: string;
  userId: string;
  idempotencyKey?: string;
}

export const PLAN_AI_TOKENS_LIMIT: Record<string, number> = {
  STARTER: 50000,
  PRO: 250000,
  ACADEMY: 1000000,
};

export class AIService {
  /**
   * Garantiza que el tenant tenga una wallet de créditos con valores por defecto si no existe.
   */
  private static async ensureTenantContext(tenantId: string) {
    const wallet = await prisma.aICreditWallet.findUnique({
      where: { tenantId },
    });

    if (!wallet) {
      const config = getPlanAIConfig("STARTER");
      const resetAt = new Date();
      resetAt.setMonth(resetAt.getMonth() + 1);

      await prisma.aICreditWallet.create({
        data: {
          tenantId,
          teacherCredits: config.teacherAllowance,
          studentCredits: config.studentAllowance,
          monthlyTeacherAllowance: config.teacherAllowance,
          monthlyStudentAllowance: config.studentAllowance,
          resetAt,
        },
      });
    }
  }

  /**
   * Resuelve el tenant, el usuario y verifica los límites de consumo antes de ejecutar.
   */
  private static async resolveTenantAndUser(tenantId: string, userId?: string) {
    let validTenantId = tenantId;
    let validUserId = userId || "user_founder_id";

    const tenantExists = await prisma.tenant.findUnique({ where: { id: validTenantId } });
    if (tenantExists) {
      const userExists = await prisma.user.findUnique({ where: { id: validUserId } });
      if (!userExists) {
        const fallbackUser = await prisma.user.findFirst();
        if (fallbackUser) validUserId = fallbackUser.id;
      }
      await AIService.ensureTenantContext(validTenantId);
    }

    const stats = await AIService.getAIUsageStats(validTenantId);
    if (stats.isExceeded) {
      throw new Error(`Límite mensual de IA alcanzado para el plan ${stats.planId}.`);
    }

    return { validTenantId, validUserId };
  }

  /**
   * Obtiene las estadísticas de consumo de IA para el mes actual de un tenant.
   */
  static async getAIUsageStats(tenantId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const usages = await prisma.aIUsage.findMany({
      where: {
        tenantId,
        createdAt: { gte: startOfMonth },
      },
    });

    const totalPromptTokens = usages.reduce((acc, u) => acc + u.promptTokens, 0);
    const totalCompletionTokens = usages.reduce((acc, u) => acc + u.completionTokens, 0);
    const totalTokens = totalPromptTokens + totalCompletionTokens;
    const totalCost = usages.reduce((acc, u) => acc + Number(u.estimatedCost || 0), 0);

    // Obtener plan del tenant desde suscripción activa
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, status: "active" },
    });

    const planId = (subscription?.planId?.toUpperCase() || "STARTER") as keyof typeof PLAN_AI_TOKENS_LIMIT;
    const limitTokens = PLAN_AI_TOKENS_LIMIT[planId] || 50000;
    const usagePercentage = Math.min(Math.round((totalTokens / limitTokens) * 100), 100);

    return {
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCost,
      callCount: usages.length,
      planId,
      limitTokens,
      usagePercentage,
      isExceeded: totalTokens >= limitTokens,
    };
  }

  /**
   * Genera la estructura completa de un curso con Inteligencia Artificial
   * bajo la regla pedagógica: AI -> REVIEW -> APPROVE -> PUBLISH.
   */
  static async generateCourseDraft(input: GenerateCourseDraftInput) {
    const adapter = getAIAdapter();

    // Resolver Tenant válido en DB
    let validTenantId = input.tenantId;
    let existingTenant = null;

    if (validTenantId && validTenantId !== "demo_tenant_id") {
      existingTenant = await prisma.tenant.findUnique({ where: { id: validTenantId } });
    }

    if (!existingTenant) {
      existingTenant = await prisma.tenant.findFirst();
      if (!existingTenant) {
        existingTenant = await prisma.tenant.create({
          data: {
            name: "Mentor Studio Global Central",
            slug: "central",
            language: "es",
            primaryColor: "#3B82F6",
            secondaryColor: "#F1F5F9",
          },
        });
      }
      validTenantId = existingTenant.id;
    }

    // Resolver Usuario válido en DB
    let validUserId = input.userId;
    let existingUser = null;

    if (validUserId && validUserId !== "user_founder_id") {
      existingUser = await prisma.user.findUnique({ where: { id: validUserId } });
    }

    if (!existingUser) {
      existingUser = await prisma.user.findFirst();
      if (!existingUser) {
        existingUser = await prisma.user.create({
          data: {
            email: "admin@mentorstudioglobal.com",
            name: "Super Admin",
            globalRole: "SUPER_ADMIN",
          },
        });
      }
      validUserId = existingUser.id;
    }

    // Garantizar wallet por defecto para retrocompatibilidad
    await AIService.ensureTenantContext(validTenantId);

    // Verificar límite legacy de IA por plan
    const stats = await AIService.getAIUsageStats(validTenantId);
    if (stats.isExceeded) {
      throw new Error(
        `Ha alcanzado el límite mensual de consumo de IA (${stats.limitTokens.toLocaleString()} tokens) para su plan ${stats.planId}. Actualice su suscripción para continuar.`
      );
    }

    // 1. Consumir créditos a través de AICreditEngine (la única autoridad)
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.COURSE_GENERATION,
      idempotencyKey: input.idempotencyKey,
    });

    try {
      // 2. Invocar al proveedor de IA solo tras consumo exitoso
      const aiOutput = await adapter.generateCourseStructure({
        topic: input.topic,
        level: input.level,
        language: input.language,
        audience: input.audience,
        modulesCount: input.modulesCount,
      });

      // 3. Crear el curso en estado BORRADOR (DRAFT)
      const course = await CourseService.createCourse({
        tenantId: validTenantId,
        title: aiOutput.title,
        description: aiOutput.description,
        level: aiOutput.level,
        language: input.language,
        priceAmount: 99,
        currency: "USD",
      });

      // 4. Crear los módulos y lecciones automáticamente
      for (let mIdx = 0; mIdx < aiOutput.modules.length; mIdx++) {
        const modData = aiOutput.modules[mIdx];
        const createdMod = await CourseService.createModule({
          courseId: course.id,
          title: modData.title,
          description: modData.description,
          order: mIdx + 1,
        });

        for (let lIdx = 0; lIdx < modData.lessons.length; lIdx++) {
          const lessonData = modData.lessons[lIdx];
          await CourseService.createLesson({
            moduleId: createdMod.id,
            title: lessonData.title,
            content: JSON.stringify({
              aiGenerated: true,
              approved: false,
              blocks: [
                {
                  id: `b_${Date.now()}_${lIdx}`,
                  type: "text",
                  title: "Resumen Generado por IA",
                  content: lessonData.summary,
                },
              ],
            }),
            order: lIdx + 1,
          });
        }
      }

      // 5. Registrar el uso de IA en la tabla AIUsage vinculando la transacción de créditos
      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "COURSE_GENERATOR",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (usageError) {
        console.warn("Could not log AIUsage record:", usageError);
      }

      return course;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.COURSE_GENERATION,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  /**
   * Helper privado para ejecutar reembolsos automáticos en caso de fallo del proveedor o guardado.
   */
  private static async executeAutoRefund(
    tenantId: string,
    transactionId: string | undefined,
    userId: string,
    operation: AIOperation,
    error: any,
    idempotencyKey?: string
  ) {
    if (!transactionId) return;
    try {
      await AICreditEngine.refundCredits({
        tenantId,
        transactionId,
        userId,
        reason: error instanceof Error ? error.message : `Execution failed for ${operation}`,
        idempotencyKey: idempotencyKey ? `refund:${idempotencyKey}` : `refund:${transactionId}`,
        metadata: {
          operation,
          errorName: error instanceof Error ? error.name : "UnknownError",
        },
      });
    } catch (refundErr) {
      console.error(
        `CRITICAL: Automatic AI credit refund failed for operation ${operation} (Tx: ${transactionId}):`,
        refundErr
      );
    }
  }

  /**
   * Genera el contenido detallado y bloques pedagógicos para una lección individual con IA.
   */
  static async generateLessonContentAI(input: GenerateLessonContentInput) {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    // 1. Consumir créditos a través de AICreditEngine
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.LESSON_GENERATION,
      idempotencyKey: input.idempotencyKey,
      referenceId: input.lessonId,
    });

    try {
      // 2. Ejecutar el proveedor de IA solo tras verificación de créditos
      const aiOutput = await adapter.generateLessonContent({
        topic: input.topic,
        level: input.level,
        language: input.language,
        lessonTitle: input.lessonTitle,
      });

      const updatedContent = JSON.stringify({
        aiGenerated: true,
        approved: false,
        summary: aiOutput.summary,
        blocks: aiOutput.blocks,
      });

      const lesson = await CourseService.updateLessonContent(input.lessonId, updatedContent);

      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "LESSON_GENERATOR",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for lesson:", err);
      }

      return lesson;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.LESSON_GENERATION,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  /**
   * Genera una actividad pedagógica con IA.
   */
  static async generateActivityAI(input: GenerateActivityInput) {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    // 1. Consumir créditos
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.ACTIVITY_GENERATION,
      idempotencyKey: input.idempotencyKey,
      referenceId: input.lessonId,
    });

    try {
      // 2. Generar con IA
      const aiOutput = await adapter.generateActivity({
        topic: input.topic,
        level: input.level || "B1",
        language: input.language || "es",
        lessonId: input.lessonId,
      });

      // 3. Registrar AIUsage
      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "ACTIVITY_GENERATOR",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for activity:", err);
      }

      return aiOutput;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.ACTIVITY_GENERATION,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  /**
   * Genera un quiz de evaluación con IA.
   */
  static async generateQuizAI(input: GenerateQuizInput) {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    // 1. Consumir créditos
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.QUIZ_GENERATION,
      idempotencyKey: input.idempotencyKey,
    });

    try {
      // 2. Generar con IA
      const aiOutput = await adapter.generateQuiz({
        topic: input.topic,
        level: input.level || "B1",
        language: input.language || "es",
        questionCount: input.questionCount,
      });

      // 3. Registrar AIUsage
      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "QUIZ_GENERATOR",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for quiz:", err);
      }

      return aiOutput;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.QUIZ_GENERATION,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  /**
   * Genera el copywriting para una Landing Page con IA.
   */
  static async generateLandingPageAI(input: GenerateLandingPageInput) {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    // 1. Consumir créditos
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.LANDING_GENERATION,
      idempotencyKey: input.idempotencyKey,
    });

    try {
      // 2. Generar con IA
      const aiOutput = await adapter.generateLandingPage({
        courseTitle: input.courseTitle,
        targetAudience: input.targetAudience,
        language: input.language || "es",
      });

      // 3. Registrar AIUsage
      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "LANDING_GENERATOR",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for landing:", err);
      }

      return aiOutput;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.LANDING_GENERATION,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  /**
   * Regenera el contenido pedagógico de una lección existente.
   */
  static async regenerateLessonContentAI(input: RegenerateLessonContentInput) {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    // 1. Consumir créditos
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.LESSON_REGENERATION,
      idempotencyKey: input.idempotencyKey,
      referenceId: input.lessonId,
    });

    try {
      // 2. Generar con IA
      const aiOutput = await adapter.regenerateLessonContent({
        topic: input.topic,
        level: input.level || "B1",
        language: input.language || "es",
        lessonTitle: input.lessonTitle,
        feedback: input.feedback,
      });

      const updatedContent = JSON.stringify({
        aiGenerated: true,
        approved: false,
        summary: aiOutput.summary,
        blocks: aiOutput.blocks,
      });

      let lesson = null;
      if (input.lessonId) {
        lesson = await CourseService.updateLessonContent(input.lessonId, updatedContent);
      }

      // 3. Registrar AIUsage
      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "LESSON_REGENERATOR",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for lesson regeneration:", err);
      }

      return lesson || aiOutput;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.LESSON_REGENERATION,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  /**
   * Regenera la estructura completa de un curso.
   */
  static async regenerateCourseStructureAI(input: RegenerateCourseStructureInput) {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    // 1. Consumir créditos
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.COURSE_REGENERATION,
      idempotencyKey: input.idempotencyKey,
      referenceId: input.courseId,
    });

    try {
      // 2. Generar con IA
      const aiOutput = await adapter.regenerateCourseStructure({
        topic: input.topic,
        level: input.level || "B1",
        language: input.language || "es",
        audience: input.audience,
        feedback: input.feedback,
      });

      // 3. Registrar AIUsage
      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "COURSE_REGENERATOR",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for course regeneration:", err);
      }

      return aiOutput;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.COURSE_REGENERATION,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  /**
   * Asistente / Tutor Virtual para estudiantes.
   */
  static async askAITutorAI(input: AskAITutorInput) {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    // 1. Consumir créditos (Student credits)
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.AI_TUTOR,
      idempotencyKey: input.idempotencyKey,
    });

    try {
      // 2. Generar respuesta del tutor
      const aiOutput = await adapter.askAITutor({
        question: input.question,
        context: input.context,
        language: input.language || "es",
      });

      // 3. Registrar AIUsage
      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "AI_TUTOR",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for AI Tutor:", err);
      }

      return aiOutput;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.AI_TUTOR,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  /**
   * Feedback automático sobre entregas / ejercicios de estudiantes.
   */
  static async getAIFeedbackAI(input: GetAIFeedbackInput) {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    // 1. Consumir créditos (Student credits)
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.AI_FEEDBACK,
      idempotencyKey: input.idempotencyKey,
    });

    try {
      // 2. Generar feedback con IA
      const aiOutput = await adapter.getAIFeedback({
        studentSubmission: input.studentSubmission,
        exerciseContext: input.exerciseContext,
        language: input.language || "es",
      });

      // 3. Registrar AIUsage
      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "AI_FEEDBACK",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for AI Feedback:", err);
      }

      return aiOutput;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.AI_FEEDBACK,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  /**
   * AGENTE DE CLASE
   *
   * Una sola operación devuelve la clase entera siguiendo el esquema pedagógico.
   * Las imágenes se cobran aparte y de una en una: si la quinta falla, las
   * cuatro anteriores ya están pagadas y entregadas, y el profesor no pierde
   * créditos por las que no recibió.
   */
  static async generateFullClassAI(
    input: ClassAgentParams & {
      tenantId: string;
      userId?: string;
      idempotencyKey?: string;
      lessonId?: string;
      /** "standard" = Flux Schnell (1 crédito) · "hq" = Nano Banana (2 créditos) */
      imageQuality?: ImageQuality;
    }
  ): Promise<ClassAgentOutput & { imagesGenerated: number; imageErrors: string[] }> {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    // 1. Cobrar la clase
    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.CLASS_AGENT,
      idempotencyKey: input.idempotencyKey,
      referenceId: input.lessonId,
    });

    let aiOutput: ClassAgentOutput;
    try {
      aiOutput = await adapter.generateFullClass({
        topic: input.topic,
        level: input.level,
        language: input.language || "es",
        durationMinutes: input.durationMinutes,
        audience: input.audience,
        goal: input.goal,
        methodology: input.methodology,
        imageCount: input.imageCount,
      });

      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "CLASS_AGENT",
            provider: adapter.providerName,
            model: adapter.modelName || "gpt-4o-mini",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for class agent:", err);
      }
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.CLASS_AGENT,
        error,
        input.idempotencyKey
      );
      throw error;
    }

    // 2. Imágenes: cada una es una operación independiente.
    // El nivel de calidad decide proveedor Y coste en créditos.
    const imageQuality: ImageQuality = input.imageQuality || "standard";
    const imageOperation =
      imageQuality === "hq" ? AIOperation.IMAGE_GENERATION_HQ : AIOperation.IMAGE_GENERATION;

    const imageErrors: string[] = [];
    let imagesGenerated = 0;

    for (const [index, brief] of aiOutput.images.entries()) {
      let imageCredit;
      try {
        imageCredit = await AICreditEngine.consumeCredits({
          tenantId: validTenantId,
          userId: validUserId,
          operation: imageOperation,
          idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}-img-${index}` : undefined,
          referenceId: input.lessonId,
        });
      } catch {
        imageErrors.push(`Sin créditos para la imagen ${index + 1}.`);
        break; // si no hay saldo para una, tampoco lo habrá para las siguientes
      }

      try {
        const image = await generateClassImage({ prompt: brief.prompt, quality: imageQuality });
        brief.url = await saveGeneratedImage(validTenantId, image.buffer, image.mimeType);
        imagesGenerated++;

        try {
          await prisma.aIUsage.create({
            data: {
              tenantId: validTenantId,
              userId: validUserId,
              feature: imageQuality === "hq" ? "IMAGE_GENERATION_HQ" : "IMAGE_GENERATION",
              provider: image.provider,
              model: image.model,
              promptTokens: 0,
              completionTokens: 0,
              estimatedCost: image.estimatedCost,
              creditsUsed: imageCredit.creditsUsed,
              creditTransactionId: imageCredit.transactionId || null,
            },
          });
        } catch (err) {
          console.warn("Could not log AIUsage for image:", err);
        }
      } catch (error) {
        // La imagen falló: se devuelven sus créditos, no los de la clase
        await AIService.executeAutoRefund(
          validTenantId,
          imageCredit.transactionId,
          validUserId,
          imageOperation,
          error,
          input.idempotencyKey ? `${input.idempotencyKey}-img-${index}` : undefined
        );
        imageErrors.push(
          `Imagen ${index + 1}: ${error instanceof Error ? error.message : "no se pudo generar"} (créditos devueltos).`
        );
      }
    }

    return { ...aiOutput, imagesGenerated, imageErrors };
  }

  /**
   * Genera las ilustraciones que la IA sugirió en las secciones del plan
   * (imagePrompt), hasta `count`. Cada imagen se cobra aparte y se devuelve
   * si falla; el plan se modifica en sitio con la URL de cada imagen.
   */
  static async attachPlanImages(
    plan: ClassPlanOutput,
    input: { tenantId: string; userId?: string; count: number; quality?: ImageQuality; idempotencyKey?: string }
  ): Promise<{ imagesGenerated: number; imageErrors: string[] }> {
    AIService.ensureImagePrompts(plan, input.count);
    return AIService.attachPromptImages(plan.materials.flatMap((m) => m.sections), input);
  }

  /**
   * Si el profesor pidió N imágenes y la IA sugirió menos, se crean las
   * descripciones que falten a partir de las secciones más visuales:
   * diálogos, escena del reto, lectura y conceptos de la teoría.
   */
  static ensureImagePrompts(plan: ClassPlanOutput, count: number) {
    const all = plan.materials.flatMap((m) => m.sections.map((s) => ({ s, kind: m.kind })));
    let missing = count - all.filter(({ s }) => s.imagePrompt).length;
    if (missing <= 0) return;
    const priority = (x: (typeof all)[number]) =>
      (x.s.dialogue?.length ? 0 : 10) + (({ reto: 1, lectura: 2, resumen: 3 } as Record<string, number>)[x.kind] ?? 9);
    const candidates = all.filter(({ s }) => !s.imagePrompt && (s.body || s.dialogue?.length)).sort((a, b) => priority(a) - priority(b));
    for (const { s } of candidates) {
      if (missing <= 0) break;
      const speakers = [...new Set((s.dialogue ?? []).map((l) => l.speaker))].slice(0, 3);
      const scene = s.body.replace(/[#*|_>-]/g, " ").replace(/\s+/g, " ").slice(0, 220);
      s.imagePrompt = speakers.length
        ? `Jóvenes estudiantes (${speakers.join(", ")}) conversando con naturalidad. Situación: ${s.heading}. ${scene}`
        : `Escena ilustrativa para una clase sobre "${plan.title}": ${s.heading}. ${scene}`;
      missing--;
    }
  }

  /**
   * Genera ilustraciones para cualquier lista de elementos con `imagePrompt`
   * (secciones de un plan, diapositivas…), hasta `count`, y rellena su `imageUrl`.
   * Cada imagen se cobra aparte y se devuelve si falla.
   */
  static async attachPromptImages(
    items: Array<{ imagePrompt?: string; imageUrl?: string }>,
    input: {
      tenantId: string;
      userId?: string;
      count: number;
      quality?: ImageQuality;
      idempotencyKey?: string;
      /** Estilo añadido al prompt; por defecto, ilustración de libro de idiomas */
      styleSuffix?: string;
    }
  ): Promise<{ imagesGenerated: number; imageErrors: string[] }> {
    const targets = items
      .filter((s) => s.imagePrompt && !s.imageUrl)
      .slice(0, Math.max(0, Math.min(6, input.count)));
    if (targets.length === 0) return { imagesGenerated: 0, imageErrors: [] };

    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);
    const quality: ImageQuality = input.quality || "standard";
    const operation = quality === "hq" ? AIOperation.IMAGE_GENERATION_HQ : AIOperation.IMAGE_GENERATION;
    const imageErrors: string[] = [];
    let imagesGenerated = 0;

    for (const [index, section] of targets.entries()) {
      const key = input.idempotencyKey ? `${input.idempotencyKey}-img-${index}` : undefined;
      let credit;
      try {
        credit = await AICreditEngine.consumeCredits({ tenantId: validTenantId, userId: validUserId, operation, idempotencyKey: key });
      } catch {
        imageErrors.push(`Sin créditos para la imagen ${index + 1}.`);
        break;
      }
      try {
        const image = await generateClassImage({
          prompt: `${section.imagePrompt}. ${input.styleSuffix ?? "Ilustración colorida estilo libro de texto de idiomas, personajes jóvenes y diversos con expresiones amables, trazos limpios y fondo sencillo. Sin texto, letras ni bocadillos dentro de la imagen."}`,
          quality,
        });
        section.imageUrl = await saveGeneratedImage(validTenantId, image.buffer, image.mimeType);
        imagesGenerated++;
        try {
          await prisma.aIUsage.create({
            data: {
              tenantId: validTenantId,
              userId: validUserId,
              feature: quality === "hq" ? "IMAGE_GENERATION_HQ" : "IMAGE_GENERATION",
              provider: image.provider,
              model: image.model,
              promptTokens: 0,
              completionTokens: 0,
              estimatedCost: image.estimatedCost,
              creditsUsed: credit.creditsUsed,
              creditTransactionId: credit.transactionId || null,
            },
          });
        } catch (err) {
          console.warn("Could not log AIUsage for plan image:", err);
        }
      } catch (error) {
        await AIService.executeAutoRefund(validTenantId, credit.transactionId, validUserId, operation, error, key);
        imageErrors.push(`Imagen ${index + 1}: ${error instanceof Error ? error.message : "no se pudo generar"} (créditos devueltos).`);
      }
    }
    return { imagesGenerated, imageErrors };
  }

  /**
   * Presentación inteligente: la IA rediseña la lección en diapositivas con
   * estructura visual. Cuesta lo mismo que generar una lección; las
   * ilustraciones opcionales se cobran aparte, una a una.
   */
  static async generatePresentationDeckAI(
    input: AiDeckParams & { tenantId: string; userId?: string; idempotencyKey?: string; lessonId?: string }
  ): Promise<AiDeckOutput & { imageErrors: string[] }> {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.LESSON_GENERATION,
      idempotencyKey: input.idempotencyKey,
      referenceId: input.lessonId,
    });

    let output: AiDeckOutput;
    try {
      const { tenantId: _t, userId: _u, idempotencyKey: _k, lessonId: _l, ...params } = input;
      output = await adapter.generatePresentationDeck(params);
      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "LESSON_GENERATION",
            provider: adapter.providerName,
            model: adapter.modelName || "unknown",
            promptTokens: output.promptTokens,
            completionTokens: output.completionTokens,
            estimatedCost: output.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for presentation:", err);
      }
    } catch (error) {
      await AIService.executeAutoRefund(validTenantId, creditResult.transactionId, validUserId, AIOperation.LESSON_GENERATION, error, input.idempotencyKey);
      throw error;
    }

    const { imageErrors } = input.imageCount
      ? await AIService.attachPromptImages(output.slides as Array<{ imagePrompt?: string; imageUrl?: string }>, {
          tenantId: validTenantId,
          userId: validUserId,
          count: input.imageCount,
          idempotencyKey: input.idempotencyKey,
        })
      : { imageErrors: [] as string[] };

    return { ...output, imageErrors };
  }

  /**
   * Garantiza los 6 materiales de la clase (reto, teoría, lectura, ejercicios,
   * quiz y flashcards). Los que falten o lleguen vacíos se generan en paralelo
   * con la herramienta equivalente, con el mismo nivel, idioma y modo bilingüe.
   * Si alguno falla, la clase se entrega igual con lo que haya.
   */
  static async completeMissingMaterials(adapter: ReturnType<typeof getAIAdapter>, plan: ClassPlanOutput, p: ClassPlanParams) {
    const REQUIRED: Array<{ kind: ClassPlanMaterial["kind"]; tool: MaterialGenParams["toolId"]; count: number }> = [
      { kind: "reto", tool: "reto", count: 4 },
      { kind: "resumen", tool: "apuntes", count: 5 },
      { kind: "lectura", tool: "lectura", count: 6 },
      { kind: "ejercicios", tool: "examen", count: 10 },
      { kind: "quiz", tool: "quiz", count: 6 },
      { kind: "flashcards", tool: "flashcards", count: 12 },
    ];
    const hasContent = (m: ClassPlanMaterial) => m.sections.length > 0 || m.questions.length > 0 || m.cards.length > 0;
    const missing = REQUIRED.filter((r) => !plan.materials.some((m) => m.kind === r.kind && hasContent(m)));
    if (!missing.length) return;

    // Contexto para que los nuevos materiales sean coherentes con la teoría ya generada
    const theory = plan.materials.find((m) => m.kind === "resumen" && hasContent(m));
    const theoryText = theory
      ? theory.sections.map((s) => `${s.heading}: ${s.body} ${s.bullets.join("; ")}`).join("\n").slice(0, 3000)
      : "";
    const context = [
      p.context,
      `Forma parte de la clase "${plan.title}" (${p.methodology}).`,
      theoryText ? `Sé coherente con esta teoría de la clase:\n${theoryText}` : "",
    ].filter(Boolean).join("\n");

    const results = await Promise.allSettled(
      missing.map((r) =>
        adapter.generateMaterial({
          toolId: r.tool,
          topic: p.topic,
          grade: p.grade,
          subject: p.subject,
          language: p.language,
          count: r.count,
          context,
          nativeLanguage: p.nativeLanguage,
        })
      )
    );

    results.forEach((res, i) => {
      if (res.status !== "fulfilled") {
        console.warn(`[class-plan] No se pudo completar el material ${missing[i].kind}:`, res.reason);
        return;
      }
      const kind = missing[i].kind;
      // Sustituye el material vacío del mismo tipo, o añade uno nuevo
      const existing = plan.materials.findIndex((m) => m.kind === kind);
      const id = existing >= 0 ? plan.materials[existing].id : `m${plan.materials.length + 1}`;
      const material = { ...res.value.material, id, kind };
      if (existing >= 0) plan.materials[existing] = material;
      else {
        plan.materials.push(material);
        const moment = plan.moments[kind === "reto" ? 1 : kind === "resumen" ? 2 : plan.moments.length - 1] ?? plan.moments[plan.moments.length - 1];
        moment?.materialIds.push(id);
      }
      plan.promptTokens += res.value.promptTokens;
      plan.completionTokens += res.value.completionTokens;
      plan.estimatedCost += res.value.estimatedCost;
    });
  }

  static async generateClassPlanAI(
    input: ClassPlanParams & { tenantId: string; userId?: string; idempotencyKey?: string }
  ): Promise<ClassPlanOutput> {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.CLASS_AGENT,
      idempotencyKey: input.idempotencyKey,
    });

    try {
      const { tenantId: _t, userId: _u, idempotencyKey: _k, ...params } = input;
      const aiOutput = await adapter.generateClassPlan(params);
      // Los modelos pequeños a veces dejan materiales sin generar: se completan aparte (incluido en el precio de la clase)
      await AIService.completeMissingMaterials(adapter, aiOutput, params);

      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "CLASS_AGENT",
            provider: adapter.providerName,
            model: adapter.modelName || "unknown",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for class plan:", err);
      }

      return aiOutput;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.CLASS_AGENT,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  static async generateMaterialAI(
    input: MaterialGenParams & { tenantId: string; userId?: string; idempotencyKey?: string }
  ): Promise<MaterialGenOutput> {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.ACTIVITY_GENERATION,
      idempotencyKey: input.idempotencyKey,
    });

    try {
      const { tenantId: _t, userId: _u, idempotencyKey: _k, ...params } = input;
      const aiOutput = await adapter.generateMaterial(params);

      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "ACTIVITY_GENERATION",
            provider: adapter.providerName,
            model: adapter.modelName || "unknown",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for material tool:", err);
      }

      return aiOutput;
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.ACTIVITY_GENERATION,
        error,
        input.idempotencyKey
      );
      throw error;
    }
  }

  static async generateLessonDocumentAI(
    input: LessonDocumentParams & { tenantId: string; userId?: string; idempotencyKey?: string }
  ): Promise<LessonDocumentOutput> {
    const adapter = getAIAdapter();
    const { validTenantId, validUserId } = await AIService.resolveTenantAndUser(input.tenantId, input.userId);

    const creditResult = await AICreditEngine.consumeCredits({
      tenantId: validTenantId,
      userId: validUserId,
      operation: AIOperation.LESSON_GENERATION,
      idempotencyKey: input.idempotencyKey,
    });

    let aiOutput: LessonDocumentOutput;
    try {
      aiOutput = await adapter.generateLessonDocument({
        topic: input.topic,
        level: input.level,
        audience: input.audience,
        subject: input.subject,
        teacherLanguage: input.teacherLanguage,
      });

      try {
        await prisma.aIUsage.create({
          data: {
            tenantId: validTenantId,
            userId: validUserId,
            feature: "LESSON_GENERATION",
            provider: adapter.providerName,
            model: adapter.modelName || "claude-opus-5",
            promptTokens: aiOutput.promptTokens,
            completionTokens: aiOutput.completionTokens,
            estimatedCost: aiOutput.estimatedCost,
            creditsUsed: creditResult.creditsUsed,
            creditTransactionId: creditResult.transactionId || null,
          },
        });
      } catch (err) {
        console.warn("Could not log AIUsage for lesson document:", err);
      }
    } catch (error) {
      await AIService.executeAutoRefund(
        validTenantId,
        creditResult.transactionId,
        validUserId,
        AIOperation.LESSON_GENERATION,
        error,
        input.idempotencyKey
      );
      throw error;
    }

    return aiOutput;
  }
}

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
} from "./ai.adapter";
import { CourseService } from "@/modules/course/course.service";
import { AICreditEngine } from "./ai.credit-engine";
import { AIOperation } from "@prisma/client";
import { getPlanAIConfig } from "./ai.config";

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
            secondaryColor: "#1E293B",
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
}


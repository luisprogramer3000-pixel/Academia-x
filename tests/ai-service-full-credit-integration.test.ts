import { loginAs } from "./helpers/session";
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { AIService } from "@/modules/ai/ai.service";
import { getOperationCreditCost } from "@/modules/ai/ai.catalog";
import { AIOperation } from "@prisma/client";
import { AICreditError } from "@/modules/ai/ai.credit-engine";
import {
  generateActivityAIAction,
  generateQuizAIAction,
  generateLandingPageAIAction,
  regenerateLessonContentAIAction,
  regenerateCourseStructureAIAction,
  askAITutorAIAction,
  getAIFeedbackAIAction,
} from "@/app/actions/ai.actions";

describe("AIService Full AI Credit Integration — PASO 4.4.2", () => {
  const createTestContext = async (slug: string, teacherCredits = 100, studentCredits = 100) => {
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      await prisma.tenant.delete({ where: { id: existingTenant.id } });
    }

    const tenant = await prisma.tenant.create({
      data: { name: `Full Integration Tenant ${slug}`, slug },
    });

    const wallet = await prisma.aICreditWallet.create({
      data: {
        tenantId: tenant.id,
        teacherCredits,
        studentCredits,
        monthlyTeacherAllowance: teacherCredits,
        monthlyStudentAllowance: studentCredits,
        resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const userEmail = `${slug}@fullinteg.com`;
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: "Test User Full Integration",
        },
      });
    }

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: "OWNER",
      },
    });

    return { tenant, wallet, user, membership };
  };

  it("1. ACTIVITY_GENERATION consume créditos Teacher dinámicamente y registra AIUsage", async () => {
    const { tenant, user } = await createTestContext("integ-activity", 100, 50);
    const expectedCost = getOperationCreditCost(AIOperation.ACTIVITY_GENERATION); // 1

    try {
      const result = await AIService.generateActivityAI({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Vocabulario de Viajes",
        level: "A2",
        language: "es",
      });

      expect(result).toBeDefined();
      expect(result.title).toContain("Actividad Práctica");

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(100 - expectedCost);
      expect(wallet?.studentCredits).toBe(50);

      const usageRecord = await prisma.aIUsage.findFirst({
        where: { tenantId: tenant.id, feature: "ACTIVITY_GENERATOR" },
      });
      expect(usageRecord).toBeDefined();
      expect(usageRecord?.creditsUsed).toBe(expectedCost);
      expect(usageRecord?.creditTransactionId).toBeDefined();
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("2. QUIZ_GENERATION consume créditos Teacher dinámicamente según catálogo actual y registra AIUsage", async () => {
    const { tenant, user } = await createTestContext("integ-quiz", 100, 50);
    const expectedCost = getOperationCreditCost(AIOperation.QUIZ_GENERATION); // 1

    try {
      const result = await AIService.generateQuizAI({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Verbos Irregulares",
        level: "B1",
        language: "es",
        questionCount: 4,
      });

      expect(result).toBeDefined();
      expect(result.questions).toHaveLength(4);

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(100 - expectedCost);
      expect(wallet?.studentCredits).toBe(50);

      const usageRecord = await prisma.aIUsage.findFirst({
        where: { tenantId: tenant.id, feature: "QUIZ_GENERATOR" },
      });
      expect(usageRecord?.creditsUsed).toBe(expectedCost);
      expect(usageRecord?.creditTransactionId).toBeDefined();
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("3. LANDING_GENERATION consume créditos Teacher dinámicamente y registra AIUsage", async () => {
    const { tenant, user } = await createTestContext("integ-landing", 100, 50);
    const expectedCost = getOperationCreditCost(AIOperation.LANDING_GENERATION); // 8

    try {
      const result = await AIService.generateLandingPageAI({
        tenantId: tenant.id,
        userId: user.id,
        courseTitle: "Inglés de Negocios Avanzado",
        targetAudience: "Ejecutivos",
        language: "es",
      });

      expect(result).toBeDefined();
      expect(result.headline).toContain("Inglés de Negocios Avanzado");

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(100 - expectedCost);
      expect(wallet?.studentCredits).toBe(50);

      const usageRecord = await prisma.aIUsage.findFirst({
        where: { tenantId: tenant.id, feature: "LANDING_GENERATOR" },
      });
      expect(usageRecord?.creditsUsed).toBe(expectedCost);
      expect(usageRecord?.creditTransactionId).toBeDefined();
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("4. LESSON_REGENERATION consume créditos Teacher dinámicamente y registra referenceId", async () => {
    const { tenant, user } = await createTestContext("integ-lesson-regen", 100, 50);
    const expectedCost = getOperationCreditCost(AIOperation.LESSON_REGENERATION); // 1

    try {
      const course = await prisma.course.create({
        data: { tenantId: tenant.id, title: "Curso Regen", slug: "curso-regen" },
      });
      const moduleObj = await prisma.module.create({
        data: { courseId: course.id, title: "Módulo Regen" },
      });
      const lessonObj = await prisma.lesson.create({
        data: { moduleId: moduleObj.id, title: "Lección Regen Original" },
      });

      const result = await AIService.regenerateLessonContentAI({
        tenantId: tenant.id,
        userId: user.id,
        lessonId: lessonObj.id,
        topic: "Gramática Avanzada",
        level: "C1",
        language: "es",
        lessonTitle: lessonObj.title,
        feedback: "Hacerlo más interactivo",
      });

      expect(result).toBeDefined();
      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(100 - expectedCost);

      const tx = await prisma.aICreditTransaction.findFirst({
        where: { tenantId: tenant.id, operation: AIOperation.LESSON_REGENERATION },
      });
      expect(tx?.referenceId).toBe(lessonObj.id);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("5. COURSE_REGENERATION consume créditos Teacher dinámicamente y mantiene tenant isolation", async () => {
    const { tenant, user } = await createTestContext("integ-course-regen", 100, 50);
    const expectedCost = getOperationCreditCost(AIOperation.COURSE_REGENERATION); // 3

    try {
      const result = await AIService.regenerateCourseStructureAI({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Italiano para Negocios",
        level: "B2",
        language: "it",
        feedback: "Enfocar en negociaciones",
      });

      expect(result).toBeDefined();

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(100 - expectedCost);
      expect(wallet?.studentCredits).toBe(50);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("6. AI_TUTOR consume exclusivamente Student Credits sin afectar Teacher Credits", async () => {
    const { tenant, user } = await createTestContext("integ-ai-tutor", 100, 50);
    const expectedCost = getOperationCreditCost(AIOperation.AI_TUTOR); // 1

    try {
      const result = await AIService.askAITutorAI({
        tenantId: tenant.id,
        userId: user.id,
        question: "¿Cómo uso la subjuntivo en español?",
        context: "Lección 4: Modos Verbales",
      });

      expect(result).toBeDefined();
      expect(result.answer).toBeDefined();

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.studentCredits).toBe(50 - expectedCost);
      expect(wallet?.teacherCredits).toBe(100); // Intacto

      const usageRecord = await prisma.aIUsage.findFirst({
        where: { tenantId: tenant.id, feature: "AI_TUTOR" },
      });
      expect(usageRecord?.creditsUsed).toBe(expectedCost);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("7. AI_FEEDBACK consume exclusivamente Student Credits sin afectar Teacher Credits", async () => {
    const { tenant, user } = await createTestContext("integ-ai-feedback", 100, 50);
    const expectedCost = getOperationCreditCost(AIOperation.AI_FEEDBACK); // 1

    try {
      const result = await AIService.getAIFeedbackAI({
        tenantId: tenant.id,
        userId: user.id,
        studentSubmission: "Me gusta aprender idiomas porque puedo viajar.",
        exerciseContext: "Redacción breve sobre tus motivaciones.",
      });

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.studentCredits).toBe(50 - expectedCost);
      expect(wallet?.teacherCredits).toBe(100); // Intacto

      const usageRecord = await prisma.aIUsage.findFirst({
        where: { tenantId: tenant.id, feature: "AI_FEEDBACK" },
      });
      expect(usageRecord?.creditsUsed).toBe(expectedCost);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("8. Saldo insuficiente rechaza antes de invocar al proveedor y no crea transacciones ni modifica wallet", async () => {
    const { tenant, user } = await createTestContext("integ-insufficient-all", 0, 0); // 0 créditos

    try {
      await expect(
        AIService.generateLandingPageAI({
          tenantId: tenant.id,
          userId: user.id,
          courseTitle: "Curso Fallido",
        })
      ).rejects.toThrow(AICreditError.INSUFFICIENT_AI_CREDITS);

      await expect(
        AIService.askAITutorAI({
          tenantId: tenant.id,
          userId: user.id,
          question: "Pregunta sin saldo",
        })
      ).rejects.toThrow(AICreditError.INSUFFICIENT_AI_CREDITS);

      const txCount = await prisma.aICreditTransaction.count({ where: { tenantId: tenant.id } });
      expect(txCount).toBe(0);

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(0);
      expect(wallet?.studentCredits).toBe(0);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("9. Idempotencia evita doble consumo en reintentos de peticiones", async () => {
    const { tenant, user } = await createTestContext("integ-idemp-all", 100, 50);
    const keyLanding = `idemp_landing_${Date.now()}`;
    const keyTutor = `idemp_tutor_${Date.now()}`;

    try {
      // Primera llamada Landing
      await AIService.generateLandingPageAI({
        tenantId: tenant.id,
        userId: user.id,
        courseTitle: "Curso Idempotente",
        idempotencyKey: keyLanding,
      });

      const wallet1 = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet1?.teacherCredits).toBe(92); // 100 - 8

      // Reintento Landing
      await AIService.generateLandingPageAI({
        tenantId: tenant.id,
        userId: user.id,
        courseTitle: "Curso Idempotente",
        idempotencyKey: keyLanding,
      });

      const wallet2 = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet2?.teacherCredits).toBe(92); // Sin doble cobro

      // Primera llamada Tutor
      await AIService.askAITutorAI({
        tenantId: tenant.id,
        userId: user.id,
        question: "Duda tutor",
        idempotencyKey: keyTutor,
      });

      const wallet3 = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet3?.studentCredits).toBe(49); // 50 - 1

      // Reintento Tutor
      await AIService.askAITutorAI({
        tenantId: tenant.id,
        userId: user.id,
        question: "Duda tutor",
        idempotencyKey: keyTutor,
      });

      const wallet4 = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet4?.studentCredits).toBe(49); // Sin doble cobro
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("10. Tenant Isolation rechaza la petición si el usuario no pertenece a la academia", async () => {
    const { tenant: tenantA } = await createTestContext("integ-iso-full-a", 100, 50);
    const { tenant: tenantB, user: userB } = await createTestContext("integ-iso-full-b", 100, 50);

    try {
      await expect(
        AIService.generateActivityAI({
          tenantId: tenantA.id,
          userId: userB.id,
          topic: "Intento ajeno",
        })
      ).rejects.toThrow(AICreditError.USER_NOT_IN_TENANT);

      await expect(
        AIService.getAIFeedbackAI({
          tenantId: tenantA.id,
          userId: userB.id,
          studentSubmission: "Entrega ajena",
          exerciseContext: "Contexto",
        })
      ).rejects.toThrow(AICreditError.USER_NOT_IN_TENANT);
    } finally {
      await prisma.tenant.delete({ where: { id: tenantA.id } });
      await prisma.tenant.delete({ where: { id: tenantB.id } });
    }
  });

  it("11. Teacher Server Actions formatean los errores de saldo insuficiente en la UI", async () => {
    const { tenant, user } = await createTestContext("integ-actions-error-teacher", 0, 0);

    try {
      const formDataActivity = new FormData();
      formDataActivity.append("tenantId", tenant.id);
      formDataActivity.append("userId", user.id);
      await loginAs(tenant.id, user.id);
      formDataActivity.append("topic", "Actividad sin Saldo");
      const resActivity = await generateActivityAIAction(formDataActivity);
      expect(resActivity.success).toBe(false);
      expect(resActivity.error).toContain("Créditos de IA insuficientes");

      const formDataQuiz = new FormData();
      formDataQuiz.append("tenantId", tenant.id);
      formDataQuiz.append("userId", user.id);
      await loginAs(tenant.id, user.id);
      formDataQuiz.append("topic", "Quiz sin Saldo");
      const resQuiz = await generateQuizAIAction(formDataQuiz);
      expect(resQuiz.success).toBe(false);
      expect(resQuiz.error).toContain("Créditos de IA insuficientes");

      const formDataLanding = new FormData();
      formDataLanding.append("tenantId", tenant.id);
      formDataLanding.append("userId", user.id);
      await loginAs(tenant.id, user.id);
      formDataLanding.append("courseTitle", "Landing sin Saldo");
      const resLanding = await generateLandingPageAIAction(formDataLanding);
      expect(resLanding.success).toBe(false);
      expect(resLanding.error).toContain("Créditos de IA insuficientes");

      const formDataRegenLesson = new FormData();
      formDataRegenLesson.append("tenantId", tenant.id);
      formDataRegenLesson.append("userId", user.id);
      await loginAs(tenant.id, user.id);
      formDataRegenLesson.append("lessonId", "l_mock");
      formDataRegenLesson.append("topic", "Tema");
      formDataRegenLesson.append("lessonTitle", "Lección");
      const resRegenLesson = await regenerateLessonContentAIAction(formDataRegenLesson);
      expect(resRegenLesson.success).toBe(false);
      expect(resRegenLesson.error).toContain("Créditos de IA insuficientes");

      const formDataRegenCourse = new FormData();
      formDataRegenCourse.append("tenantId", tenant.id);
      formDataRegenCourse.append("userId", user.id);
      await loginAs(tenant.id, user.id);
      formDataRegenCourse.append("topic", "Curso");
      const resRegenCourse = await regenerateCourseStructureAIAction(formDataRegenCourse);
      expect(resRegenCourse.success).toBe(false);
      expect(resRegenCourse.error).toContain("Créditos de IA insuficientes");
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  }, 60000);

  it("12. Student Server Actions formatean los errores de saldo insuficiente en la UI", async () => {
    const { tenant, user } = await createTestContext("integ-actions-error-student", 0, 0);

    try {
      const formDataTutor = new FormData();
      formDataTutor.append("tenantId", tenant.id);
      formDataTutor.append("userId", user.id);
      await loginAs(tenant.id, user.id);
      formDataTutor.append("question", "Pregunta sin saldo");
      const resTutor = await askAITutorAIAction(formDataTutor);
      expect(resTutor.success).toBe(false);
      expect(resTutor.error).toContain("Créditos de IA insuficientes");

      const formDataFeedback = new FormData();
      formDataFeedback.append("tenantId", tenant.id);
      formDataFeedback.append("userId", user.id);
      await loginAs(tenant.id, user.id);
      formDataFeedback.append("studentSubmission", "Respuesta");
      formDataFeedback.append("exerciseContext", "Ejercicio");
      const resFeedback = await getAIFeedbackAIAction(formDataFeedback);
      expect(resFeedback.success).toBe(false);
      expect(resFeedback.error).toContain("Créditos de IA insuficientes");
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  }, 60000);
});

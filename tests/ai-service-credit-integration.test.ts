import { loginAs } from "./helpers/session";
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { AIService } from "@/modules/ai/ai.service";
import { AI_OPERATION_CATALOG, getOperationCreditCost } from "@/modules/ai/ai.catalog";
import { AIOperation } from "@prisma/client";
import { AICreditError } from "@/modules/ai/ai.credit-engine";
import { generateCourseAIAction, generateLessonContentAIAction } from "@/app/actions/ai.actions";

describe("AIService & AICreditEngine Integration — PASO 4.4.1", () => {
  const createTestContext = async (slug: string, teacherCredits = 100, studentCredits = 100) => {
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      await prisma.tenant.delete({ where: { id: existingTenant.id } });
    }

    const tenant = await prisma.tenant.create({
      data: { name: `Tenant Integration ${slug}`, slug },
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

    const userEmail = `${slug}@integ.com`;
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: "Test User Integration",
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

  it("1. COURSE_GENERATION consume los créditos definidos dinámicamente en el catálogo", async () => {
    const { tenant, user } = await createTestContext("integ-course-cost", 100, 50);
    const catalogCost = getOperationCreditCost(AIOperation.COURSE_GENERATION); // 5

    try {
      const course = await AIService.generateCourseDraft({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Francés Médico",
        level: "B2",
        language: "fr",
        modulesCount: 1,
      });

      expect(course).toBeDefined();

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(100 - catalogCost);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("2. LESSON_GENERATION consume los créditos definidos dinámicamente en el catálogo", async () => {
    const { tenant, user } = await createTestContext("integ-lesson-cost", 100, 50);
    const catalogCost = getOperationCreditCost(AIOperation.LESSON_GENERATION); // 2

    try {
      const course = await prisma.course.create({
        data: { tenantId: tenant.id, title: "Curso Temp", slug: "curso-temp" },
      });
      const moduleObj = await prisma.module.create({
        data: { courseId: course.id, title: "Módulo Temp" },
      });
      const lessonObj = await prisma.lesson.create({
        data: { moduleId: moduleObj.id, title: "Lección Temp" },
      });

      const updated = await AIService.generateLessonContentAI({
        tenantId: tenant.id,
        userId: user.id,
        lessonId: lessonObj.id,
        topic: "Vocabulario Hospitalario",
        level: "B2",
        language: "fr",
        lessonTitle: lessonObj.title,
      });

      expect(updated).toBeDefined();
      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(100 - catalogCost);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("3. COURSE_GENERATION no consume Student Credits", async () => {
    const { tenant, user } = await createTestContext("integ-no-student-course", 50, 100);

    try {
      await AIService.generateCourseDraft({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Alemán Técnico",
        level: "A2",
        language: "de",
      });

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.studentCredits).toBe(100);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("4. LESSON_GENERATION no consume Student Credits", async () => {
    const { tenant, user } = await createTestContext("integ-no-student-lesson", 50, 100);

    try {
      const course = await prisma.course.create({
        data: { tenantId: tenant.id, title: "Curso Temp 2", slug: "curso-temp-2" },
      });
      const moduleObj = await prisma.module.create({
        data: { courseId: course.id, title: "Módulo Temp 2" },
      });
      const lessonObj = await prisma.lesson.create({
        data: { moduleId: moduleObj.id, title: "Lección Temp 2" },
      });

      await AIService.generateLessonContentAI({
        tenantId: tenant.id,
        userId: user.id,
        lessonId: lessonObj.id,
        topic: "Gramática",
        level: "A2",
        language: "de",
        lessonTitle: lessonObj.title,
      });

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.studentCredits).toBe(100);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("5. COURSE_GENERATION con saldo insuficiente rechaza sin llamar al proveedor ni crear curso, módulos o lecciones", async () => {
    const { tenant, user } = await createTestContext("integ-insufficient-course", 2, 50); // 2 < 5

    try {
      await expect(
        AIService.generateCourseDraft({
          tenantId: tenant.id,
          userId: user.id,
          topic: "Italiano para Gastronomía",
          level: "B1",
          language: "it",
        })
      ).rejects.toThrow(AICreditError.INSUFFICIENT_AI_CREDITS);

      // Verificar que NO se creó ningún curso en DB
      const courseCount = await prisma.course.count({ where: { tenantId: tenant.id } });
      expect(courseCount).toBe(0);

      // Saldo permanece intacto
      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(2);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("6. LESSON_GENERATION con saldo insuficiente rechaza sin modificar la lección", async () => {
    const { tenant, user } = await createTestContext("integ-insufficient-lesson", 1, 50); // 1 < 2

    try {
      const course = await prisma.course.create({
        data: { tenantId: tenant.id, title: "Curso Temp 3", slug: "curso-temp-3" },
      });
      const moduleObj = await prisma.module.create({
        data: { courseId: course.id, title: "Módulo Temp 3" },
      });
      const originalLesson = await prisma.lesson.create({
        data: { moduleId: moduleObj.id, title: "Lección Inalterada", content: "CONTENIDO_ORIGINAL" },
      });

      await expect(
        AIService.generateLessonContentAI({
          tenantId: tenant.id,
          userId: user.id,
          lessonId: originalLesson.id,
          topic: "Pastas",
          level: "B1",
          language: "it",
          lessonTitle: originalLesson.title,
        })
      ).rejects.toThrow(AICreditError.INSUFFICIENT_AI_CREDITS);

      // Verificar que el contenido de la lección NO se modificó
      const dbLesson = await prisma.lesson.findUnique({ where: { id: originalLesson.id } });
      expect(dbLesson?.content).toBe("CONTENIDO_ORIGINAL");

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(1);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("7. IdempotencyKey repetida no genera doble consumo de créditos", async () => {
    const { tenant, user } = await createTestContext("integ-idemp", 100, 50);
    const key = `key_integ_${Date.now()}`;

    try {
      await AIService.generateCourseDraft({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Portugués de Negocios",
        level: "C1",
        language: "pt",
        modulesCount: 1,
        idempotencyKey: key,
      });

      const walletAfterFirst = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(walletAfterFirst?.teacherCredits).toBe(95);

      // Reintento con la misma idempotencyKey
      await AIService.generateCourseDraft({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Portugués de Negocios",
        level: "C1",
        language: "pt",
        modulesCount: 1,
        idempotencyKey: key,
      });

      const walletAfterSecond = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(walletAfterSecond?.teacherCredits).toBe(95); // Sin segundo cobro

      const txCount = await prisma.aICreditTransaction.count({ where: { idempotencyKey: key } });
      expect(txCount).toBe(1);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("8. Tenant A no puede consumir créditos de Tenant B", async () => {
    const { tenant: tenantA } = await createTestContext("integ-iso-a", 100, 50);
    const { tenant: tenantB, user: userB } = await createTestContext("integ-iso-b", 100, 50);

    try {
      await expect(
        AIService.generateCourseDraft({
          tenantId: tenantA.id,
          userId: userB.id, // Usuario B intentando consumir en Tenant A
          topic: "Japonés Básico",
          level: "A1",
          language: "ja",
        })
      ).rejects.toThrow(AICreditError.USER_NOT_IN_TENANT);
    } finally {
      await prisma.tenant.delete({ where: { id: tenantA.id } });
      await prisma.tenant.delete({ where: { id: tenantB.id } });
    }
  });

  it("9 & 10. AIUsage almacena creditsUsed y queda relacionado con creditTransactionId", async () => {
    const { tenant, user } = await createTestContext("integ-aiusage-link", 100, 50);

    try {
      await AIService.generateCourseDraft({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Chino Mandarín",
        level: "A1",
        language: "zh",
      });

      const usageRecord = await prisma.aIUsage.findFirst({
        where: { tenantId: tenant.id, feature: "COURSE_GENERATOR" },
        orderBy: { createdAt: "desc" },
      });

      expect(usageRecord).toBeDefined();
      expect(usageRecord?.creditsUsed).toBe(5);
      expect(usageRecord?.creditTransactionId).toBeDefined();

      const tx = await prisma.aICreditTransaction.findUnique({
        where: { id: usageRecord?.creditTransactionId! },
      });
      expect(tx).toBeDefined();
      expect(tx?.amount).toBe(-5);
      expect(tx?.operation).toBe("COURSE_GENERATION");
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("11. Server Actions formatean los errores de créditos de manera segura para la UI", async () => {
    const { tenant, user } = await createTestContext("integ-action-error", 1, 50); // 1 crédito (insuficiente)

    try {
      const formData = new FormData();
      formData.append("tenantId", tenant.id);
      formData.append("userId", user.id);
      await loginAs(tenant.id, user.id);
      formData.append("topic", "Ruso Técnico");
      formData.append("level", "B1");

      const result = await generateCourseAIAction(formData);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Créditos de IA insuficientes");
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("12. Dynamic Cost Override — Cambiar el catálogo en runtime altera el consumo de AIService sin tocar AIService.ts", async () => {
    const { tenant, user } = await createTestContext("integ-dynamic-catalog", 100, 50);
    const originalCost = AI_OPERATION_CATALOG[AIOperation.COURSE_GENERATION].creditCost;

    try {
      // Modificar dinámicamente el catálogo a 12 créditos
      AI_OPERATION_CATALOG[AIOperation.COURSE_GENERATION].creditCost = 12;

      await AIService.generateCourseDraft({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Coreano de Negocios",
        level: "B2",
        language: "ko",
      });

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(88); // 100 - 12 = 88
    } finally {
      // Restaurar catálogo original
      AI_OPERATION_CATALOG[AIOperation.COURSE_GENERATION].creditCost = originalCost;
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });
});

import { describe, it, expect } from "vitest";
import { MockAIAdapter } from "@/modules/ai/ai.adapter";
import { AIService } from "@/modules/ai/ai.service";
import { prisma } from "@/lib/db";

describe("AI Copilot & Adapter Layer", () => {
  const createTestContext = async (name: string, slug: string) => {
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      await prisma.tenant.delete({ where: { id: existingTenant.id } });
    }

    const tenant = await prisma.tenant.create({
      data: { name, slug },
    });

    const userEmail = `${slug}@test.com`;
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: "Test User AI",
        },
      });
    }

    await prisma.membership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: {},
      create: { userId: user.id, tenantId: tenant.id, role: "OWNER" },
    });

    return { tenant, user };
  };

  it("Debe generar una estructura de curso en JSON con módulos y lecciones adaptadas al nivel MCER", async () => {
    const adapter = new MockAIAdapter();

    const output = await adapter.generateCourseStructure({
      topic: "Español de Negocios",
      level: "B2",
      language: "es",
      modulesCount: 3,
    });

    expect(output.title).toContain("Español de Negocios");
    expect(output.level).toBe("B2");
    expect(output.modules).toHaveLength(3);
    expect(output.promptTokens).toBeGreaterThan(0);
    expect(output.completionTokens).toBeGreaterThan(0);
    expect(output.estimatedCost).toBeGreaterThan(0);
  });

  it("Debe generar bloques de contenido pedagógico para lecciones individuales", async () => {
    const adapter = new MockAIAdapter();

    const output = await adapter.generateLessonContent({
      topic: "Español Médico",
      level: "B1",
      language: "es",
      lessonTitle: "Anamnesis e Historial del Paciente",
    });

    expect(output.lessonTitle).toBe("Anamnesis e Historial del Paciente");
    expect(output.blocks.length).toBeGreaterThanOrEqual(3);
    expect(output.blocks.some((b) => b.type === "vocabulary")).toBe(true);
    expect(output.blocks.some((b) => b.type === "exercise")).toBe(true);
  });

  it("Debe calcular correctamente las estadísticas de consumo AIUsage de un tenant", async () => {
    const { tenant, user } = await createTestContext("Academia AI Stats", "tenant-ai-stats-test");
    try {
      await prisma.aIUsage.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          feature: "COURSE_GENERATOR",
          provider: "mock-ai",
          model: "gpt-4o-mini",
          promptTokens: 400,
          completionTokens: 600,
          estimatedCost: 0.0012,
        },
      });

      const stats = await AIService.getAIUsageStats(tenant.id);
      expect(stats.totalTokens).toBe(1000);
      expect(stats.callCount).toBe(1);
      expect(stats.totalCost).toBeGreaterThan(0);
      expect(stats.isExceeded).toBe(false);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("Debe generar un curso completo en estado DRAFT e insumar registros de AIUsage", async () => {
    const { tenant, user } = await createTestContext("Academia AI Draft", "tenant-ai-draft-test");
    try {
      const course = await AIService.generateCourseDraft({
        tenantId: tenant.id,
        userId: user.id,
        topic: "Inglés de Aviación",
        level: "B2",
        language: "en",
        modulesCount: 2,
      });

      expect(course).toBeDefined();
      expect(course.title).toContain("Inglés de Aviación");
      expect(course.status).toBe("DRAFT");

      const stats = await AIService.getAIUsageStats(tenant.id);
      expect(stats.callCount).toBe(1);
      expect(stats.totalTokens).toBeGreaterThan(0);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("Debe generar contenido pedagógico para una lección existente", async () => {
    const { tenant, user } = await createTestContext("Academia AI Lesson", "tenant-ai-lesson-test");
    try {
      const course = await prisma.course.create({
        data: {
          tenantId: tenant.id,
          title: "Curso Test Lecciones",
          slug: "curso-test-lecciones",
        },
      });

      const moduleObj = await prisma.module.create({
        data: {
          courseId: course.id,
          title: "Módulo 1 Test",
        },
      });

      const lessonObj = await prisma.lesson.create({
        data: {
          moduleId: moduleObj.id,
          title: "Lección 1.1 Test",
        },
      });

      const updatedLesson = await AIService.generateLessonContentAI({
        tenantId: tenant.id,
        userId: user.id,
        lessonId: lessonObj.id,
        topic: "Español Turístico",
        level: "A2",
        language: "es",
        lessonTitle: lessonObj.title,
      });

      expect(updatedLesson.content).toBeDefined();
      const parsedContent = JSON.parse(updatedLesson.content || "{}");
      expect(parsedContent.aiGenerated).toBe(true);
      expect(parsedContent.blocks.length).toBeGreaterThan(0);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });
});

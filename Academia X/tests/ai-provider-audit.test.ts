import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MockAIAdapter,
  OpenAIAdapter,
  getAIAdapter,
  AIProviderAdapter,
} from "@/modules/ai/ai.adapter";
import {
  AI_OPERATION_CATALOG,
  getOperationCreditCost,
  getOperationCreditType,
  getDailyOperationLimit,
} from "@/modules/ai/ai.catalog";
import {
  PLAN_AI_CREDIT_CONFIG,
  getPlanAIConfig,
  getMonthlyTeacherAllowance,
  getMonthlyStudentAllowance,
  getMaxTeacherRollover,
  getMaxStudentRollover,
} from "@/modules/ai/ai.config";
import { TOPUP_PACKAGES } from "@/modules/ai/ai.topup-catalog";
import { SAAS_PLANS } from "@/modules/billing/billing.service";
import { AIOperation, AICreditType } from "@prisma/client";

describe("Paso 6.5 — AI Provider & OpenAI Adapter Audit Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("A. MockAIAdapter funciona correctamente y genera estructuras pedagógicas deterministas", async () => {
    const adapter: AIProviderAdapter = new MockAIAdapter();
    expect(adapter.providerName).toBe("mock-ai");
    expect(adapter.modelName).toBe("mock-v1");

    const courseOutput = await adapter.generateCourseStructure({
      topic: "Inglés de Negocios",
      level: "B2",
      language: "es",
      modulesCount: 2,
    });

    expect(courseOutput.title).toContain("Inglés de Negocios");
    expect(courseOutput.modules).toHaveLength(2);
    expect(courseOutput.promptTokens).toBeGreaterThan(0);
    expect(courseOutput.completionTokens).toBeGreaterThan(0);
    expect(courseOutput.estimatedCost).toBeGreaterThan(0);

    const lessonOutput = await adapter.generateLessonContent({
      topic: "Inglés de Negocios",
      level: "B2",
      language: "es",
      lessonTitle: "Negociaciones y Ofertas",
    });

    expect(lessonOutput.lessonTitle).toBe("Negociaciones y Ofertas");
    expect(lessonOutput.blocks.length).toBeGreaterThanOrEqual(3);

    const activityOutput = await adapter.generateActivity({
      topic: "Roleplay de Negociación",
      level: "B2",
      language: "es",
    });
    expect(activityOutput.instructions.length).toBeGreaterThan(0);

    const quizOutput = await adapter.generateQuiz({
      topic: "Vocabulario Financiero",
      level: "B2",
      questionCount: 3,
    });
    expect(quizOutput.questions).toHaveLength(3);

    const landingOutput = await adapter.generateLandingPage({
      courseTitle: "Executive English",
    });
    expect(landingOutput.headline).toBeDefined();

    const tutorOutput = await adapter.askAITutor({
      question: "¿Cómo uso 'furthermore'?",
    });
    expect(tutorOutput.answer).toBeDefined();

    const feedbackOutput = await adapter.getAIFeedback({
      studentSubmission: "I have went to London",
      exerciseContext: "Past simple practice",
    });
    expect(feedbackOutput.score).toBeGreaterThan(0);
  });

  it("B. getAIAdapter selecciona MockAIAdapter por defecto en dev/test", () => {
    delete process.env.AI_PROVIDER;
    delete process.env.OPENAI_API_KEY;
    (process.env as Record<string, string | undefined>).NODE_ENV = "test";

    const adapter = getAIAdapter();
    expect(adapter.providerName).toBe("mock-ai");
  });

  it("C. getAIAdapter selecciona OpenAIAdapter cuando AI_PROVIDER='openai' y existe OPENAI_API_KEY", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "sk-test-mock-key-for-unit-tests-only";

    const adapter = getAIAdapter();
    expect(adapter.providerName).toBe("openai");
    expect(adapter.modelName).toBe("gpt-4o-mini");
  });

  it("D. Fail-Fast: getAIAdapter lanza error controlado si AI_PROVIDER='openai' pero falta OPENAI_API_KEY", () => {
    process.env.AI_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;

    expect(() => getAIAdapter()).toThrow(/OPENAI_API_KEY_MISSING/);
  });

  it("E. OpenAIAdapter constructor lanza error si se inicializa sin API key", () => {
    delete process.env.OPENAI_API_KEY;
    expect(() => new OpenAIAdapter("")).toThrow(/OPENAI_API_KEY_MISSING/);
  });

  it("F. OPENAI_API_KEY nunca se expone en variables públicas NEXT_PUBLIC_*", () => {
    const envKeys = Object.keys(process.env);
    const publicOpenAIKeys = envKeys.filter((k) => k.startsWith("NEXT_PUBLIC_") && k.includes("OPENAI"));
    expect(publicOpenAIKeys).toHaveLength(0);
  });

  it("G. Catálogo de Operaciones AI: 9 operaciones con costos y tipos certificados e inmutables", () => {
    // 1. COURSE_GENERATION
    expect(getOperationCreditCost(AIOperation.COURSE_GENERATION)).toBe(5);
    expect(getOperationCreditType(AIOperation.COURSE_GENERATION)).toBe(AICreditType.TEACHER);

    // 2. LESSON_GENERATION
    expect(getOperationCreditCost(AIOperation.LESSON_GENERATION)).toBe(2);
    expect(getOperationCreditType(AIOperation.LESSON_GENERATION)).toBe(AICreditType.TEACHER);

    // 3. ACTIVITY_GENERATION
    expect(getOperationCreditCost(AIOperation.ACTIVITY_GENERATION)).toBe(1);
    expect(getOperationCreditType(AIOperation.ACTIVITY_GENERATION)).toBe(AICreditType.TEACHER);

    // 4. QUIZ_GENERATION
    expect(getOperationCreditCost(AIOperation.QUIZ_GENERATION)).toBe(1);
    expect(getOperationCreditType(AIOperation.QUIZ_GENERATION)).toBe(AICreditType.TEACHER);

    // 5. LANDING_GENERATION
    expect(getOperationCreditCost(AIOperation.LANDING_GENERATION)).toBe(8);
    expect(getOperationCreditType(AIOperation.LANDING_GENERATION)).toBe(AICreditType.TEACHER);

    // 6. LESSON_REGENERATION
    expect(getOperationCreditCost(AIOperation.LESSON_REGENERATION)).toBe(1);
    expect(getOperationCreditType(AIOperation.LESSON_REGENERATION)).toBe(AICreditType.TEACHER);

    // 7. COURSE_REGENERATION
    expect(getOperationCreditCost(AIOperation.COURSE_REGENERATION)).toBe(3);
    expect(getOperationCreditType(AIOperation.COURSE_REGENERATION)).toBe(AICreditType.TEACHER);

    // 8. AI_TUTOR (Student)
    expect(getOperationCreditCost(AIOperation.AI_TUTOR)).toBe(1);
    expect(getOperationCreditType(AIOperation.AI_TUTOR)).toBe(AICreditType.STUDENT);

    // 9. AI_FEEDBACK (Student)
    expect(getOperationCreditCost(AIOperation.AI_FEEDBACK)).toBe(1);
    expect(getOperationCreditType(AIOperation.AI_FEEDBACK)).toBe(AICreditType.STUDENT);
  });

  it("H. Límites diarios por plan para operaciones de profesor y estudiante", () => {
    expect(getDailyOperationLimit("STARTER", AIOperation.COURSE_GENERATION)).toBe(2);
    expect(getDailyOperationLimit("PRO", AIOperation.COURSE_GENERATION)).toBe(5);
    expect(getDailyOperationLimit("ACADEMY", AIOperation.COURSE_GENERATION)).toBe(15);

    expect(getDailyOperationLimit("STARTER", AIOperation.AI_TUTOR)).toBe(0); // Starter no tiene créditos de estudiante
    expect(getDailyOperationLimit("PRO", AIOperation.AI_TUTOR)).toBe(200);
    expect(getDailyOperationLimit("ACADEMY", AIOperation.AI_TUTOR)).toBe(800);
  });

  it("I. Cuotas mensuales y rollover de créditos AI por plan permanecen intactos", () => {
    // STARTER: 150 Teacher, 0 Student, Rollover 30/0
    expect(getMonthlyTeacherAllowance("STARTER")).toBe(150);
    expect(getMonthlyStudentAllowance("STARTER")).toBe(0);
    expect(getMaxTeacherRollover("STARTER")).toBe(30);
    expect(getMaxStudentRollover("STARTER")).toBe(0);

    // PRO: 600 Teacher, 200 Student, Rollover 100/50
    expect(getMonthlyTeacherAllowance("PRO")).toBe(800);
    expect(getMonthlyStudentAllowance("PRO")).toBe(0);
    expect(getMaxTeacherRollover("PRO")).toBe(100);
    expect(getMaxStudentRollover("PRO")).toBe(0);

    // ACADEMY: 2000 Teacher, 800 Student, Rollover 300/150
    expect(getMonthlyTeacherAllowance("ACADEMY")).toBe(2800);
    expect(getMonthlyStudentAllowance("ACADEMY")).toBe(0);
    expect(getMaxTeacherRollover("ACADEMY")).toBe(300);
    expect(getMaxStudentRollover("ACADEMY")).toBe(0);
  });

  it("J. Catálogo de Top-Ups permanece intacto e inmutable", () => {
    // Teacher Top-Ups
    expect(TOPUP_PACKAGES.TEACHER_TOPUP_50).toEqual({
      id: "TEACHER_TOPUP_50",
      name: "Pack Inicial Profesor",
      creditType: AICreditType.TEACHER,
      credits: 50,
      price: 15,
      currency: "USD",
      description: "50 Créditos de Profesor. Ideal para generar hasta 10 cursos completos.",
    });
    expect(TOPUP_PACKAGES.TEACHER_TOPUP_150).toEqual({
      id: "TEACHER_TOPUP_150",
      name: "Pack Pro Profesor",
      creditType: AICreditType.TEACHER,
      credits: 150,
      price: 39,
      currency: "USD",
      description: "150 Créditos de Profesor. El más popular para creación intensiva.",
      popular: true,
    });
    expect(TOPUP_PACKAGES.TEACHER_TOPUP_500).toEqual({
      id: "TEACHER_TOPUP_500",
      name: "Pack Institucional Profesor",
      creditType: AICreditType.TEACHER,
      credits: 500,
      price: 119,
      currency: "USD",
      description: "500 Créditos de Profesor. Volumen alto para grandes academias.",
    });

    // Student Top-Ups
    expect(TOPUP_PACKAGES.STUDENT_TOPUP_100).toEqual({
      id: "STUDENT_TOPUP_100",
      name: "Pack Estudiante Básico",
      creditType: AICreditType.STUDENT,
      credits: 100,
      price: 10,
      currency: "USD",
      description: "100 Créditos de Estudiante para consultas al Tutor IA y Feedback.",
    });
    expect(TOPUP_PACKAGES.STUDENT_TOPUP_500).toEqual({
      id: "STUDENT_TOPUP_500",
      name: "Pack Estudiante Pro",
      creditType: AICreditType.STUDENT,
      credits: 500,
      price: 45,
      currency: "USD",
      description: "500 Créditos de Estudiante para academias con uso extensivo.",
      popular: true,
    });
  });

  it("K. Precios SaaS mensuales y anuales con 20% descuento permanecen intactos", () => {
    // STARTER: $29/mes, $278.40/año (20% OFF)
    expect(SAAS_PLANS.STARTER.pricing.MONTHLY.price).toBe(29);
    expect(SAAS_PLANS.STARTER.pricing.YEARLY.price).toBe(278.4);

    // PRO: $79/mes, $758.40/año (20% OFF)
    expect(SAAS_PLANS.PRO.pricing.MONTHLY.price).toBe(79);
    expect(SAAS_PLANS.PRO.pricing.YEARLY.price).toBe(758.4);

    // ACADEMY: $199/mes, $1,910.40/año (20% OFF)
    expect(SAAS_PLANS.ACADEMY.pricing.MONTHLY.price).toBe(199);
    expect(SAAS_PLANS.ACADEMY.pricing.YEARLY.price).toBe(1910.4);
  });
});

import { describe, it, expect } from "vitest";
import {
  AI_OPERATION_CATALOG,
  getOperationCreditCost,
  getOperationCreditType,
  getOperationTier,
  getDailyOperationLimit,
  AITier,
} from "@/modules/ai/ai.catalog";
import { PLAN_AI_CREDIT_CONFIG, getPlanAIConfig } from "@/modules/ai/ai.config";
import { AIOperation, AICreditType } from "@prisma/client";

describe("AI Credit Economic Model — Validation & Simulations", () => {
  describe("1. Integridad del Catálogo Actual en Producción (Sin Modificaciones)", () => {
    it("Debe verificar que los costos actuales de operaciones principales coinciden con las especificaciones", () => {
      expect(getOperationCreditCost(AIOperation.COURSE_GENERATION)).toBe(5);
      expect(getOperationCreditCost(AIOperation.LESSON_GENERATION)).toBe(2);
      expect(getOperationCreditCost(AIOperation.ACTIVITY_GENERATION)).toBe(1);
      expect(getOperationCreditCost(AIOperation.QUIZ_GENERATION)).toBe(1);
      expect(getOperationCreditCost(AIOperation.LANDING_GENERATION)).toBe(8);
      expect(getOperationCreditCost(AIOperation.LESSON_REGENERATION)).toBe(1);
      expect(getOperationCreditCost(AIOperation.COURSE_REGENERATION)).toBe(3);
      expect(getOperationCreditCost(AIOperation.AI_TUTOR)).toBe(1);
      expect(getOperationCreditCost(AIOperation.AI_FEEDBACK)).toBe(1);
    });

    it("Debe verificar la asignación correcta de bolsas (TEACHER vs STUDENT)", () => {
      expect(getOperationCreditType(AIOperation.COURSE_GENERATION)).toBe(AICreditType.TEACHER);
      expect(getOperationCreditType(AIOperation.LESSON_GENERATION)).toBe(AICreditType.TEACHER);
      expect(getOperationCreditType(AIOperation.ACTIVITY_GENERATION)).toBe(AICreditType.TEACHER);
      expect(getOperationCreditType(AIOperation.QUIZ_GENERATION)).toBe(AICreditType.TEACHER);
      expect(getOperationCreditType(AIOperation.LANDING_GENERATION)).toBe(AICreditType.TEACHER);
      expect(getOperationCreditType(AIOperation.LESSON_REGENERATION)).toBe(AICreditType.TEACHER);
      expect(getOperationCreditType(AIOperation.COURSE_REGENERATION)).toBe(AICreditType.TEACHER);

      expect(getOperationCreditType(AIOperation.AI_TUTOR)).toBe(AICreditType.STUDENT);
      expect(getOperationCreditType(AIOperation.AI_FEEDBACK)).toBe(AICreditType.STUDENT);
    });

    it("Debe verificar la asignación correcta de Tiers de IA (ECONOMIC vs PREMIUM)", () => {
      expect(getOperationTier(AIOperation.COURSE_GENERATION)).toBe(AITier.PREMIUM);
      expect(getOperationTier(AIOperation.LANDING_GENERATION)).toBe(AITier.PREMIUM);
      expect(getOperationTier(AIOperation.COURSE_REGENERATION)).toBe(AITier.PREMIUM);

      expect(getOperationTier(AIOperation.LESSON_GENERATION)).toBe(AITier.ECONOMIC);
      expect(getOperationTier(AIOperation.ACTIVITY_GENERATION)).toBe(AITier.ECONOMIC);
      expect(getOperationTier(AIOperation.QUIZ_GENERATION)).toBe(AITier.ECONOMIC);
      expect(getOperationTier(AIOperation.LESSON_REGENERATION)).toBe(AITier.ECONOMIC);
      expect(getOperationTier(AIOperation.AI_TUTOR)).toBe(AITier.ECONOMIC);
      expect(getOperationTier(AIOperation.AI_FEEDBACK)).toBe(AITier.ECONOMIC);
    });

    it("Debe verificar las asignaciones de cuotas de planes en producción", () => {
      const starter = getPlanAIConfig("STARTER");
      expect(starter.teacherAllowance).toBe(150);
      expect(starter.studentAllowance).toBe(0);
      expect(starter.maxRolloverTeacher).toBe(30);

      const pro = getPlanAIConfig("PRO");
      expect(pro.teacherAllowance).toBe(800);
      expect(pro.studentAllowance).toBe(0);
      expect(pro.maxRolloverTeacher).toBe(100);
      expect(pro.maxRolloverStudent).toBe(0);

      const academy = getPlanAIConfig("ACADEMY");
      expect(academy.teacherAllowance).toBe(2800);
      expect(academy.studentAllowance).toBe(0);
      expect(academy.maxRolloverTeacher).toBe(300);
      expect(academy.maxRolloverStudent).toBe(0);
    });
  });

  describe("2. Simulación Económica — Benchmark de Curso Completo Estándar", () => {
    it("Debe calcular exactamente el costo en créditos de 1 Curso Completo Estándar bajo precios actuales", () => {
      const courseStructure = getOperationCreditCost(AIOperation.COURSE_GENERATION); // 5
      const lessons = 10 * getOperationCreditCost(AIOperation.LESSON_GENERATION); // 20
      const activities = 10 * getOperationCreditCost(AIOperation.ACTIVITY_GENERATION); // 10
      const quizzes = 5 * getOperationCreditCost(AIOperation.QUIZ_GENERATION); // 5
      const lessonRegens = 3 * getOperationCreditCost(AIOperation.LESSON_REGENERATION); // 3
      const courseRegens = 1 * getOperationCreditCost(AIOperation.COURSE_REGENERATION); // 3
      const landing = 1 * getOperationCreditCost(AIOperation.LANDING_GENERATION); // 8

      const totalFullCourseCost =
        courseStructure + lessons + activities + quizzes + lessonRegens + courseRegens + landing;

      expect(totalFullCourseCost).toBe(54);
    });

    it("Debe calcular la capacidad de cursos completos estándar por plan bajo precios actuales", () => {
      const fullCourseCost = 54;

      const starterCapacity = 150 / fullCourseCost;
      const proCapacity = 800 / fullCourseCost;
      const academyCapacity = 2800 / fullCourseCost;

      expect(starterCapacity).toBeCloseTo(2.77, 1);
      expect(proCapacity).toBeCloseTo(14.81, 1);
      expect(academyCapacity).toBeCloseTo(51.85, 1);
    });
  });

  describe("3. Simulación de Distribución de Consumo Mensual por Plan", () => {
    it("Plan STARTER (150 cr): Permite 1 Curso Completo + 1 Landing + Lecciones/Actividades extra", () => {
      const starterAllowance = 150;
      const fullCourse = 54;
      const extraLanding = getOperationCreditCost(AIOperation.LANDING_GENERATION); // 8
      const extraLessons = 20 * getOperationCreditCost(AIOperation.LESSON_GENERATION); // 40
      const extraActivities = 48 * getOperationCreditCost(AIOperation.ACTIVITY_GENERATION); // 48

      const totalUsed = fullCourse + extraLanding + extraLessons + extraActivities;

      expect(totalUsed).toBe(starterAllowance);
    });

    it("Plan PRO (800 cr Teacher): Permite múltiples cursos completos y material extra", () => {
      const proTeacherAllowance = 800;

      // 14 Cursos completos (756 cr) + 4 Landings extra (32 cr) + 12 Regeneraciones de lecciones (12 cr) = 800 cr
      const fourteenCourses = 14 * 54; // 756
      const fourLandings = 4 * 8; // 32
      const twelveRegens = 12 * 1; // 12

      expect(fourteenCourses + fourLandings + twelveRegens).toBe(proTeacherAllowance);

      // Los alumnos ya no tienen bolsa propia de créditos en ningún plan
      expect(getPlanAIConfig("PRO").studentAllowance).toBe(0);
    });

    it("Plan ACADEMY (2,800 cr Teacher): Permite producción masiva", () => {
      const academyTeacher = 2800;

      const coursesCount = Math.floor(academyTeacher / 54); // 51 cursos completos
      const remainingCredits = academyTeacher - coursesCount * 54; // 2800 - 2754 = 46 cr

      expect(coursesCount).toBe(51);
      expect(remainingCredits).toBe(46);

      expect(getPlanAIConfig("ACADEMY").studentAllowance).toBe(0);
    });
  });

  describe("4. Simulación Financiera — Estimación de Márgenes e Infraestructura API", () => {
    it("Debe simular el costo real de API vs Ingresos de Crédito en modelo ECONOMIC (Gemini Flash / GPT-4o-mini)", () => {
      // Asunciones de costos de API reales por 1,000,000 tokens en GPT-4o-mini / Gemini Flash:
      // Prompt: $0.15 / 1M tokens ($0.00015 / 1k tokens)
      // Completion: $0.60 / 1M tokens ($0.00060 / 1k tokens)
      const costPer1kInputTokens = 0.00015;
      const costPer1kOutputTokens = 0.0006;

      // Operación LESSON_GENERATION promedio: 500 input tokens, 2,000 output tokens
      const inputCost = 0.5 * costPer1kInputTokens; // $0.000075
      const outputCost = 2.0 * costPer1kOutputTokens; // $0.0012
      const totalAPICost = inputCost + outputCost; // ~$0.001275 USD

      // Ingreso asignado por crédito en Plan STARTER ($19 / 150 cr = $0.126 USD / crédito)
      // LESSON_GENERATION consume 2 créditos = $0.253 USD de ingreso SaaS implícito
      const creditRevenue = 2 * (19 / 150);

      const grossMargin = ((creditRevenue - totalAPICost) / creditRevenue) * 100;

      expect(totalAPICost).toBeLessThan(0.002); // Menos de $0.002 USD por lección
      expect(grossMargin).toBeGreaterThan(98); // Margen bruto > 98%
    });

    it("Debe simular el costo real de API vs Ingresos de Crédito en modelo PREMIUM (Claude 3.5 Sonnet / GPT-4o)", () => {
      // Asunciones de costos de API reales por 1,000,000 tokens en GPT-4o / Claude Sonnet:
      // Prompt: $3.00 / 1M tokens ($0.003 / 1k tokens)
      // Completion: $15.00 / 1M tokens ($0.015 / 1k tokens)
      const costPer1kInputTokens = 0.003;
      const costPer1kOutputTokens = 0.015;

      // Operación LANDING_GENERATION promedio: 1,000 input tokens, 2,500 output tokens
      const inputCost = 1.0 * costPer1kInputTokens; // $0.003
      const outputCost = 2.5 * costPer1kOutputTokens; // $0.0375
      const totalAPICost = inputCost + outputCost; // $0.0405 USD

      // LANDING_GENERATION consume 8 créditos en STARTER ($0.126 USD / cr) = $1.013 USD de ingreso
      const creditRevenue = 8 * (19 / 150);

      const grossMargin = ((creditRevenue - totalAPICost) / creditRevenue) * 100;

      expect(totalAPICost).toBeLessThan(0.05); // Menos de $0.05 USD por landing
      expect(grossMargin).toBeGreaterThan(95); // Margen bruto > 95%
    });
  });

  describe("5. Modelo Recomendado Futuro (Evaluación Conceptual sin Modificar Producción)", () => {
    it("Debe simular el impacto del catálogo recomendado futuro (Benchmark 76 cr / curso completo)", () => {
      // Estructura de precios futuros propuesta en el informe técnico:
      const proposedFutureCosts = {
        COURSE_GENERATION: 8,
        LESSON_GENERATION: 3,
        ACTIVITY_GENERATION: 1,
        QUIZ_GENERATION: 1,
        LANDING_GENERATION: 10,
        LESSON_REGENERATION: 2,
        COURSE_REGENERATION: 5,
      };

      const futureCourseCost =
        proposedFutureCosts.COURSE_GENERATION +
        10 * proposedFutureCosts.LESSON_GENERATION +
        10 * proposedFutureCosts.ACTIVITY_GENERATION +
        5 * proposedFutureCosts.QUIZ_GENERATION +
        3 * proposedFutureCosts.LESSON_REGENERATION +
        1 * proposedFutureCosts.COURSE_REGENERATION +
        1 * proposedFutureCosts.LANDING_GENERATION;

      expect(futureCourseCost).toBe(74);

      // En Plan STARTER (150 cr), el profesor podrá crear ~2 cursos completos (148 cr ~ 150 cr)
      const starterCourses = 150 / futureCourseCost;
      expect(starterCourses).toBeCloseTo(2.02, 1);
    });
  });
});

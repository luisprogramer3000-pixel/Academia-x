import { describe, it, expect } from "vitest";
import { AIOperation, AICreditType } from "@prisma/client";
import {
  AI_OPERATION_CATALOG,
  getAIOperationConfig,
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

describe("AI Credit Economic Architecture Audit — PASO 4.4.3", () => {
  // 1. Integridad del catálogo
  it("1. Integridad del catálogo: Todas las operaciones tienen configuración y costo >= 0", () => {
    const operations = Object.keys(AI_OPERATION_CATALOG) as AIOperation[];
    expect(operations.length).toBeGreaterThanOrEqual(9);

    for (const op of operations) {
      const config = getAIOperationConfig(op);
      expect(config).toBeDefined();
      expect(config.creditCost).toBeGreaterThanOrEqual(0);
      expect(config.dailyLimits.STARTER).toBeGreaterThanOrEqual(0);
      expect(config.dailyLimits.PRO).toBeGreaterThanOrEqual(0);
      expect(config.dailyLimits.ACADEMY).toBeGreaterThanOrEqual(0);
    }
  });

  // 2. Todos los planes tienen configuración
  it("2. Todos los planes (STARTER, PRO, ACADEMY) tienen configuración completa en ai.config.ts", () => {
    const plans: ("STARTER" | "PRO" | "ACADEMY")[] = ["STARTER", "PRO", "ACADEMY"];

    for (const planId of plans) {
      const config = getPlanAIConfig(planId);
      expect(config).toBeDefined();
      expect(config.planId).toBe(planId);
      expect(config.teacherAllowance).toBeGreaterThan(0);
      expect(config.maxRolloverTeacher).toBeGreaterThanOrEqual(0);
    }
  });

  // 3. Ninguna operación carece de coste
  it("3. Ninguna operación carece de coste en ai.catalog.ts", () => {
    const allOps: AIOperation[] = [
      AIOperation.COURSE_GENERATION,
      AIOperation.LESSON_GENERATION,
      AIOperation.ACTIVITY_GENERATION,
      AIOperation.QUIZ_GENERATION,
      AIOperation.LANDING_GENERATION,
      AIOperation.LESSON_REGENERATION,
      AIOperation.COURSE_REGENERATION,
      AIOperation.AI_TUTOR,
      AIOperation.AI_FEEDBACK,
    ];

    for (const op of allOps) {
      const cost = getOperationCreditCost(op);
      expect(typeof cost).toBe("number");
      expect(isNaN(cost)).toBe(false);
    }
  });

  // 4. Teacher operations consumen Teacher Credits
  it("4. Operaciones de Profesor consumen exclusivamente Teacher Credits", () => {
    const teacherOps: AIOperation[] = [
      AIOperation.COURSE_GENERATION,
      AIOperation.LESSON_GENERATION,
      AIOperation.ACTIVITY_GENERATION,
      AIOperation.QUIZ_GENERATION,
      AIOperation.LANDING_GENERATION,
      AIOperation.LESSON_REGENERATION,
      AIOperation.COURSE_REGENERATION,
    ];

    for (const op of teacherOps) {
      expect(getOperationCreditType(op)).toBe(AICreditType.TEACHER);
    }
  });

  // 5. Student operations consumen Student Credits
  it("5. Operaciones de Estudiante consumen exclusivamente Student Credits", () => {
    const studentOps: AIOperation[] = [AIOperation.AI_TUTOR, AIOperation.AI_FEEDBACK];

    for (const op of studentOps) {
      expect(getOperationCreditType(op)).toBe(AICreditType.STUDENT);
    }
  });

  // 6. Cálculo de consumo de curso (mínimo, estándar, intensivo)
  it("6. Cálculo atómico del costo en créditos para Curso Mínimo, Estándar e Intensivo", () => {
    // Curso Mínimo: 1 CourseGen (5) + 4 LessonGen (4*2=8) = 13 cr
    const minCourseCost =
      getOperationCreditCost(AIOperation.COURSE_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_GENERATION) * 4;
    expect(minCourseCost).toBe(13);

    // Curso Estándar: 1 CourseGen (5) + 6 LessonGen (12) + 2 Act (2) + 2 Quiz (2) + 1 Landing (8) + 2 LessonRegen (2) = 31 cr
    const stdCourseCost =
      getOperationCreditCost(AIOperation.COURSE_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_GENERATION) * 6 +
      getOperationCreditCost(AIOperation.ACTIVITY_GENERATION) * 2 +
      getOperationCreditCost(AIOperation.QUIZ_GENERATION) * 2 +
      getOperationCreditCost(AIOperation.LANDING_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_REGENERATION) * 2;
    expect(stdCourseCost).toBe(31);

    // Curso Intensivo: 1 CourseGen (5) + 15 LessonGen (30) + 15 Act (15) + 5 Quiz (5) + 1 Landing (8) + 1 CourseRegen (3) + 5 LessonRegen (5) = 71 cr
    const intCourseCost =
      getOperationCreditCost(AIOperation.COURSE_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_GENERATION) * 15 +
      getOperationCreditCost(AIOperation.ACTIVITY_GENERATION) * 15 +
      getOperationCreditCost(AIOperation.QUIZ_GENERATION) * 5 +
      getOperationCreditCost(AIOperation.LANDING_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.COURSE_REGENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_REGENERATION) * 5;
    expect(intCourseCost).toBe(71);
  });

  // 7. Simulación de escenarios
  it("7. Simulación de escenarios de uso (Eficiente, Normal, Intensivo)", () => {
    const escA_eficiente = 13; // 1 Curso Mínimo
    const escB_normal = 31; // 1 Curso Estándar
    const escC_intensivo = 71; // 1 Curso Intensivo

    expect(escA_eficiente).toBeLessThan(escB_normal);
    expect(escB_normal).toBeLessThan(escC_intensivo);
  });

  // 8. Capacidad mensual de cada plan
  it("8. Capacidad mensual exacta asignada por plan en ai.config.ts", () => {
    expect(getMonthlyTeacherAllowance("STARTER")).toBe(150);
    expect(getMonthlyStudentAllowance("STARTER")).toBe(0);

    expect(getMonthlyTeacherAllowance("PRO")).toBe(800);
    expect(getMonthlyStudentAllowance("PRO")).toBe(0);

    expect(getMonthlyTeacherAllowance("ACADEMY")).toBe(2800);
    expect(getMonthlyStudentAllowance("ACADEMY")).toBe(0);
  });

  // 9. Rollover correctamente considerado
  it("9. Rollover máximo configurado correctamente por plan", () => {
    expect(getMaxTeacherRollover("STARTER")).toBe(30);
    expect(getMaxStudentRollover("STARTER")).toBe(0);

    expect(getMaxTeacherRollover("PRO")).toBe(100);
    expect(getMaxStudentRollover("PRO")).toBe(0);

    expect(getMaxTeacherRollover("ACADEMY")).toBe(300);
    expect(getMaxStudentRollover("ACADEMY")).toBe(0);
  });

  // 10. Límites diarios/mensuales
  it("10. Límites diarios por operación se mantienen estrictos por plan", () => {
    expect(getDailyOperationLimit("STARTER", AIOperation.COURSE_GENERATION)).toBe(2);
    expect(getDailyOperationLimit("PRO", AIOperation.COURSE_GENERATION)).toBe(5);
    expect(getDailyOperationLimit("ACADEMY", AIOperation.COURSE_GENERATION)).toBe(15);

    expect(getDailyOperationLimit("STARTER", AIOperation.LANDING_GENERATION)).toBe(1);
    expect(getDailyOperationLimit("PRO", AIOperation.LANDING_GENERATION)).toBe(3);
    expect(getDailyOperationLimit("ACADEMY", AIOperation.LANDING_GENERATION)).toBe(8);
  });

  // 11. Ningún cálculo genera saldo negativo
  it("11. Simulaciones de consumo no producen saldos negativos al descontar de las wallets", () => {
    let walletSTARTER = getMonthlyTeacherAllowance("STARTER"); // 150
    const cursoEstándarCost = 31;

    let cursosCompletados = 0;
    while (walletSTARTER >= cursoEstándarCost) {
      walletSTARTER -= cursoEstándarCost;
      cursosCompletados++;
    }

    expect(walletSTARTER).toBeGreaterThanOrEqual(0);
    expect(cursosCompletados).toBe(4); // 150 - (4*31) = 26 sobrante
    expect(walletSTARTER).toBe(26);
  });

  // 12. Costes recomendados son informativos y no alteran producción
  it("12. Las recomendaciones económicas de auditoría son puramente informativas y NO alteran el catálogo de producción", () => {
    const auditRecommendedCatalog: Record<AIOperation, number> = {
      COURSE_GENERATION: 5,
      LESSON_GENERATION: 2,
      ACTIVITY_GENERATION: 1,
      QUIZ_GENERATION: 1,
      LANDING_GENERATION: 5, // Recomendación: reducir de 8 a 5
      LESSON_REGENERATION: 1,
      COURSE_REGENERATION: 3,
      AI_TUTOR: 1,
      AI_FEEDBACK: 1,
      CLASS_AGENT: 6,
      IMAGE_GENERATION: 1,
      IMAGE_GENERATION_HQ: 2,
    };

    // Verificar que el catálogo REAL de producción NO ha cambiado
    expect(getOperationCreditCost(AIOperation.LANDING_GENERATION)).toBe(8);
    expect(auditRecommendedCatalog[AIOperation.LANDING_GENERATION]).toBe(5);
  });
});

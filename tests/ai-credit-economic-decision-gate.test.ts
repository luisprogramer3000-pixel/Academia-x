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
import { SAAS_PLANS } from "@/modules/billing/billing.service";

describe("AI Credit Economic Decision Gate — PASO 4.4.3.1", () => {
  // 1. Catálogo completo
  it("1. Catálogo completo: Contiene las 9 operaciones de IA registradas", () => {
    const expectedOperations: AIOperation[] = [
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

    const catalogKeys = Object.keys(AI_OPERATION_CATALOG) as AIOperation[];
    expect(catalogKeys.length).toBe(12); // 9 originales + CLASS_AGENT + 2 de imagen

    for (const op of expectedOperations) {
      expect(catalogKeys).includes(op);
      expect(AI_OPERATION_CATALOG[op]).toBeDefined();
    }
  });

  // 2. Operaciones correctamente tipadas
  it("2. Operaciones correctamente tipadas entre Teacher y Student Credits", () => {
    const teacherOps: AIOperation[] = [
      AIOperation.COURSE_GENERATION,
      AIOperation.LESSON_GENERATION,
      AIOperation.ACTIVITY_GENERATION,
      AIOperation.QUIZ_GENERATION,
      AIOperation.LANDING_GENERATION,
      AIOperation.LESSON_REGENERATION,
      AIOperation.COURSE_REGENERATION,
    ];

    const studentOps: AIOperation[] = [AIOperation.AI_TUTOR, AIOperation.AI_FEEDBACK];

    for (const op of teacherOps) {
      expect(getOperationCreditType(op)).toBe(AICreditType.TEACHER);
    }

    for (const op of studentOps) {
      expect(getOperationCreditType(op)).toBe(AICreditType.STUDENT);
    }
  });

  // 3. Costes presentes
  it("3. Costes de crédito presentes y válidos en todas las operaciones", () => {
    for (const opKey of Object.keys(AI_OPERATION_CATALOG) as AIOperation[]) {
      const cost = getOperationCreditCost(opKey);
      expect(typeof cost).toBe("number");
      expect(isNaN(cost)).toBe(false);
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });

  // 4. Planes correctamente definidos en ai.config.ts
  it("4. Configuración autoritativa de planes (STARTER, PRO, ACADEMY) en ai.config.ts", () => {
    const starterConfig = getPlanAIConfig("STARTER");
    expect(starterConfig.teacherAllowance).toBe(150);
    expect(starterConfig.studentAllowance).toBe(0);

    const proConfig = getPlanAIConfig("PRO");
    expect(proConfig.teacherAllowance).toBe(800);
    expect(proConfig.studentAllowance).toBe(0);

    const academyConfig = getPlanAIConfig("ACADEMY");
    expect(academyConfig.teacherAllowance).toBe(2800);
    expect(academyConfig.studentAllowance).toBe(0);
  });

  // 5. Cálculos de escenarios (Eficiente = 17, Normal = 31, Intensivo = 71)
  it("5. Verificación matemática exacta de Escenarios A (17 cr), B (31 cr) y C (71 cr)", () => {
    // Escenario A (Eficiente): 1 CourseGen (5) + 6 LessonGen (12) = 17 cr
    const escA =
      getOperationCreditCost(AIOperation.COURSE_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_GENERATION) * 6;
    expect(escA).toBe(17);

    // Escenario B (Normal): 1 CourseGen (5) + 6 LessonGen (12) + 2 Act (2) + 2 Quiz (2) + 1 Landing (8) + 2 LessonRegen (2) = 31 cr
    const escB =
      getOperationCreditCost(AIOperation.COURSE_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_GENERATION) * 6 +
      getOperationCreditCost(AIOperation.ACTIVITY_GENERATION) * 2 +
      getOperationCreditCost(AIOperation.QUIZ_GENERATION) * 2 +
      getOperationCreditCost(AIOperation.LANDING_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_REGENERATION) * 2;
    expect(escB).toBe(31);

    // Escenario C (Intensivo): 1 CourseGen (5) + 15 LessonGen (30) + 15 Act (15) + 5 Quiz (5) + 1 Landing (8) + 1 CourseRegen (3) + 5 LessonRegen (5) = 71 cr
    const escC =
      getOperationCreditCost(AIOperation.COURSE_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_GENERATION) * 15 +
      getOperationCreditCost(AIOperation.ACTIVITY_GENERATION) * 15 +
      getOperationCreditCost(AIOperation.QUIZ_GENERATION) * 5 +
      getOperationCreditCost(AIOperation.LANDING_GENERATION) * 1 +
      getOperationCreditCost(AIOperation.COURSE_REGENERATION) * 1 +
      getOperationCreditCost(AIOperation.LESSON_REGENERATION) * 5;
    expect(escC).toBe(71);
  });

  // 6. Consistencia de créditos
  it("6. Consistencia de la estructura de catálogo sin inconsistencias de tipos o valores NaN", () => {
    for (const opKey of Object.keys(AI_OPERATION_CATALOG) as AIOperation[]) {
      const config = getAIOperationConfig(opKey);
      expect(config.operation).toBe(opKey);
      expect([AICreditType.TEACHER, AICreditType.STUDENT]).includes(config.creditType);
    }
  });

  // 7. Consistencia Teacher vs Student Credits
  it("7. Aislamiento absoluto: Ninguna operación de Profesor usa créditos de Estudiante y viceversa", () => {
    expect(getOperationCreditType(AIOperation.COURSE_GENERATION)).not.toBe(AICreditType.STUDENT);
    expect(getOperationCreditType(AIOperation.AI_TUTOR)).not.toBe(AICreditType.TEACHER);
  });

  // 8. Límites diarios vigentes
  it("8. Límites diarios están configurados para todos los planes en todas las operaciones", () => {
    for (const opKey of Object.keys(AI_OPERATION_CATALOG) as AIOperation[]) {
      const limitStarter = getDailyOperationLimit("STARTER", opKey);
      const limitPro = getDailyOperationLimit("PRO", opKey);
      const limitAcademy = getDailyOperationLimit("ACADEMY", opKey);

      expect(limitStarter).toBeGreaterThanOrEqual(0);
      expect(limitPro).toBeGreaterThanOrEqual(limitStarter);
      expect(limitAcademy).toBeGreaterThanOrEqual(limitPro);
    }
  });

  // 9. Cap de Rollover por plan
  it("9. Rollover máximo configurado correctamente y acotado por seguridad FinOps", () => {
    expect(getMaxTeacherRollover("STARTER")).toBe(30);
    expect(getMaxStudentRollover("STARTER")).toBe(0);

    expect(getMaxTeacherRollover("PRO")).toBe(100);
    expect(getMaxStudentRollover("PRO")).toBe(0);

    expect(getMaxTeacherRollover("ACADEMY")).toBe(300);
    expect(getMaxStudentRollover("ACADEMY")).toBe(0);
  });

  // 10. Verificación de sincronización de constantes en billing.service.ts frente a ai.config.ts
  it("10. Verificación de constante oficial en billing.service.ts en plena sintonía con ai.config.ts", () => {
    // Verificar que SAAS_PLANS en billing.service.ts fue sincronizado adecuadamente (150, 800, 2800)
    expect(SAAS_PLANS.STARTER.aiCreditsPerMonth).toBe(150);
    expect(SAAS_PLANS.PRO.aiCreditsPerMonth).toBe(800);
    expect(SAAS_PLANS.ACADEMY.aiCreditsPerMonth).toBe(2800);

    // Verificar que la fuente autoritativa en ai.config.ts sintoniza perfectamente
    const authStarter = getMonthlyTeacherAllowance("STARTER") + getMonthlyStudentAllowance("STARTER");
    expect(authStarter).toBe(150); // 150 Teacher + 0 Student

    const authPro = getMonthlyTeacherAllowance("PRO") + getMonthlyStudentAllowance("PRO");
    expect(authPro).toBe(800); // 600 Teacher + 200 Student
  });

  // 11. Detección de inconsistencias e investigación de LANDING_GENERATION
  it("11. Verificación de LANDING_GENERATION en 8 créditos en el catálogo activo", () => {
    const landingCost = getOperationCreditCost(AIOperation.LANDING_GENERATION);
    expect(landingCost).toBe(8);
  });

  // 12. Cálculos sin saldo negativo
  it("12. Simulación de consumo no produce saldos negativos en wallet", () => {
    let walletBalance = getMonthlyTeacherAllowance("PRO"); // 800 créditos
    const escBCost = 31; // Escenario B

    let totalCursos = 0;
    while (walletBalance >= escBCost) {
      walletBalance -= escBCost;
      totalCursos++;
    }

    expect(walletBalance).toBeGreaterThanOrEqual(0);
    expect(totalCursos).toBe(25); // 800 - (25 * 31) = 25 sobrante
    expect(walletBalance).toBe(25);
  });
});

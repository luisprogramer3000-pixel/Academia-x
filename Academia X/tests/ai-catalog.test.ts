import { describe, it, expect } from "vitest";
import { AIOperation, AICreditType } from "@prisma/client";
import {
  AI_OPERATION_CATALOG,
  AITier,
  getAIOperationConfig,
  getOperationCreditCost,
  getOperationCreditType,
  getOperationTier,
  getDailyOperationLimit,
} from "@/modules/ai/ai.catalog";

describe("AI Operation Catalog — Step 4.2", () => {
  it("1. Todas las 9 operaciones requeridas existen en el catálogo", () => {
    const requiredOps: AIOperation[] = [
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

    for (const op of requiredOps) {
      expect(AI_OPERATION_CATALOG[op]).toBeDefined();
    }
  });

  it("2. COURSE_GENERATION cuesta exactamente 5 créditos", () => {
    expect(getOperationCreditCost(AIOperation.COURSE_GENERATION)).toBe(5);
  });

  it("3. LESSON_GENERATION cuesta exactamente 2 créditos", () => {
    expect(getOperationCreditCost(AIOperation.LESSON_GENERATION)).toBe(2);
  });

  it("4. ACTIVITY_GENERATION cuesta exactamente 1 crédito", () => {
    expect(getOperationCreditCost(AIOperation.ACTIVITY_GENERATION)).toBe(1);
  });

  it("5. QUIZ_GENERATION cuesta exactamente 1 crédito", () => {
    expect(getOperationCreditCost(AIOperation.QUIZ_GENERATION)).toBe(1);
  });

  it("6. LANDING_GENERATION cuesta exactamente 8 créditos", () => {
    expect(getOperationCreditCost(AIOperation.LANDING_GENERATION)).toBe(8);
  });

  it("7. LESSON_REGENERATION cuesta exactamente 1 crédito", () => {
    expect(getOperationCreditCost(AIOperation.LESSON_REGENERATION)).toBe(1);
  });

  it("8. COURSE_REGENERATION cuesta exactamente 3 créditos", () => {
    expect(getOperationCreditCost(AIOperation.COURSE_REGENERATION)).toBe(3);
  });

  it("9. AI_TUTOR cuesta exactamente 1 crédito", () => {
    expect(getOperationCreditCost(AIOperation.AI_TUTOR)).toBe(1);
  });

  it("10. AI_FEEDBACK cuesta exactamente 1 crédito", () => {
    expect(getOperationCreditCost(AIOperation.AI_FEEDBACK)).toBe(1);
  });

  it("20. AI_TUTOR pertenece al tipo STUDENT", () => {
    expect(getOperationCreditType(AIOperation.AI_TUTOR)).toBe(AICreditType.STUDENT);
  });

  it("21. AI_FEEDBACK pertenece al tipo STUDENT", () => {
    expect(getOperationCreditType(AIOperation.AI_FEEDBACK)).toBe(AICreditType.STUDENT);
  });

  it("22. COURSE_GENERATION pertenece al tipo TEACHER", () => {
    expect(getOperationCreditType(AIOperation.COURSE_GENERATION)).toBe(AICreditType.TEACHER);
  });

  it("23. Starter Course Daily Limit = 2", () => {
    expect(getDailyOperationLimit("STARTER", AIOperation.COURSE_GENERATION)).toBe(2);
  });

  it("24. Pro Course Daily Limit = 5", () => {
    expect(getDailyOperationLimit("PRO", AIOperation.COURSE_GENERATION)).toBe(5);
  });

  it("25. Academy Course Daily Limit = 15", () => {
    expect(getDailyOperationLimit("ACADEMY", AIOperation.COURSE_GENERATION)).toBe(15);
  });

  it("Obtiene correctamente los tiers de IA por operación", () => {
    expect(getOperationTier(AIOperation.COURSE_GENERATION)).toBe(AITier.PREMIUM);
    expect(getOperationTier(AIOperation.LESSON_GENERATION)).toBe(AITier.ECONOMIC);
  });

  it("AI_TUTOR Daily Limits: Starter = 0, Pro = 200, Academy = 800", () => {
    expect(getDailyOperationLimit("STARTER", AIOperation.AI_TUTOR)).toBe(0);
    expect(getDailyOperationLimit("PRO", AIOperation.AI_TUTOR)).toBe(200);
    expect(getDailyOperationLimit("ACADEMY", AIOperation.AI_TUTOR)).toBe(800);
  });
});

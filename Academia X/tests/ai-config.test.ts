import { describe, it, expect } from "vitest";
import {
  PLAN_AI_CREDIT_CONFIG,
  LEGACY_PLAN_AI_TOKENS_LIMIT,
  getPlanAIConfig,
  getMonthlyTeacherAllowance,
  getMonthlyStudentAllowance,
  getMaxTeacherRollover,
  getMaxStudentRollover,
} from "@/modules/ai/ai.config";

describe("Plan AI Configuration — Step 4.2", () => {
  it("11. STARTER = 150 Teacher Credits", () => {
    expect(getMonthlyTeacherAllowance("STARTER")).toBe(150);
  });

  it("12. STARTER = 0 Student Credits", () => {
    expect(getMonthlyStudentAllowance("STARTER")).toBe(0);
  });

  it("13. PRO = 600 Teacher Credits", () => {
    expect(getMonthlyTeacherAllowance("PRO")).toBe(600);
  });

  it("14. PRO = 200 Student Credits", () => {
    expect(getMonthlyStudentAllowance("PRO")).toBe(200);
  });

  it("15. ACADEMY = 2000 Teacher Credits", () => {
    expect(getMonthlyTeacherAllowance("ACADEMY")).toBe(2000);
  });

  it("16. ACADEMY = 800 Student Credits", () => {
    expect(getMonthlyStudentAllowance("ACADEMY")).toBe(800);
  });

  it("17. STARTER Max Rollover Teacher = 30", () => {
    expect(getMaxTeacherRollover("STARTER")).toBe(30);
    expect(getMaxStudentRollover("STARTER")).toBe(0);
  });

  it("18. PRO Max Rollover Teacher = 100", () => {
    expect(getMaxTeacherRollover("PRO")).toBe(100);
    expect(getMaxStudentRollover("PRO")).toBe(50);
  });

  it("19. ACADEMY Max Rollover Teacher = 300", () => {
    expect(getMaxTeacherRollover("ACADEMY")).toBe(300);
    expect(getMaxStudentRollover("ACADEMY")).toBe(150);
  });

  it("Conserva la configuración legacy de tokens intacta", () => {
    expect(LEGACY_PLAN_AI_TOKENS_LIMIT.STARTER).toBe(50000);
    expect(LEGACY_PLAN_AI_TOKENS_LIMIT.PRO).toBe(250000);
    expect(LEGACY_PLAN_AI_TOKENS_LIMIT.ACADEMY).toBe(1000000);
  });

  it("Fallback seguro para planId no válido", () => {
    const fallbackConfig = getPlanAIConfig("UNKNOWN_PLAN");
    expect(fallbackConfig.planId).toBe("STARTER");
    expect(fallbackConfig.teacherAllowance).toBe(150);
  });
});

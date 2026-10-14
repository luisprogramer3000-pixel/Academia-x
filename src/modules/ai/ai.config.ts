import { PlanId } from "./ai.catalog";

export interface PlanAIConfig {
  planId: PlanId;
  teacherAllowance: number;
  studentAllowance: number;
  maxRolloverTeacher: number;
  maxRolloverStudent: number;
}

export const PLAN_AI_CREDIT_CONFIG: Record<PlanId, PlanAIConfig> = {
  STARTER: {
    planId: "STARTER",
    teacherAllowance: 150,
    studentAllowance: 0,
    maxRolloverTeacher: 30,
    maxRolloverStudent: 0,
  },
  PRO: {
    planId: "PRO",
    teacherAllowance: 800,
    studentAllowance: 0,
    maxRolloverTeacher: 100,
    maxRolloverStudent: 0,
  },
  ACADEMY: {
    planId: "ACADEMY",
    teacherAllowance: 2800,
    studentAllowance: 0,
    maxRolloverTeacher: 300,
    maxRolloverStudent: 0,
  },
};

/**
 * LÍMITES LEGACY BASADOS EN TOKENS
 * (Se conservan para compatibilidad hacia atrás mientras se migran todas las vistas a Créditos)
 */
export const LEGACY_PLAN_AI_TOKENS_LIMIT: Record<PlanId, number> = {
  STARTER: 50000,
  PRO: 250000,
  ACADEMY: 1000000,
};

/**
 * Validaciones internas de integridad de configuración de planes.
 */
function validatePlanConfigIntegrity() {
  for (const pKey of Object.keys(PLAN_AI_CREDIT_CONFIG) as PlanId[]) {
    const config = PLAN_AI_CREDIT_CONFIG[pKey];
    if (
      config.teacherAllowance < 0 ||
      config.studentAllowance < 0 ||
      config.maxRolloverTeacher < 0 ||
      config.maxRolloverStudent < 0
    ) {
      throw new Error(`Integrity Error: Plan ${pKey} has negative allowances or rollover.`);
    }
  }
}

validatePlanConfigIntegrity();

/**
 * Funciones Puras Helper para Planes (Deterministas, sin acceso a Prisma DB)
 */
export function getPlanAIConfig(planId: string): PlanAIConfig {
  const normalizedPlanId = (planId?.toUpperCase() || "STARTER") as PlanId;
  const config = PLAN_AI_CREDIT_CONFIG[normalizedPlanId];
  if (!config) {
    return PLAN_AI_CREDIT_CONFIG.STARTER;
  }
  return config;
}

export function getMonthlyTeacherAllowance(planId: string): number {
  return getPlanAIConfig(planId).teacherAllowance;
}

export function getMonthlyStudentAllowance(planId: string): number {
  return getPlanAIConfig(planId).studentAllowance;
}

export function getMaxTeacherRollover(planId: string): number {
  return getPlanAIConfig(planId).maxRolloverTeacher;
}

export function getMaxStudentRollover(planId: string): number {
  return getPlanAIConfig(planId).maxRolloverStudent;
}

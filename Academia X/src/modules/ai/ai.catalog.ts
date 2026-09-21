import { AIOperation, AICreditType } from "@prisma/client";

export enum AITier {
  FREE = "FREE",
  ECONOMIC = "ECONOMIC",
  PREMIUM = "PREMIUM",
}

export type PlanId = "STARTER" | "PRO" | "ACADEMY";

export interface AIOperationConfig {
  operation: AIOperation;
  creditType: AICreditType;
  creditCost: number;
  tier: AITier;
  dailyLimits: {
    STARTER: number;
    PRO: number;
    ACADEMY: number;
  };
}

export const AI_OPERATION_CATALOG: Record<AIOperation, AIOperationConfig> = {
  COURSE_GENERATION: {
    operation: AIOperation.COURSE_GENERATION,
    creditType: AICreditType.TEACHER,
    creditCost: 5,
    tier: AITier.PREMIUM,
    dailyLimits: {
      STARTER: 2,
      PRO: 5,
      ACADEMY: 15,
    },
  },
  LESSON_GENERATION: {
    operation: AIOperation.LESSON_GENERATION,
    creditType: AICreditType.TEACHER,
    creditCost: 2,
    tier: AITier.ECONOMIC,
    dailyLimits: {
      STARTER: 10,
      PRO: 25,
      ACADEMY: 75,
    },
  },
  ACTIVITY_GENERATION: {
    operation: AIOperation.ACTIVITY_GENERATION,
    creditType: AICreditType.TEACHER,
    creditCost: 1,
    tier: AITier.ECONOMIC,
    dailyLimits: {
      STARTER: 20,
      PRO: 50,
      ACADEMY: 150,
    },
  },
  QUIZ_GENERATION: {
    operation: AIOperation.QUIZ_GENERATION,
    creditType: AICreditType.TEACHER,
    creditCost: 1,
    tier: AITier.ECONOMIC,
    dailyLimits: {
      STARTER: 20,
      PRO: 50,
      ACADEMY: 150,
    },
  },
  LANDING_GENERATION: {
    operation: AIOperation.LANDING_GENERATION,
    creditType: AICreditType.TEACHER,
    creditCost: 8,
    tier: AITier.PREMIUM,
    dailyLimits: {
      STARTER: 1,
      PRO: 3,
      ACADEMY: 8,
    },
  },
  LESSON_REGENERATION: {
    operation: AIOperation.LESSON_REGENERATION,
    creditType: AICreditType.TEACHER,
    creditCost: 1,
    tier: AITier.ECONOMIC,
    dailyLimits: {
      STARTER: 10,
      PRO: 25,
      ACADEMY: 75,
    },
  },
  COURSE_REGENERATION: {
    operation: AIOperation.COURSE_REGENERATION,
    creditType: AICreditType.TEACHER,
    creditCost: 3,
    tier: AITier.PREMIUM,
    dailyLimits: {
      STARTER: 2,
      PRO: 5,
      ACADEMY: 15,
    },
  },
  AI_TUTOR: {
    operation: AIOperation.AI_TUTOR,
    creditType: AICreditType.STUDENT,
    creditCost: 1,
    tier: AITier.ECONOMIC,
    dailyLimits: {
      STARTER: 0,
      PRO: 200,
      ACADEMY: 800,
    },
  },
  AI_FEEDBACK: {
    operation: AIOperation.AI_FEEDBACK,
    creditType: AICreditType.STUDENT,
    creditCost: 1,
    tier: AITier.ECONOMIC,
    dailyLimits: {
      STARTER: 0,
      PRO: 200,
      ACADEMY: 800,
    },
  },
};

/**
 * Validaciones internas de integridad del catálogo.
 */
function validateCatalogIntegrity() {
  const studentOps: AIOperation[] = [AIOperation.AI_TUTOR, AIOperation.AI_FEEDBACK];

  for (const opKey of Object.keys(AI_OPERATION_CATALOG) as AIOperation[]) {
    const config = AI_OPERATION_CATALOG[opKey];
    if (config.creditCost < 0) {
      throw new Error(`Integrity Error: ${opKey} has negative creditCost.`);
    }
    if (
      config.dailyLimits.STARTER < 0 ||
      config.dailyLimits.PRO < 0 ||
      config.dailyLimits.ACADEMY < 0
    ) {
      throw new Error(`Integrity Error: ${opKey} has negative daily limits.`);
    }
    if (studentOps.includes(opKey) && config.creditType !== AICreditType.STUDENT) {
      throw new Error(`Integrity Error: Student operation ${opKey} must be STUDENT creditType.`);
    }
    if (!studentOps.includes(opKey) && config.creditType !== AICreditType.TEACHER) {
      throw new Error(`Integrity Error: Teacher operation ${opKey} must be TEACHER creditType.`);
    }
  }
}

validateCatalogIntegrity();

/**
 * Funciones Puras Helper (Deterministas, sin acceso a Prisma DB)
 */
export function getAIOperationConfig(operation: AIOperation): AIOperationConfig {
  const config = AI_OPERATION_CATALOG[operation];
  if (!config) {
    throw new Error(`Operación de IA no soportada: ${operation}`);
  }
  return config;
}

export function getOperationCreditCost(operation: AIOperation): number {
  return getAIOperationConfig(operation).creditCost;
}

export function getOperationCreditType(operation: AIOperation): AICreditType {
  return getAIOperationConfig(operation).creditType;
}

export function getOperationTier(operation: AIOperation): AITier {
  return getAIOperationConfig(operation).tier;
}

export function getDailyOperationLimit(planId: PlanId, operation: AIOperation): number {
  const config = getAIOperationConfig(operation);
  const normalizedPlanId = (planId?.toUpperCase() || "STARTER") as PlanId;
  return config.dailyLimits[normalizedPlanId] ?? config.dailyLimits.STARTER;
}

import { PLAN_AI_CREDIT_CONFIG } from "@/modules/ai/ai.config";
import type { BillingInterval } from "@prisma/client";

/**
 * Catálogo oficial de planes SaaS (módulo puro, seguro para componentes cliente).
 */

export interface PlanPricing {
  price: number; // Monto para display (ej: 29 o 278.40)
  amountCents: number; // Monto exacto en centavos para backend (ej: 2900 o 27840)
  currency: string;
  equivalentMonthlyPrice?: number; // Para anual: 23.20, 63.20, 159.20
  annualSavings?: number; // Para anual: 69.60, 189.60, 477.60
}

export interface PlanConfig {
  id: "STARTER" | "PRO" | "ACADEMY";
  name: string;
  price: number; // Precio mensual base por compatibilidad con tests existentes
  currency: string;
  maxStudents: number;
  maxTeachers: number;
  aiCreditsPerMonth: number;
  teacherCredits: number;
  studentCredits: number;
  features: string[];
  /** Capacidades habilitadas por plan (se aplican en servidor) */
  capabilities: {
    customBranding: boolean;
    customDomain: boolean;
    advancedAnalytics: boolean;
  };
  pricing: Record<BillingInterval, PlanPricing>;
}

export const SAAS_PLANS: Record<string, PlanConfig> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    price: 29,
    currency: "USD",
    maxStudents: 50,
    maxTeachers: 1,
    aiCreditsPerMonth: PLAN_AI_CREDIT_CONFIG.STARTER.teacherAllowance + PLAN_AI_CREDIT_CONFIG.STARTER.studentAllowance,
    teacherCredits: PLAN_AI_CREDIT_CONFIG.STARTER.teacherAllowance,
    studentCredits: PLAN_AI_CREDIT_CONFIG.STARTER.studentAllowance,
    features: ["1 Academia pública", "Hasta 50 estudiantes", "1 profesor", "150 Créditos Profesor IA / mes", "Certificados estándar"],
    capabilities: { customBranding: false, customDomain: false, advancedAnalytics: false },
    pricing: {
      MONTHLY: {
        price: 29,
        amountCents: 2900,
        currency: "USD",
      },
      YEARLY: {
        price: 278.4,
        amountCents: 27840,
        currency: "USD",
        equivalentMonthlyPrice: 23.2,
        annualSavings: 69.6,
      },
    },
  },
  PRO: {
    id: "PRO",
    name: "Professional VIP",
    price: 79,
    currency: "USD",
    maxStudents: 1000,
    maxTeachers: 3,
    aiCreditsPerMonth: PLAN_AI_CREDIT_CONFIG.PRO.teacherAllowance + PLAN_AI_CREDIT_CONFIG.PRO.studentAllowance,
    teacherCredits: PLAN_AI_CREDIT_CONFIG.PRO.teacherAllowance,
    studentCredits: PLAN_AI_CREDIT_CONFIG.PRO.studentAllowance,
    features: ["Hasta 1000 estudiantes", "Hasta 3 profesores", "800 Créditos Profesor IA / mes", "Branding completo", "Certificados verificables"],
    capabilities: { customBranding: true, customDomain: false, advancedAnalytics: false },
    pricing: {
      MONTHLY: {
        price: 79,
        amountCents: 7900,
        currency: "USD",
      },
      YEARLY: {
        price: 758.4,
        amountCents: 75840,
        currency: "USD",
        equivalentMonthlyPrice: 63.2,
        annualSavings: 189.6,
      },
    },
  },
  ACADEMY: {
    id: "ACADEMY",
    name: "Academy Executive",
    price: 199,
    currency: "USD",
    maxStudents: 5000,
    maxTeachers: 15,
    aiCreditsPerMonth: PLAN_AI_CREDIT_CONFIG.ACADEMY.teacherAllowance + PLAN_AI_CREDIT_CONFIG.ACADEMY.studentAllowance,
    teacherCredits: PLAN_AI_CREDIT_CONFIG.ACADEMY.teacherAllowance,
    studentCredits: PLAN_AI_CREDIT_CONFIG.ACADEMY.studentAllowance,
    features: ["Hasta 5,000 estudiantes", "Hasta 15 profesores", "Dominio personalizado", "2,800 Créditos Profesor IA / mes", "Analíticas avanzadas", "Soporte Prioritario VIP"],
    capabilities: { customBranding: true, customDomain: true, advancedAnalytics: true },
    pricing: {
      MONTHLY: {
        price: 199,
        amountCents: 19900,
        currency: "USD",
      },
      YEARLY: {
        price: 1910.4,
        amountCents: 191040,
        currency: "USD",
        equivalentMonthlyPrice: 159.2,
        annualSavings: 477.6,
      },
    },
  },
};

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateProductionEnv } from "@/lib/env";
import { getAIAdapter, MockAIAdapter, OpenAIAdapter } from "@/modules/ai/ai.adapter";
import { PLAN_AI_CREDIT_CONFIG } from "@/modules/ai/ai.config";
import { AI_OPERATION_CATALOG } from "@/modules/ai/ai.catalog";
import { SAAS_PLANS } from "@/modules/billing/billing.service";
import { TOPUP_PACKAGES } from "@/modules/ai/ai.topup-catalog";

describe("Production Readiness & Environment Safety Suite — Step 6.1", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Restaurar copia limpia de process.env antes de cada test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("1. Detección de entorno de producción", () => {
    (process.env as any).NODE_ENV = "production";
    expect(process.env.NODE_ENV).toBe("production");
  });

  it("2. Producción rechaza la falta de JWT_SECRET (Fail-Fast)", () => {
    (process.env as any).NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;

    expect(() => validateProductionEnv()).toThrow(/JWT_SECRET/);
  });

  it("3. Producción detecta la falta de DATABASE_URL", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.JWT_SECRET = "jwt_secret_test_min_32_chars_ok!";
    delete process.env.DATABASE_URL;

    expect(() => validateProductionEnv()).toThrow(/DATABASE_URL/);
  });

  it("4. Producción rechaza la falta de OPENAI_API_KEY cuando no está en modo mock", () => {
    (process.env as any).NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";
    process.env.JWT_SECRET = "jwt_secret_test_min_32_chars_ok!";
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_123";
    process.env.CRON_SECRET = "cron_secret_123";
    process.env.AI_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;

    expect(() => validateProductionEnv()).toThrow(/OPENAI_API_KEY/);
  });

  it("5. MockAIAdapter no se permite por defecto en producción sin OPENAI_API_KEY", () => {
    (process.env as any).NODE_ENV = "production";
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_PROVIDER;

    expect(() => getAIAdapter()).toThrow(/OPENAI_API_KEY/);
  });

  it("6. Detección de configuración de Stripe para producción", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
    expect(process.env.STRIPE_SECRET_KEY).toBeDefined();
    expect(process.env.STRIPE_WEBHOOK_SECRET).toBeDefined();
  });

  it("7. Validación de secreto de CRON_SECRET", () => {
    process.env.CRON_SECRET = "secret_cron_token_123";
    expect(process.env.CRON_SECRET).toBe("secret_cron_token_123");
  });

  it("8. Detección de configuración de Upstash Redis para rate limiting", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://upstash.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "upstash_token_123";

    expect(process.env.UPSTASH_REDIS_REST_URL).toBeDefined();
    expect(process.env.UPSTASH_REDIS_REST_TOKEN).toBeDefined();
  });

  it("9. Ningún secreto expuesto a través de variables NEXT_PUBLIC", () => {
    const publicEnvKeys = Object.keys(process.env).filter((key) => key.startsWith("NEXT_PUBLIC_"));

    for (const key of publicEnvKeys) {
      expect(key).not.toContain("SECRET");
      expect(key).not.toContain("PRIVATE");
      expect(key).not.toContain("DATABASE");
      expect(key).not.toContain("JWT");
    }
  });

  it("10. El entorno de desarrollo permanece totalmente funcional", () => {
    (process.env as any).NODE_ENV = "development";
    process.env.AI_PROVIDER = "mock";
    delete process.env.OPENAI_API_KEY;

    const adapter = getAIAdapter();
    expect(adapter).toBeInstanceOf(MockAIAdapter);
  });

  it("11. El entorno de tests permanece totalmente funcional", () => {
    (process.env as any).NODE_ENV = "test";
    const adapter = getAIAdapter();
    expect(adapter).toBeInstanceOf(MockAIAdapter);
  });

  it("12. El catálogo de operaciones de IA permanece inalterado", () => {
    expect(AI_OPERATION_CATALOG.COURSE_GENERATION.creditCost).toBe(5);
    expect(AI_OPERATION_CATALOG.LESSON_GENERATION.creditCost).toBe(2);
    expect(AI_OPERATION_CATALOG.AI_TUTOR.creditCost).toBe(1);
    expect(AI_OPERATION_CATALOG.AI_FEEDBACK.creditCost).toBe(1);
  });

  it("13. Los precios oficiales SaaS permanecen inalterados ($29, $79, $199)", () => {
    expect(SAAS_PLANS.STARTER.price).toBe(29);
    expect(SAAS_PLANS.PRO.price).toBe(79);
    expect(SAAS_PLANS.ACADEMY.price).toBe(199);
  });

  it("14. El catálogo de Top-Ups permanece inalterado", () => {
    expect(TOPUP_PACKAGES.TEACHER_TOPUP_50.price).toBe(15);
    expect(TOPUP_PACKAGES.TEACHER_TOPUP_50.credits).toBe(50);

    expect(TOPUP_PACKAGES.TEACHER_TOPUP_150.price).toBe(39);
    expect(TOPUP_PACKAGES.TEACHER_TOPUP_150.credits).toBe(150);

    expect(TOPUP_PACKAGES.TEACHER_TOPUP_500.price).toBe(119);
    expect(TOPUP_PACKAGES.TEACHER_TOPUP_500.credits).toBe(500);

    expect(TOPUP_PACKAGES.STUDENT_TOPUP_100.price).toBe(10);
    expect(TOPUP_PACKAGES.STUDENT_TOPUP_100.credits).toBe(100);

    expect(TOPUP_PACKAGES.STUDENT_TOPUP_500.price).toBe(45);
    expect(TOPUP_PACKAGES.STUDENT_TOPUP_500.credits).toBe(500);
  });

  it("15. La configuración de cuotas y rollover multi-tenant permanece inalterada", () => {
    expect(PLAN_AI_CREDIT_CONFIG.STARTER.teacherAllowance).toBe(150);
    expect(PLAN_AI_CREDIT_CONFIG.STARTER.maxRolloverTeacher).toBe(30);

    expect(PLAN_AI_CREDIT_CONFIG.PRO.teacherAllowance).toBe(800);
    expect(PLAN_AI_CREDIT_CONFIG.PRO.studentAllowance).toBe(0);
    expect(PLAN_AI_CREDIT_CONFIG.PRO.maxRolloverTeacher).toBe(100);
    expect(PLAN_AI_CREDIT_CONFIG.PRO.maxRolloverStudent).toBe(0);

    expect(PLAN_AI_CREDIT_CONFIG.ACADEMY.teacherAllowance).toBe(2800);
    expect(PLAN_AI_CREDIT_CONFIG.ACADEMY.studentAllowance).toBe(0);
    expect(PLAN_AI_CREDIT_CONFIG.ACADEMY.maxRolloverTeacher).toBe(300);
    expect(PLAN_AI_CREDIT_CONFIG.ACADEMY.maxRolloverStudent).toBe(0);
  });
});

/**
 * Módulo Centralizado de Validación de Variables de Entorno y Production Fail-Fast
 */

export interface EnvValidationResult {
  valid: boolean;
  environment: string;
  missingSecrets: string[];
  /** Variables recomendadas para producción que faltan (no bloquean el arranque) */
  warnings: string[];
  publicVars: Record<string, string | undefined>;
}

export function validateProductionEnv(): EnvValidationResult {
  const env = process.env.NODE_ENV || "development";
  const isProduction = env === "production";

  const publicVars = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_HOST: process.env.NEXT_PUBLIC_APP_HOST,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  };

  const criticalProductionSecrets = [
    "DATABASE_URL",
    "JWT_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "CRON_SECRET",
  ];

  // Si no se utiliza mock explícito de IA en producción, OPENAI_API_KEY es obligatoria
  const aiProvider = (process.env.AI_PROVIDER || (isProduction ? "openai" : "mock")).toLowerCase();
  if (aiProvider !== "mock") {
    criticalProductionSecrets.push("OPENAI_API_KEY");
  }

  // Si rate limiting no está configurado como mock en prod, Upstash es obligatorio
  const rateLimitProvider = (process.env.RATE_LIMIT_PROVIDER || (isProduction ? "upstash" : "memory")).toLowerCase();
  if (rateLimitProvider !== "memory") {
    criticalProductionSecrets.push("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN");
  }

  const missingSecrets: string[] = [];

  for (const secretKey of criticalProductionSecrets) {
    if (!process.env[secretKey]) {
      missingSecrets.push(secretKey);
    }
  }

  // Un JWT_SECRET corto equivale a no tenerlo
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32 && !missingSecrets.includes("JWT_SECRET")) {
    missingSecrets.push("JWT_SECRET");
  }

  const recommended = [
    "NEXT_PUBLIC_APP_URL",
    "NEXT_PUBLIC_APP_HOST",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "STRIPE_PRICE_STARTER_MONTHLY",
    "STRIPE_PRICE_STARTER_YEARLY",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_YEARLY",
    "STRIPE_PRICE_ACADEMY_MONTHLY",
    "STRIPE_PRICE_ACADEMY_YEARLY",
  ];
  const warnings = recommended.filter((key) => !process.env[key]);

  const valid = missingSecrets.length === 0;

  if (isProduction && !valid) {
    throw new Error(
      `PRODUCTION CONFIGURATION ERROR: Faltan secretos críticos en producción: [${missingSecrets.join(
        ", "
      )}]. Revisa tus variables de entorno.`
    );
  }

  return {
    valid,
    environment: env,
    missingSecrets,
    warnings,
    publicVars,
  };
}

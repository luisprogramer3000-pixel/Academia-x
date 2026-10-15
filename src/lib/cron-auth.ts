import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * Autorización de las tareas programadas (/api/cron/*): cabecera
 * "Authorization: Bearer <CRON_SECRET>" o "x-cron-secret: <CRON_SECRET>".
 * En producción CRON_SECRET es obligatorio; en local, sin secreto, se permite.
 */
export function verifyCronAuthorization(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction && (!cronSecret || cronSecret.trim() === "")) {
    console.error("[CRON] Unauthorized: CRON_SECRET is missing in production environment.");
    return false;
  }
  if (!cronSecret) return true;

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : undefined;
  const customHeader = req.headers.get("x-cron-secret")?.trim();

  const isBearerValid = Boolean(bearerToken) && secretsMatch(bearerToken!, cronSecret);
  const isCustomValid = Boolean(customHeader) && secretsMatch(customHeader!, cronSecret);
  return isBearerValid || isCustomValid;
}

/** Comparación en tiempo constante (los hash igualan la longitud): no filtra el secreto por tiempos. */
function secretsMatch(given: string, expected: string): boolean {
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

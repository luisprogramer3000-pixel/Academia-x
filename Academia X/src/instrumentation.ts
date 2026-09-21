/**
 * Se ejecuta una vez al arrancar el servidor (Next.js instrumentation hook).
 * En producción aborta el arranque si faltan secretos críticos (fail-fast).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { validateProductionEnv } = await import("@/lib/env");
  const result = validateProductionEnv();

  if (result.warnings.length > 0 && result.environment === "production") {
    console.warn(`[env] Variables recomendadas sin configurar: ${result.warnings.join(", ")}`);
  }
}

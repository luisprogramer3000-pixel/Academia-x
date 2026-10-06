/**
 * Zonas horarias. En la base de datos todo se guarda en UTC (timestamptz); al
 * mostrar una fecha desde el SERVIDOR se convierte a la zona de la academia
 * (Tenant.timezone). En el navegador, el Planificador usa la zona de cada
 * persona, que ya es la correcta para ella.
 */

export const DEFAULT_TIMEZONE = "America/Guayaquil";

/** Zonas ofrecidas en Configuración (las de los mercados de la plataforma). */
export const TIMEZONE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "America/Guayaquil", label: "Ecuador (Guayaquil / Quito)" },
  { id: "America/Bogota", label: "Colombia (Bogotá)" },
  { id: "America/Lima", label: "Perú (Lima)" },
  { id: "America/Mexico_City", label: "México (Ciudad de México)" },
  { id: "America/Panama", label: "Panamá" },
  { id: "America/Costa_Rica", label: "Costa Rica" },
  { id: "America/Guatemala", label: "Guatemala / Centroamérica" },
  { id: "America/Caracas", label: "Venezuela (Caracas)" },
  { id: "America/La_Paz", label: "Bolivia (La Paz)" },
  { id: "America/Santiago", label: "Chile (Santiago)" },
  { id: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { id: "America/Montevideo", label: "Uruguay (Montevideo)" },
  { id: "America/Asuncion", label: "Paraguay (Asunción)" },
  { id: "America/Sao_Paulo", label: "Brasil (São Paulo)" },
  { id: "America/Santo_Domingo", label: "República Dominicana" },
  { id: "America/Puerto_Rico", label: "Puerto Rico" },
  { id: "America/New_York", label: "EE. UU. Este (Nueva York, Miami)" },
  { id: "America/Chicago", label: "EE. UU. Centro (Chicago)" },
  { id: "America/Denver", label: "EE. UU. Montaña (Denver)" },
  { id: "America/Los_Angeles", label: "EE. UU. Pacífico (Los Ángeles)" },
  { id: "Europe/Madrid", label: "España (Madrid)" },
  { id: "Europe/London", label: "Reino Unido (Londres)" },
  { id: "Europe/Lisbon", label: "Portugal (Lisboa)" },
  { id: "Europe/Istanbul", label: "Turquía (Estambul)" },
  { id: "Asia/Tbilisi", label: "Georgia (Tiflis)" },
  { id: "Asia/Dubai", label: "Emiratos Árabes (Dubái)" },
  { id: "UTC", label: "UTC" },
];

/** ¿Es una zona IANA que entiende el sistema? */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function safeTimezone(tz?: string | null): string {
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** Formatea una fecha en la zona indicada (por defecto, en español). */
export function formatInTimezone(date: Date | string, tz: string | null | undefined, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es", { ...options, timeZone: safeTimezone(tz) }).format(new Date(date));
}

/** Año, mes (0-11) y día de una fecha vista en una zona horaria. */
export function partsInTimezone(date: Date, tz: string): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimezone(tz),
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month") - 1, day: get("day"), hour: get("hour"), minute: get("minute") };
}

/**
 * Instante UTC que corresponde a una fecha y hora "de reloj" en una zona
 * (p. ej. el 1 de octubre a las 00:00 en Ecuador). Tiene en cuenta el horario de verano.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const asUtc = Date.UTC(year, month, day, hour, minute);
  // Diferencia entre la hora de reloj deseada y la que muestra la zona en ese instante
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = partsInTimezone(new Date(guess), tz);
    const shown = Date.UTC(p.year, p.month, p.day, p.hour, p.minute);
    guess += asUtc - shown;
  }
  return new Date(guess);
}

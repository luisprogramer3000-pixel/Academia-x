/**
 * Idiomas de la interfaz de Mentor Studio Global (no confundir con el idioma
 * del contenido de cada academia o curso, que es Tenant.language / Course.language).
 *
 * El idioma elegido se guarda en la cookie LOCALE_COOKIE (sin cambiar las URLs).
 * Sin cookie, se usa el idioma del navegador (Accept-Language) si está disponible.
 */
export const LOCALES = ["es", "en", "fr", "de", "tr"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "msg_locale";
/** Un año */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Nombre de cada idioma en su propio idioma (así lo reconoce quien no lee español). */
export const LOCALE_NAMES: Record<Locale, string> = {
  es: "Español",
  en: "English",
  fr: "Français",
  de: "Deutsch",
  tr: "Türkçe",
};

/** Formato de fechas y números (Intl) de cada idioma. */
export const LOCALE_INTL: Record<Locale, string> = {
  es: "es",
  en: "en-US",
  fr: "fr-FR",
  de: "de-DE",
  tr: "tr-TR",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Mejor idioma soportado según la cabecera Accept-Language del navegador ("de-DE,de;q=0.9,en;q=0.8"). */
export function matchAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { base: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.trim().slice(2)) || 0 : 1 };
    })
    .filter((x) => x.base)
    .sort((a, b) => b.q - a.q);
  for (const { base } of ranked) if (isLocale(base)) return base;
  return null;
}

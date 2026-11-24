import { cache } from "react";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, matchAcceptLanguage, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

/**
 * Idioma de la interfaz para la petición en curso (componentes de servidor y
 * server actions): la cookie elegida con el botón de idioma; si no hay, el
 * idioma del navegador; si no se soporta, español.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return matchAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
});

/** Idioma + textos de la petición en curso. */
export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}

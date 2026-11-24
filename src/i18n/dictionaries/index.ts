import type { Locale } from "../config";
import { es, type Dictionary } from "./es";
import { en } from "./en";
import { fr } from "./fr";
import { de } from "./de";
import { tr } from "./tr";

export type { Dictionary };

const DICTIONARIES: Record<Locale, Dictionary> = { es, en, fr, de, tr };

/** Solo servidor: el cliente recibe únicamente el diccionario del idioma elegido (I18nProvider). */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? es;
}

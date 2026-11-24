"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";
import type { Dictionary } from "./dictionaries/es";

const I18nContext = createContext<{ locale: Locale; t: Dictionary } | null>(null);

/** Lo monta el layout raíz con el idioma y los textos de la petición (solo los del idioma elegido). */
export function I18nProvider({ locale, t, children }: { locale: Locale; t: Dictionary; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>;
}

/** Idioma y textos en componentes cliente. */
export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n necesita <I18nProvider> (lo monta src/app/layout.tsx).");
  return value;
}

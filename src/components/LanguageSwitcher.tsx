"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe } from "lucide-react";
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

/**
 * Botón de idioma. Guarda la elección en una cookie (un año) y vuelve a
 * renderizar la página en el servidor con los textos del nuevo idioma.
 * variant "landing": estilo dorado de la web pública; "dashboard": panel oscuro.
 */
export function LanguageSwitcher({ variant = "landing" }: { variant?: "landing" | "dashboard" }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const choose = (next: Locale) => {
    setOpen(false);
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    document.documentElement.lang = next;
    startTransition(() => router.refresh());
  };

  const button =
    variant === "landing"
      ? "glass-panel text-gold-custom hover:border-amber-400/50 shadow-md"
      : "bg-slate-800/70 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800";
  const menu =
    variant === "landing"
      ? "glass-panel border border-amber-500/30 backdrop-blur-xl"
      : "bg-slate-900 border border-slate-700";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.common.language}
        title={t.common.language}
        className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold uppercase transition-all ${button} ${pending ? "opacity-60" : ""}`}
      >
        <Globe className="w-4 h-4" />
        <span>{locale}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t.common.language}
          className={`absolute right-0 mt-2 w-44 rounded-xl shadow-2xl py-1.5 z-[60] ${menu}`}
        >
          {LOCALES.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === locale}
                lang={code}
                onClick={() => choose(code)}
                className={`w-full px-3.5 py-2 text-left text-sm flex items-center justify-between gap-2 transition-colors ${
                  variant === "landing"
                    ? "text-main hover:bg-amber-500/10"
                    : "text-slate-200 hover:bg-slate-800"
                } ${code === locale ? "font-bold" : "font-medium"}`}
              >
                <span>{LOCALE_NAMES[code]}</span>
                {code === locale && <Check className={`w-4 h-4 ${variant === "landing" ? "text-gold-custom" : "text-blue-400"}`} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

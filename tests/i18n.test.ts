import { describe, it, expect } from "vitest";
import { LOCALES, isLocale, matchAcceptLanguage } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { es } from "@/i18n/dictionaries/es";
import { fmt } from "@/i18n/format";
import { SAAS_PLANS } from "@/modules/billing/plans";

/** Todas las hojas del diccionario: ruta → valor (string o lista de strings). */
function leaves(obj: unknown, prefix = ""): Map<string, string | string[]> {
  const out = new Map<string, string | string[]>();
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || Array.isArray(value)) out.set(path, value as string | string[]);
    else for (const [k, v] of leaves(value, path)) out.set(k, v);
  }
  return out;
}
const vars = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Idiomas de la interfaz", () => {
  it("ofrece español, inglés, francés, alemán y turco", () => {
    expect([...LOCALES].sort()).toEqual(["de", "en", "es", "fr", "tr"]);
    expect(isLocale("tr")).toBe(true);
    expect(isLocale("pt")).toBe(false);
  });

  it("detecta el idioma del navegador y cae en null si no se soporta", () => {
    expect(matchAcceptLanguage("de-DE,de;q=0.9,en;q=0.8")).toBe("de");
    expect(matchAcceptLanguage("pt-BR,pt;q=0.9,fr;q=0.5")).toBe("fr");
    expect(matchAcceptLanguage("en;q=0.3, tr-TR;q=0.9")).toBe("tr");
    expect(matchAcceptLanguage("ja,zh")).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });

  const reference = leaves(es);

  for (const locale of LOCALES) {
    describe(`diccionario ${locale}`, () => {
      const dict = leaves(getDictionary(locale));

      it("tiene exactamente las mismas claves que el español", () => {
        expect([...dict.keys()].sort()).toEqual([...reference.keys()].sort());
      });

      it("no tiene textos vacíos y las listas tienen el mismo largo", () => {
        for (const [key, value] of dict) {
          const ref = reference.get(key)!;
          if (Array.isArray(ref)) {
            expect(Array.isArray(value), key).toBe(true);
            expect((value as string[]).length, key).toBe(ref.length);
            for (const item of value as string[]) expect(item.trim(), key).not.toBe("");
          } else {
            expect(typeof value, key).toBe("string");
            expect((value as string).trim(), key).not.toBe("");
          }
        }
      });

      it("conserva las mismas variables {…} en cada texto", () => {
        for (const [key, value] of dict) {
          const ref = reference.get(key)!;
          if (typeof ref === "string") expect(vars(value as string), key).toEqual(vars(ref));
        }
      });
    });
  }

  it("las características de cada plan coinciden en número con el catálogo", () => {
    for (const locale of LOCALES) {
      const features = getDictionary(locale).billing.plans.features;
      for (const id of Object.keys(SAAS_PLANS) as (keyof typeof features)[]) {
        expect(features[id].length, `${locale}.${id}`).toBe(SAAS_PLANS[id].features.length);
      }
    }
  });

  it("fmt sustituye variables y deja intactas las desconocidas", () => {
    expect(fmt("Plan {plan} ({interval})", { plan: "Pro", interval: "mensual" })).toBe("Plan Pro (mensual)");
    expect(fmt("Hola {name}", {})).toBe("Hola {name}");
  });
});

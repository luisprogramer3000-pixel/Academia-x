import type { JsonCaller } from "../engine/planner/llm";
import type { DeckScript } from "./script";

/**
 * Segunda pasada del guionista (incluida en los créditos del guion):
 * 1. Para cada diapositiva escribe la escena de la fotografía (quién, qué hace,
 *    dónde, luz): el planificador solo da palabras sueltas ("quiz", "grammar").
 * 2. En lecturas y conceptos marca con **asteriscos** las palabras clave.
 *    El resaltado solo se acepta si, sin los asteriscos, el texto es idéntico:
 *    la IA no puede cambiar ni una letra de lo que verá el alumno.
 */

const HIGHLIGHT_TYPES = new Set(["reading", "concept", "grammar", "dialogue"]);
const plain = (s: string) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

export async function enrichScript(script: DeckScript, call: JsonCaller, ctx: { topic: string; level?: string; language: string }): Promise<DeckScript> {
  const system = [
    "Eres director de arte y diseñador instruccional de una academia de idiomas.",
    "Para cada diapositiva escribe en español la escena de UNA fotografía realista que ayude a entenderla:",
    "quién aparece (edad acorde al nivel), qué hace, dónde, y la luz. Una o dos frases concretas, sin texto visible en la foto.",
    "Las fotos de una misma presentación deben parecer de la misma serie (mismos personajes cuando tenga sentido, mismo ambiente).",
    "Además, SOLO en las diapositivas con campo \"text\" que te pida resaltar, devuelve \"highlighted\": el MISMO texto, carácter por carácter,",
    "añadiendo ** alrededor de 5 a 14 palabras o expresiones clave (verbos, horas, vocabulario, conectores). No cambies, quites ni añadas nada más.",
    'Devuelve solo JSON: { "slides": [ { "id": string, "photo": string, "highlighted"?: string } ] }',
  ].join("\n");
  const user = JSON.stringify({
    tema: ctx.topic,
    nivel: ctx.level,
    idioma: ctx.language,
    diapositivas: script.slides.map((s) => ({
      id: s.id,
      tipo: s.type,
      titulo: s.title,
      ...(HIGHLIGHT_TYPES.has(s.type) && s.text && !s.text.includes("**") ? { text: s.text, resaltar: true } : { resumen: plain(s.text).slice(0, 300) }),
      lista: s.items.slice(0, 5).map(plain),
    })),
  });

  try {
    const res = await call({ system, user });
    const out = (res.raw as { slides?: Array<{ id?: unknown; photo?: unknown; highlighted?: unknown }> } | null)?.slides;
    if (!Array.isArray(out)) return script;
    const byId = new Map(out.filter((o) => typeof o?.id === "string").map((o) => [o.id as string, o]));
    return {
      ...script,
      slides: script.slides.map((s) => {
        const o = byId.get(s.id);
        if (!o) return s;
        const photo = typeof o.photo === "string" && o.photo.trim().length > 15 ? o.photo.trim().slice(0, 700) : s.imagePrompt;
        const highlighted =
          typeof o.highlighted === "string" && HIGHLIGHT_TYPES.has(s.type) && !s.text.includes("**") && plain(o.highlighted) === plain(s.text) && o.highlighted.includes("**") &&
          o.highlighted.split(/\n+/).length === s.text.split(/\n+/).length
            ? o.highlighted.slice(0, 1600)
            : s.text;
        return { ...s, imagePrompt: photo, text: highlighted };
      }),
    };
  } catch (error) {
    console.warn("[photo-deck] No se pudieron describir las fotos:", error);
    return script;
  }
}

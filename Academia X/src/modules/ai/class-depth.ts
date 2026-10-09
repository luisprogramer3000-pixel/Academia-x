import type { ClassPlanMaterial, ClassPlanOutput, ClassPlanParams } from "./class-plan.schema";
import { normalizeMaterial } from "./class-plan.schema";
import { SELF_CONTAINED_RULE, type JsonAsk } from "./exercise-integrity";

/**
 * Profundidad mínima de una clase según el nivel. Un B2 no puede llevar la
 * teoría de un A1: más conceptos, explicaciones largas con matices y
 * excepciones, más ejemplos y más ejercicios. Si la IA entrega menos, la
 * teoría se reescribe en una llamada dedicada y los ejercicios se completan.
 */

export type LevelBand = "basic" | "intermediate" | "advanced";

export interface DepthTarget {
  band: LevelBand;
  /** Secciones de teoría (conceptos) */
  theorySections: number;
  /** Palabras medias por sección de teoría */
  wordsPerSection: number;
  /** Ejemplos por concepto */
  examplesPerConcept: number;
  /** Ejercicios del material de práctica */
  exercises: number;
}

export function levelBand(levelOrGrade: string): LevelBand {
  const t = (levelOrGrade || "").toUpperCase();
  if (/\b(B2|C1|C2)\b|AVANZAD|UNIVERSI|SUPERIOR|BACHILLER|PROFESIONAL/.test(t)) return "advanced";
  if (/\bB1\b|INTERMED|SECUNDARIA|ESO\b/.test(t)) return "intermediate";
  return "basic";
}

export function depthTarget(levelOrGrade: string): DepthTarget {
  switch (levelBand(levelOrGrade)) {
    case "advanced":
      return { band: "advanced", theorySections: 7, wordsPerSection: 150, examplesPerConcept: 5, exercises: 15 };
    case "intermediate":
      return { band: "intermediate", theorySections: 6, wordsPerSection: 110, examplesPerConcept: 4, exercises: 12 };
    default:
      return { band: "basic", theorySections: 5, wordsPerSection: 70, examplesPerConcept: 3, exercises: 10 };
  }
}

/** Reglas de profundidad que se añaden a las instrucciones del plan de clase. */
export function depthRules(levelOrGrade: string): string {
  const d = depthTarget(levelOrGrade);
  const advanced = d.band === "advanced"
    ? " Nivel avanzado: trata matices, excepciones, contrastes entre estructuras parecidas, registro (formal/informal), conectores y usos en textos auténticos; la teoría debe tener la densidad de un manual profesional de preparación."
    : "";
  return `PROFUNDIDAD OBLIGATORIA PARA ESTE NIVEL: la teoría (m2) tiene al menos ${d.theorySections} secciones de unas ${d.wordsPerSection} palabras o más cada una, con al menos ${d.examplesPerConcept} ejemplos contextualizados por concepto; los ejercicios (m4) son al menos ${d.exercises}.${advanced}`;
}

const words = (s: string) => (s.match(/\S+/g) ?? []).length;

export function measureTheory(m: ClassPlanMaterial | undefined) {
  if (!m) return { sections: 0, avgWords: 0 };
  const sections = m.sections.filter((s) => !/^resumen$/i.test(s.heading.trim()));
  const total = sections.reduce((acc, s) => acc + words(s.body) + words(s.bullets.join(" ")), 0);
  return { sections: sections.length, avgWords: sections.length ? Math.round(total / sections.length) : 0 };
}

/**
 * Si la teoría quedó corta para el nivel, la reescribe con profundidad en una
 * llamada dedicada (todo el presupuesto de salida para la teoría). Devuelve
 * true si la sustituyó.
 */
export async function deepenTheoryIfThin(plan: ClassPlanOutput, p: ClassPlanParams & { research?: string }, ask: JsonAsk): Promise<boolean> {
  const target = depthTarget(p.grade);
  const theory = plan.materials.find((m) => m.kind === "resumen");
  const now = measureTheory(theory);
  if (now.sections >= target.theorySections && now.avgWords >= target.wordsPerSection * 0.8) return false;

  const system = [
    `Eres autor de manuales profesionales de ${p.subject}. Escribe la TEORÍA COMPLETA de la clase «${p.topic}» para el nivel ${p.grade}, en ${p.language}.`,
    p.research ? `Basa el contenido en este MARCO DE REFERENCIA INVESTIGADO (no inventes datos fuera de él):\n${p.research.slice(0, 5000)}` : "",
    depthRules(p.grade),
    "Cada sección (un concepto): explicación clara y completa, la regla o estructura (tabla en pipes si hay formas), matices y excepciones, ejemplos en oraciones completas y contextualizadas, y errores típicos con su corrección. Formato: párrafos separados por línea en blanco, \"### \" subtítulos, \"- \" listas, **negrita** para lo clave, recuadros \"💡 Consejo:\" / \"⚠️ Atención:\" / \"📌 Recuerda:\".",
    "Cierra con una sección \"Resumen\". En \"questions\" pon UN ejercicio por concepto (sin contar el resumen), en el mismo orden, que lo aplique en un contexto nuevo, con respuesta y explicación.",
    SELF_CONTAINED_RULE,
    'Devuelve solo JSON: { "title": string, "description": string, "sections": [{ "heading": string, "body": string, "bullets": string[] }], "questions": [{ "prompt": string, "difficulty": "Fácil"|"Medio"|"Difícil", "options": string[], "correctIndex": number, "answer": string, "explanation": string }] }',
  ].filter(Boolean).join("\n\n");
  try {
    const raw = (await ask(system, `Escribe la teoría de «${p.topic}» (${p.grade}).`)) as Record<string, unknown> | null;
    if (!raw) return false;
    const fresh = normalizeMaterial({ ...raw, kind: "resumen", id: theory?.id ?? "m2" }, 1, "resumen");
    const after = measureTheory(fresh);
    // Solo se sustituye si de verdad es más completa
    if (after.sections < Math.min(target.theorySections, now.sections + 1) && after.avgWords <= now.avgWords) return false;
    if (theory) {
      Object.assign(theory, { title: fresh.title || theory.title, description: fresh.description || theory.description, sections: fresh.sections, questions: fresh.questions });
    } else {
      plan.materials.push(fresh);
    }
    console.info(JSON.stringify({ scope: "class-depth", topic: p.topic, level: p.grade, before: now, after }));
    return true;
  } catch (error) {
    console.warn("[class-depth] No se pudo profundizar la teoría:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Bloques de una lección. Código compartido (sin "use client"): lo usan tanto
 * las páginas del servidor como el lector de lecciones del navegador.
 */

export interface LessonBlock {
  id: string;
  type: string;
  title?: string;
  content?: string;
  url?: string;
  question?: string;
  options?: string[];
  /** Solo presente en la vista del profesor (al alumno se le quitan) */
  correctOptionIndex?: number;
  explanation?: string;
  /** Capítulo: etiqueta y emoji del tipo de material */
  label?: string;
  emoji?: string;
  difficulty?: string;
  /** Ejercicio abierto: respuesta modelo */
  answer?: string;
  cards?: Array<{ front: string; back: string }>;
  /** Diálogo tipo libro de idiomas */
  lines?: Array<{ speaker: string; text: string; translation?: string }>;
  mindMap?: { center: string; branches: Array<{ label: string; children: string[] }> };
}

export function parseLessonBlocks(contentJson?: string | null): LessonBlock[] {
  if (!contentJson) return [];
  try {
    const parsed = JSON.parse(contentJson);
    const blocks = Array.isArray(parsed.blocks) ? parsed.blocks : Array.isArray(parsed) ? parsed : [];
    return blocks.map((b: LessonBlock, i: number) => ({ ...b, id: String(b.id ?? `b${i}`) }));
  } catch {
    return [{ id: "b_fallback", type: "text", content: contentJson }];
  }
}

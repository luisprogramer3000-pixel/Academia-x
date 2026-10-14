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
  /** Tamaño de la imagen de una sección de texto: "auto" lo decide según el espacio */
  imageSize?: ImageSize;
}

export type ImageSize = "auto" | "small" | "medium" | "large" | "full";

/** Direcciones de imágenes subidas que quedaron pegadas dentro del texto (al arrastrar una imagen al cuadro). */
const STRAY_UPLOAD_URL = /https?:\/\/\S*?\/api\/uploads\/\S+?\.(?:png|jpe?g|webp|gif|avif)/gi;

export function stripStrayImageUrls(text: string): string {
  return text.replace(STRAY_UPLOAD_URL, "");
}

/** Títulos con marcas de Markdown ("### Partes del cuerpo") se muestran limpios. */
export function cleanTitle(title?: string): string {
  return (title ?? "").replace(/^\s*#{1,6}\s*/, "").replace(/\*\*/g, "").trim();
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

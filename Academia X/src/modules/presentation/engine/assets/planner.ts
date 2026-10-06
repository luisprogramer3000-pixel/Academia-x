import type { PresentationPlan, VisualAssetRequest } from "../types";
import { normalize } from "../text";

/**
 * VisualAssetPlanner: antes de buscar o generar imágenes decide exactamente
 * cuáles hacen falta. Agrupa peticiones iguales, reserva las imágenes de la
 * lección para su uso principal (concepto/ejemplo/portada) y elige qué
 * peticiones merecen una imagen generada si el profesor pidió alguna.
 */

export interface AssetPlan {
  /** URLs de la lección reservadas para un uso principal: el vocabulario no las "gasta" */
  reservedUrls: Set<string>;
  /** Consultas que se generarán con IA (por orden de prioridad) */
  toGenerate: VisualAssetRequest[];
  /** Consultas importantes sin imagen de la lección (candidatas a la biblioteca) */
  toSearch: VisualAssetRequest[];
}

const PRIMARY = new Set<VisualAssetRequest["purpose"]>(["hero", "concept", "example"]);

/** Prioridad de generación: portada, lectura, vocabulario, ejemplos, conceptos, actividades. */
const PURPOSE_PRIORITY: Record<VisualAssetRequest["purpose"], number> = { hero: 1, vocabulary: 0.85, example: 0.8, concept: 0.75, activity: 0.6, decoration: 0 };

export function planAssets(plan: PresentationPlan, generateBudget: number): AssetPlan {
  const requests = plan.slides.flatMap((s) => s.visualAssetRequests);
  const reservedUrls = new Set(requests.filter((r) => r.preferredUrl && PRIMARY.has(r.purpose)).map((r) => r.preferredUrl!));

  const seen = new Set<string>();
  const missing: VisualAssetRequest[] = [];
  for (const r of requests) {
    if (r.preferredUrl || r.purpose === "decoration") continue;
    const key = normalize(r.semanticQuery);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    missing.push(r);
  }
  missing.sort((a, b) => Math.max(b.importance, PURPOSE_PRIORITY[b.purpose]) - Math.max(a.importance, PURPOSE_PRIORITY[a.purpose]));
  return {
    reservedUrls,
    toGenerate: missing.slice(0, Math.max(0, generateBudget)),
    toSearch: missing.slice(Math.max(0, generateBudget), Math.max(0, generateBudget) + 4),
  };
}

/** Instrucción para el generador: fotografía realista (como los materiales profesionales del profesor). */
export function generationPrompt(r: VisualAssetRequest, style: { imageStyle: string; tone: string; language: string }): string {
  const object = r.purpose === "vocabulary";
  const look = style.imageStyle.startsWith("illustration") && style.tone === "kids"
    ? "Ilustración infantil colorida y detallada, aspecto de libro de texto profesional"
    : "Fotografía realista de alta calidad, luz natural, nítida, colores vivos, estilo de libro de texto moderno";
  const framing = object
    ? "Un único objeto o ser, completo y centrado, sobre fondo limpio y claro"
    : r.purpose === "hero" ? "Escena amplia y atractiva, personas reales y diversas cuando corresponda"
    : "Escena concreta que muestre exactamente la situación descrita";
  return `${r.semanticQuery}. ${look}. ${framing}. Sin texto, letras, números ni marcas de agua en la imagen.`;
}

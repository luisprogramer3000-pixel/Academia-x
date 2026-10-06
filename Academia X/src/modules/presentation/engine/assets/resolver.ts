import type { ResolvedAsset, ResolvedImage, SlidePlan, VisualAssetRequest } from "../types";
import { emojiFor, ROLE_EMOJI } from "../icons";
import { normalize } from "../text";
import type { AssetPlan } from "./planner";

/**
 * AssetResolver: resuelve cada petición visual con esta cadena de respaldo
 *
 *   imagen de la lección → imagen generada → biblioteca → icono (emoji) → nada (layout de texto)
 *
 * y evita repetir la misma ilustración: cada imagen se usa una sola vez
 * (las reservadas para un concepto no se gastan en el vocabulario).
 * Un fallo de carga nunca cancela la presentación: se pasa al siguiente respaldo.
 */

export interface AssetSources {
  /** Carga una imagen por URL (subida a la plataforma o https) */
  load: (url: string) => Promise<ResolvedImage | null>;
  /** Imágenes generadas con IA por consulta (normalizada) → URL */
  generated?: Map<string, string>;
  /** Búsqueda en la biblioteca de la plataforma */
  searchLibrary?: (query: string) => Promise<ResolvedImage | null>;
}

export class AssetResolver {
  private cache = new Map<string, Promise<ResolvedImage | null>>();
  private used = new Set<string>();
  private libraryHits = new Map<string, ResolvedImage | null>();

  constructor(private readonly sources: AssetSources, private readonly plan: AssetPlan) {}

  private load(url: string): Promise<ResolvedImage | null> {
    if (!this.cache.has(url)) this.cache.set(url, this.sources.load(url).catch(() => null));
    return this.cache.get(url)!;
  }

  /** Precarga en paralelo las imágenes que se van a usar. */
  async warm(urls: string[]): Promise<void> {
    await Promise.all([...new Set(urls)].map((u) => this.load(u)));
  }

  async prefetchLibrary(requests: VisualAssetRequest[]): Promise<void> {
    if (!this.sources.searchLibrary) return;
    await Promise.all(requests.map(async (r) => {
      const key = normalize(r.semanticQuery);
      if (this.libraryHits.has(key)) return;
      this.libraryHits.set(key, await this.sources.searchLibrary!(r.semanticQuery).catch(() => null));
    }));
  }

  private emoji(r: VisualAssetRequest, slide: SlidePlan): { emoji: string; relevance: number } {
    const specific = r.emoji ?? emojiFor(r.semanticQuery);
    if (specific) return { emoji: specific, relevance: 0.65 };
    return { emoji: ROLE_EMOJI[slide.pedagogicalRole] ?? "💡", relevance: 0.4 };
  }

  private take(url: string, purpose: VisualAssetRequest["purpose"]): boolean {
    if (this.used.has(url)) return false;
    if (purpose === "vocabulary" && this.plan.reservedUrls.has(url)) return false;
    this.used.add(url);
    return true;
  }

  async resolve(slide: SlidePlan): Promise<ResolvedAsset[]> {
    const out: ResolvedAsset[] = [];
    for (const r of slide.visualAssetRequests) {
      out.push(await this.resolveOne(r, slide));
    }
    return out;
  }

  /** Libera las imágenes de una diapositiva (si la autocorrección la descarta). */
  release(assets: ResolvedAsset[]): void {
    for (const a of assets) if (a.source === "lesson" && a.request.preferredUrl) this.used.delete(a.request.preferredUrl);
  }

  private async resolveOne(r: VisualAssetRequest, slide: SlidePlan): Promise<ResolvedAsset> {
    // 1. Imagen de la lección
    if (r.preferredUrl && !this.used.has(r.preferredUrl) && !(r.purpose === "vocabulary" && this.plan.reservedUrls.has(r.preferredUrl))) {
      const img = await this.load(r.preferredUrl);
      if (img && this.take(r.preferredUrl, r.purpose)) return { request: r, kind: "image", image: img, source: "lesson", relevance: 0.95 };
    }
    // 2. Generada con IA para esta consulta
    const key = normalize(r.semanticQuery);
    const genUrl = this.sources.generated?.get(key);
    if (genUrl && !this.used.has(genUrl)) {
      const img = await this.load(genUrl);
      if (img && this.take(genUrl, r.purpose)) return { request: r, kind: "image", image: img, source: "generated", relevance: 0.9 };
    }
    // 3. Biblioteca de la plataforma (solo lo precargado: sin búsquedas sueltas por diapositiva)
    const lib = this.libraryHits.get(key);
    if (lib && !this.used.has(`lib:${key}`)) {
      this.used.add(`lib:${key}`);
      return { request: r, kind: "image", image: lib, source: "library", relevance: 0.7 };
    }
    // 4. Icono
    const e = this.emoji(r, slide);
    return { request: r, kind: "emoji", emoji: e.emoji, source: "icon", relevance: e.relevance };
  }
}

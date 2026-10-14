import type { ResolvedImage } from "./types";
import { loadLessonImage, lessonImageFromBytes } from "../presentation.images";
import { isMongoConfigured } from "@/lib/mongo";
import { openLibraryFile } from "@/lib/storage";
import { IMAGE_TYPES } from "@/lib/upload-types";

/**
 * Fuentes de imágenes del servidor para el motor (AssetResolver): imágenes de
 * la lección, Biblioteca de la plataforma y generación con IA. Reutilizan los
 * servicios existentes (Storage, MongoDB, fal.ai con cobro por imagen).
 */

export async function loadImage(url: string): Promise<ResolvedImage | null> {
  const img = await loadLessonImage(url);
  return img ? { data: img.data, mime: img.mime, width: img.width, height: img.height } : null;
}

const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T) =>
  Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

/** Busca en la Biblioteca de la plataforma una imagen publicada que encaje con la consulta. */
export function librarySearch(viewerUserId: string) {
  if (!isMongoConfigured()) return undefined;
  return async (query: string): Promise<ResolvedImage | null> =>
    withTimeout(
      (async () => {
        const { LibraryService } = await import("@/modules/library/library.service");
        const { items } = await LibraryService.list({ userId: viewerUserId }, { q: query, mimeTypes: Object.keys(IMAGE_TYPES) });
        const hit = items[0];
        if (!hit) return null;
        const doc = await LibraryService.get(hit.id);
        if (!doc || doc.size > 8 * 1024 * 1024) return null;
        const file = await openLibraryFile(doc.storageKey);
        if (!file) return null;
        const img = lessonImageFromBytes(new Uint8Array(await new Response(file.body).arrayBuffer()));
        return img ? { data: img.data, mime: img.mime, width: img.width, height: img.height } : null;
      })().catch(() => null),
      4000,
      null
    );
}

/** Genera ilustraciones con IA (créditos por imagen, devueltos si falla) y devuelve consulta → URL. */
export function imageGenerator(input: { tenantId: string; userId?: string; idempotencyKey?: string; quality?: "standard" | "hq" }) {
  return async (requests: Array<{ key: string; prompt: string }>): Promise<Map<string, string>> => {
    const { AIService } = await import("@/modules/ai/ai.service");
    const items = requests.map((r) => ({ key: r.key, imagePrompt: r.prompt, imageUrl: undefined as string | undefined }));
    // 4 lotes en paralelo: 20 fotos tardan lo que tardan 5 (cada imagen se cobra y se devuelve si falla)
    const lanes = 4;
    const batches = Array.from({ length: lanes }, (_, l) => items.filter((_, i) => i % lanes === l)).filter((b) => b.length);
    const results = await Promise.all(batches.map((batch, l) =>
      AIService.attachPromptImages(batch, {
        tenantId: input.tenantId,
        userId: input.userId,
        count: batch.length,
        quality: input.quality ?? "standard",
        idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}-lane${l}` : undefined,
        styleSuffix: "",
      }).catch((error) => ({ imagesGenerated: 0, imageErrors: [error instanceof Error ? error.message : String(error)] }))
    ));
    const errors = results.flatMap((r) => r.imageErrors);
    if (errors.length) console.warn("[presentation-v2] Imágenes:", errors);
    return new Map(items.filter((i) => i.imageUrl).map((i) => [i.key, i.imageUrl!]));
  };
}

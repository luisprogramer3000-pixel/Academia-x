import path from "path";
import { readFile } from "fs/promises";
import { UPLOADS_ROOT } from "@/lib/uploads";
import { safeFetch } from "./presentation.template";

/**
 * Imágenes de la lección para la presentación: las subidas/generadas en la
 * plataforma (/api/uploads/...) se leen del disco; los enlaces externos se
 * descargan con las mismas protecciones que los modelos web.
 * PowerPoint y el PDF solo admiten PNG y JPG: otros formatos se omiten.
 */

export interface LessonImage {
  data: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function dimensions(b: Uint8Array): { mime: LessonImage["mime"]; width: number; height: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { mime: "image/png", width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    // Recorre los segmentos hasta el marcador SOF, que lleva alto y ancho
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mime: "image/jpeg", height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}

async function readLocalUpload(url: string): Promise<Uint8Array | null> {
  const rel = decodeURIComponent(url.replace(/^\/api\/uploads\//, "").split("?")[0]);
  const full = path.resolve(UPLOADS_ROOT, rel);
  // Solo archivos dentro de la carpeta de subidas
  if (!full.startsWith(path.resolve(UPLOADS_ROOT) + path.sep)) return null;
  try {
    return new Uint8Array(await readFile(full));
  } catch {
    return null;
  }
}

export function lessonImageFromBytes(bytes: Uint8Array): LessonImage | null {
  const dim = dimensions(bytes);
  return dim && dim.width && dim.height ? { data: bytes, ...dim } : null;
}

export async function loadLessonImage(url: string): Promise<LessonImage | null> {
  try {
    let bytes: Uint8Array | null = null;
    if (url.startsWith("/api/uploads/")) bytes = await readLocalUpload(url);
    else if (/^https:\/\//i.test(url)) bytes = (await safeFetch(url)).bytes;
    if (!bytes || bytes.length > MAX_IMAGE_BYTES) return null;
    const dim = dimensions(bytes);
    if (!dim || !dim.width || !dim.height) return null;
    return { data: bytes, ...dim };
  } catch {
    return null;
  }
}

/** Carga (en paralelo y sin repetir) todas las imágenes que usa el guion. */
export async function loadDeckImages(urls: Array<string | undefined>): Promise<Map<string, LessonImage>> {
  const unique = [...new Set(urls.filter((u): u is string => Boolean(u)))].slice(0, 30);
  const loaded = await Promise.all(unique.map(async (u) => [u, await loadLessonImage(u)] as const));
  return new Map(loaded.filter((e): e is readonly [string, LessonImage] => e[1] !== null));
}

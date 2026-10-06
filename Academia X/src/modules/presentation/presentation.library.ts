import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { loadPptxTemplate, type PptxTemplate } from "./pptx-template";

/**
 * Biblioteca de modelos de PowerPoint de la plataforma: los .pptx que haya en
 * public/modelos powerpoint. Para añadir un modelo basta con copiar el archivo
 * en esa carpeta. Cada modelo se analiza una vez y queda en memoria.
 */

const DIR = path.join(process.cwd(), "public", "modelos powerpoint");

export interface LibraryModel {
  id: string;
  name: string;
  file: string;
}

const cache = new Map<string, { mtime: number; template: PptxTemplate }>();

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\.pptx$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const prettyName = (file: string) => {
  const base = file.replace(/\.pptx$/i, "").replace(/[_-]+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
};

export async function listLibraryModels(): Promise<LibraryModel[]> {
  let files: string[] = [];
  try {
    files = (await readdir(DIR)).filter((f) => f.toLowerCase().endsWith(".pptx") && !f.startsWith("~$"));
  } catch {
    return [];
  }
  return files.sort((a, b) => a.localeCompare(b)).map((file) => ({ id: slug(file), name: prettyName(file), file }));
}

const PREVIEW_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/**
 * Miniatura del modelo. Canva guarda dentro del .pptx una miniatura en blanco,
 * así que se usa, por orden: una imagen con el mismo nombre junto al archivo
 * (p. ej. "negocios.png"), o la miniatura interna si no es un relleno vacío.
 */
/** Versión de la miniatura (fecha de modificación): cambia la URL para que el navegador no use una copia vieja. */
export async function getLibraryPreviewVersion(model: LibraryModel): Promise<number> {
  const base = model.file.replace(/\.pptx$/i, "");
  for (const ext of Object.keys(PREVIEW_TYPES)) {
    try {
      return Math.round((await stat(path.join(DIR, base + ext))).mtimeMs);
    } catch {
      // sin imagen con esa extensión
    }
  }
  return Math.round((await stat(path.join(DIR, model.file))).mtimeMs);
}

export async function getLibraryPreview(id: string): Promise<{ data: Uint8Array; mime: string } | null> {
  const model = (await listLibraryModels()).find((m) => m.id === id);
  if (!model) return null;
  const base = model.file.replace(/\.pptx$/i, "");
  for (const [ext, mime] of Object.entries(PREVIEW_TYPES)) {
    try {
      return { data: new Uint8Array(await readFile(path.join(DIR, base + ext))), mime };
    } catch {
      // no hay imagen con esa extensión
    }
  }
  const template = await getLibraryTemplate(id).catch(() => null);
  // Las miniaturas vacías de Canva pesan ~2 KB
  if (template?.thumbnail && template.thumbnail.length > 6000) return { data: template.thumbnail, mime: "image/jpeg" };
  return null;
}

/** Bytes del .pptx del modelo (motor v2: su ADN se analiza una vez y se cachea por hash). */
export async function getLibraryModelBytes(id: string): Promise<Uint8Array | null> {
  const model = (await listLibraryModels()).find((m) => m.id === id);
  if (!model) return null;
  return new Uint8Array(await readFile(path.join(DIR, model.file)));
}

export async function getLibraryTemplate(id: string): Promise<PptxTemplate | null> {
  const model = (await listLibraryModels()).find((m) => m.id === id);
  if (!model) return null;
  const full = path.join(DIR, model.file);
  const { mtimeMs } = await stat(full);
  const cached = cache.get(id);
  if (cached && cached.mtime === mtimeMs) return cached.template;
  const template = await loadPptxTemplate(new Uint8Array(await readFile(full)));
  cache.set(id, { mtime: mtimeMs, template });
  return template;
}

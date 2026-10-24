import path from "path";

/**
 * Almacenamiento de archivos subidos (logos, materiales, imágenes de clase,
 * comprobantes de pago) y de las presentaciones generadas en segundo plano.
 *
 * - "supabase": Supabase Storage, bucket PRIVADO, ruta tenants/{tenantId}/{carpeta}/{archivo}.
 *   Sobrevive a los redespliegues y a varios servidores. Requiere
 *   SUPABASE_SERVICE_ROLE_KEY (clave secreta: solo en el servidor, nunca NEXT_PUBLIC).
 * - "local": disco del servidor (UPLOADS_DIR). Para desarrollo sin conexión.
 *
 * La URL guardada en base de datos es siempre /api/uploads/{carpeta}/{archivo},
 * sea cual sea el almacenamiento: esa ruta comprueba permisos y entrega el
 * archivo. El navegador nunca habla con el bucket directamente.
 */

export const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

/** Carpetas que existen. Cualquier otra se rechaza. */
export const UPLOAD_FOLDERS = ["logos", "materials", "class-images", "payment-proofs", "presentations"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

const FILE_NAME = /^[A-Za-z0-9._-]+$/;

export function isUploadFolder(value: string): value is UploadFolder {
  return (UPLOAD_FOLDERS as readonly string[]).includes(value);
}

/** Nombres generados por el servidor: prefijo-tenantId-aleatorio.ext */
export function isSafeFileName(name: string): boolean {
  return FILE_NAME.test(name) && !name.includes("..");
}

/** El tenant va codificado en el nombre del archivo (prefijo-tenantId-hex.ext). */
export function tenantOfFile(fileName: string): string | null {
  const id = fileName.split("-")[1];
  return id && /^[a-z0-9]+$/i.test(id) ? id : null;
}

export function publicUploadUrl(folder: UploadFolder, fileName: string): string {
  return `/api/uploads/${folder}/${fileName}`;
}

/** /api/uploads/{carpeta}/{archivo} → partes validadas, o null. */
export function parseUploadUrl(url: string): { folder: UploadFolder; fileName: string } | null {
  const m = url.split("?")[0].match(/^\/api\/uploads\/([^/]+)\/([^/]+)$/);
  if (!m) return null;
  const folder = m[1];
  const fileName = decodeURIComponent(m[2]);
  return isUploadFolder(folder) && isSafeFileName(fileName) ? { folder, fileName } : null;
}

// ─── Configuración ───────────────────────────────────────────────────────────

interface SupabaseStorageConfig {
  url: string;
  key: string;
  bucket: string;
}

function supabaseConfig(): SupabaseStorageConfig | null {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  return { url, key, bucket: process.env.SUPABASE_STORAGE_BUCKET || "uploads" };
}

export function storageDriver(): "supabase" | "local" {
  const forced = (process.env.STORAGE_DRIVER || "").toLowerCase();
  if (forced === "local") return "local";
  if (forced === "supabase" && !supabaseConfig()) {
    throw new Error("STORAGE_DRIVER=supabase pero faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  return supabaseConfig() ? "supabase" : "local";
}

/** Cabeceras de la API de Storage: las claves nuevas (sb_secret_...) van en "apikey"; las JWT antiguas también como Bearer. */
function authHeaders(key: string): Record<string, string> {
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

export function objectPath(folder: UploadFolder, fileName: string): string {
  const tenantId = tenantOfFile(fileName);
  if (!tenantId) throw new Error(`Nombre de archivo sin academia: ${fileName}`);
  return `tenants/${tenantId}/${folder}/${fileName}`;
}

const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

// ─── Operaciones ─────────────────────────────────────────────────────────────

/** Guarda un archivo y devuelve su URL pública (/api/uploads/...). */
export async function putUpload(folder: UploadFolder, fileName: string, bytes: Uint8Array, contentType: string): Promise<string> {
  if (!isSafeFileName(fileName)) throw new Error("Nombre de archivo no válido.");

  if (storageDriver() === "supabase") {
    const cfg = supabaseConfig()!;
    const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/${encodePath(objectPath(folder, fileName))}`, {
      method: "POST",
      headers: { ...authHeaders(cfg.key), "Content-Type": contentType, "x-upsert": "false", "cache-control": "31536000" },
      body: Buffer.from(bytes),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      throw new Error(`No se pudo guardar el archivo en Supabase Storage (${res.status}): ${detail}`);
    }
  } else {
    const { mkdir, writeFile } = await import("fs/promises");
    const dir = path.join(UPLOADS_ROOT, folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), bytes);
  }
  return publicUploadUrl(folder, fileName);
}

/**
 * Abre un archivo para entregarlo (ruta /api/uploads). Devuelve el cuerpo como
 * stream sin cargarlo entero en memoria, o null si no existe.
 *
 * `range` ("bytes=inicio-fin"): solo ese trozo (audio y video, para poder
 * adelantar; Safari no reproduce video sin esto). Devuelve entonces contentRange.
 */
export async function openUpload(
  folder: UploadFolder,
  fileName: string,
  range?: string | null
): Promise<{ body: ReadableStream; size: number | null; contentRange?: string } | null> {
  if (!isSafeFileName(fileName)) return null;
  const wantedRange = range && /^bytes=\d*-\d*$/.test(range) && range !== "bytes=-" ? range : null;

  if (storageDriver() === "supabase") {
    const cfg = supabaseConfig()!;
    const res = await fetch(`${cfg.url}/storage/v1/object/authenticated/${cfg.bucket}/${encodePath(objectPath(folder, fileName))}`, {
      headers: { ...authHeaders(cfg.key), ...(wantedRange ? { Range: wantedRange } : {}) },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok || !res.body) return null;
    const length = Number(res.headers.get("content-length"));
    const contentRange = res.status === 206 ? res.headers.get("content-range") ?? undefined : undefined;
    return { body: res.body, size: Number.isFinite(length) && length > 0 ? length : null, contentRange };
  }

  const { stat } = await import("fs/promises");
  const { createReadStream } = await import("fs");
  const { Readable } = await import("stream");
  const filePath = path.join(UPLOADS_ROOT, folder, fileName);
  if (!path.resolve(filePath).startsWith(path.resolve(UPLOADS_ROOT) + path.sep)) return null;
  try {
    const s = await stat(filePath);
    if (!s.isFile()) return null;
    const m = wantedRange?.match(/^bytes=(\d*)-(\d*)$/);
    if (m && s.size > 0) {
      // "bytes=500-" (desde 500), "bytes=-500" (los últimos 500), "bytes=0-99"
      const start = m[1] ? Number(m[1]) : Math.max(0, s.size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), s.size - 1) : s.size - 1;
      if (start <= end && start < s.size) {
        return {
          body: Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream,
          size: end - start + 1,
          contentRange: `bytes ${start}-${end}/${s.size}`,
        };
      }
    }
    // Stream web (como el de Supabase): mismo tipo para la ruta y para readUpload
    return { body: Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream, size: s.size };
  } catch {
    return null;
  }
}

/** Lee un archivo completo en memoria (para incrustarlo en PDF o PowerPoint). */
export async function readUpload(folder: UploadFolder, fileName: string, maxBytes: number): Promise<Uint8Array | null> {
  const opened = await openUpload(folder, fileName);
  if (!opened || (opened.size !== null && opened.size > maxBytes)) {
    await opened?.body.cancel().catch(() => undefined);
    return null;
  }
  const bytes = new Uint8Array(await new Response(opened.body).arrayBuffer());
  return bytes.length > maxBytes ? null : bytes;
}

/**
 * Enlace firmado para que el NAVEGADOR suba un archivo directo al bucket, sin
 * pasar por el servidor. Solo vale para esa ruta exacta (el nombre lo genera el
 * servidor) y caduca a las 2 horas. Requiere Supabase Storage.
 */
export async function createSignedUpload(folder: UploadFolder, fileName: string): Promise<{ uploadUrl: string; fileUrl: string }> {
  const cfg = supabaseConfig();
  if (!cfg || storageDriver() !== "supabase") throw new Error("La subida directa requiere Supabase Storage.");
  if (!isSafeFileName(fileName)) throw new Error("Nombre de archivo no válido.");
  const res = await fetch(`${cfg.url}/storage/v1/object/upload/sign/${cfg.bucket}/${encodePath(objectPath(folder, fileName))}`, {
    method: "POST",
    headers: { ...authHeaders(cfg.key), "x-upsert": "false" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`No se pudo preparar la subida (${res.status}).`);
  const { url } = (await res.json()) as { url?: string };
  if (!url) throw new Error("Supabase no devolvió el enlace de subida.");
  return { uploadUrl: `${cfg.url}/storage/v1${url}`, fileUrl: publicUploadUrl(folder, fileName) };
}

/** Máximo por archivo en el bucket (50 MB: el máximo por archivo del plan gratuito de Supabase). */
const BUCKET_FILE_LIMIT = 50 * 1024 * 1024;

/** Crea el bucket privado si no existe y ajusta su límite (lo usa el script de configuración). */
export async function ensureBucket(): Promise<"creado" | "ya existía"> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  const headers = { ...authHeaders(cfg.key), "Content-Type": "application/json" };
  const settings = { public: false, file_size_limit: BUCKET_FILE_LIMIT };

  const existing = await fetch(`${cfg.url}/storage/v1/bucket/${cfg.bucket}`, { headers: authHeaders(cfg.key) });
  if (existing.ok) {
    const info = (await existing.json()) as { public?: boolean; file_size_limit?: number | null };
    if (info.public) throw new Error(`El bucket "${cfg.bucket}" es PÚBLICO: debe ser privado. Cámbialo en Supabase → Storage.`);
    if (info.file_size_limit !== BUCKET_FILE_LIMIT) {
      const upd = await fetch(`${cfg.url}/storage/v1/bucket/${cfg.bucket}`, { method: "PUT", headers, body: JSON.stringify(settings) });
      if (!upd.ok) throw new Error(`No se pudo ajustar el límite del bucket (${upd.status}): ${(await upd.text()).slice(0, 200)}`);
    }
    return "ya existía";
  }
  const res = await fetch(`${cfg.url}/storage/v1/bucket`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: cfg.bucket, name: cfg.bucket, ...settings }),
  });
  if (!res.ok) throw new Error(`No se pudo crear el bucket (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return "creado";
}

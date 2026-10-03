import path from "path";

/**
 * Carpeta física donde se guardan los archivos subidos (logos y materiales).
 *
 * En hosting gestionado (Hostinger Web App) conviene apuntarla FUERA del
 * directorio del proyecto, porque cada redespliegue lo reemplaza y se llevaría
 * los archivos de los clientes. Ejemplo: UPLOADS_DIR="/home/uXXXXXXX/uploads".
 *
 * Los archivos NO se sirven desde public/: los publica /api/uploads/[...path],
 * que funciona igual en cualquier hosting.
 */
export const UPLOADS_ROOT = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");

/** Ruta pública de un archivo subido, tal como se guarda en base de datos. */
export function publicUploadUrl(folder: string, fileName: string): string {
  return `/api/uploads/${folder}/${fileName}`;
}

/**
 * Guarda una imagen generada por IA y devuelve su URL pública.
 * Vive junto al resto de subidas para que comparta carpeta persistente y la
 * misma ruta de servicio (/api/uploads/...).
 */
export async function saveGeneratedImage(
  tenantId: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const { mkdir, writeFile } = await import("fs/promises");
  const crypto = await import("crypto");

  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
  const fileName = `ai-${tenantId}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  // Carpeta propia y pública: son ilustraciones de apoyo, y la vista previa
  // pública del curso (primera lección) debe poder mostrarlas a un visitante
  // sin sesión. El material privado del curso sigue en "materials".
  const folder = "class-images";

  const dir = path.join(UPLOADS_ROOT, folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);

  return publicUploadUrl(folder, fileName);
}

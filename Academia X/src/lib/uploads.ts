import crypto from "crypto";
import { putUpload } from "@/lib/storage";

/**
 * Los archivos subidos se guardan con src/lib/storage.ts (Supabase Storage o
 * disco local) y se sirven siempre por /api/uploads/[...path].
 */
export { UPLOADS_ROOT, publicUploadUrl } from "@/lib/storage";

/**
 * Guarda una imagen generada por IA y devuelve su URL pública.
 * Carpeta propia y pública ("class-images"): son ilustraciones de apoyo y la
 * vista previa pública del curso (primera lección) debe poder mostrarlas a un
 * visitante sin sesión. El material privado del curso sigue en "materials".
 */
export async function saveGeneratedImage(tenantId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const extension = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
  const fileName = `ai-${tenantId}-${crypto.randomBytes(8).toString("hex")}${extension}`;
  return putUpload("class-images", fileName, new Uint8Array(buffer), mimeType);
}

/**
 * Formatos permitidos para subir archivos. La extensión SIEMPRE sale de esta
 * tabla, nunca del nombre que envía el navegador: así no se puede guardar un
 * .html o .svg (XSS almacenado servido desde nuestro propio dominio) ni colar
 * separadores de ruta. Compartido por las acciones del servidor y el navegador.
 */

export const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export const MATERIAL_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/zip": ".zip",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

export const IMAGE_FORMATS_LABEL = "PNG, JPG, WEBP o GIF";
export const MATERIAL_FORMATS_LABEL = "PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP, imágenes, audio o video";

/**
 * Tamaño máximo de un material. Con Supabase Storage el navegador sube directo
 * al bucket (50 MB es el máximo por archivo del plan gratuito de Supabase).
 * Sin Storage el archivo pasa por el servidor, limitado a 6 MB por petición.
 */
export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
export const MAX_SERVER_UPLOAD_BYTES = 5 * 1024 * 1024;

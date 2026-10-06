import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getSession } from "@/lib/session";
import { isSafeFileName, isUploadFolder, openUpload, tenantOfFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Entrega los archivos subidos (logos, materiales, imágenes de clase y
 * comprobantes), estén en Supabase Storage o en disco (src/lib/storage.ts).
 *
 * La URL /api/uploads/{carpeta}/{archivo} es la que se guarda en base de datos y
 * no depende del almacenamiento. Aquí se aplican los permisos: el navegador
 * nunca accede al bucket (privado) directamente.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** Carpetas privadas: el tenant va codificado en el nombre (prefijo-tenantId-hex.ext) */
const PRIVATE_FOLDERS = new Set(["materials", "payment-proofs"]);

const notFound = () => new NextResponse("Not found", { status: 404 });

export async function GET(_req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;
  if (!segments || segments.length !== 2) return notFound();

  const [folder, fileName] = segments;
  // El nombre lo genera el servidor: cualquier otra cosa (incluido "..") se rechaza
  if (!isUploadFolder(folder) || !isSafeFileName(fileName)) return notFound();

  // Logos e ilustraciones de clase son públicos (portada de la academia, verificación
  // de certificados, vista previa pública). El material es contenido de pago: solo
  // quien pertenece a esa academia. Los comprobantes (datos bancarios): solo el staff.
  if (PRIVATE_FOLDERS.has(folder)) {
    const owningTenantId = tenantOfFile(fileName);
    const session = await getSession();
    const staffOnly = folder === "payment-proofs";
    if (
      !session ||
      !owningTenantId ||
      session.tenantId !== owningTenantId ||
      (staffOnly && session.academyRole !== "OWNER" && session.academyRole !== "TEACHER")
    ) {
      // 404 y no 403: así no se revela si el archivo existe
      return notFound();
    }
  }

  const contentType = CONTENT_TYPES[path.extname(fileName).toLowerCase()];
  if (!contentType) return notFound();

  const file = await openUpload(folder, fileName);
  if (!file) return notFound();

  return new NextResponse(file.body, {
    headers: {
      "Content-Type": contentType,
      ...(file.size !== null ? { "Content-Length": String(file.size) } : {}),
      // El nombre es aleatorio e irrepetible, así que se puede cachear para siempre.
      // Lo privado va como "private": depende de la sesión y no debe quedar en
      // cachés compartidas donde lo alcanzaría alguien de otra academia.
      "Cache-Control": PRIVATE_FOLDERS.has(folder) ? "private, max-age=31536000, immutable" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

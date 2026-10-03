import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { UPLOADS_ROOT } from "@/lib/uploads";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Sirve los archivos subidos (logos y materiales) desde UPLOADS_ROOT.
 *
 * ¿Por qué una ruta de API y no la carpeta public?
 * Next.js solo garantiza servir los archivos que estaban en `public/` al hacer
 * el build; los que se escriben después pueden no publicarse. Además, en un
 * hosting gestionado cada redespliegue reemplaza el directorio del proyecto y
 * se llevaría por delante los archivos de los clientes. Sirviéndolos desde
 * aquí, UPLOADS_DIR puede vivir fuera del proyecto y todo sigue funcionando
 * igual en hosting gestionado, en VPS o en local.
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

/** Solo se sirven las carpetas que escribe upload.actions.ts */
const ALLOWED_FOLDERS = new Set(["logos", "materials", "class-images", "payment-proofs"]);
/** Carpetas privadas: el tenant va codificado en el nombre (prefijo-tenantId-hex.ext) */
const PRIVATE_FOLDERS = new Set(["materials", "payment-proofs"]);

export async function GET(_req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await context.params;

  if (!segments || segments.length !== 2) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [folder, fileName] = segments;

  if (!ALLOWED_FOLDERS.has(folder)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // El nombre lo genera el servidor (prefijo-tenant-hex.ext). Cualquier cosa
  // distinta —incluido "..", separadores o rutas absolutas— se rechaza.
  if (!/^[A-Za-z0-9._-]+$/.test(fileName) || fileName.includes("..")) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Los logos y las ilustraciones de clase son públicos (portada de la academia,
  // verificación de certificados, vista previa pública del curso).
  // El material de curso NO: es contenido de pago y solo lo ve quien pertenece a
  // esa academia. El tenant va codificado en el nombre: prefijo-tenantId-hex.ext
  // Los comprobantes de pago (datos bancarios del alumno) solo los ve el staff de la academia.
  if (PRIVATE_FOLDERS.has(folder)) {
    const owningTenantId = fileName.split("-")[1];
    const session = await getSession();
    const staffOnly = folder === "payment-proofs";
    if (
      !session ||
      !owningTenantId ||
      session.tenantId !== owningTenantId ||
      (staffOnly && session.academyRole !== "OWNER" && session.academyRole !== "TEACHER")
    ) {
      // 404 y no 403: así no se revela si el archivo existe
      return new NextResponse("Not found", { status: 404 });
    }
  }

  const extension = path.extname(fileName).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(UPLOADS_ROOT, folder, fileName);

  // Defensa adicional: el archivo resuelto debe seguir dentro de UPLOADS_ROOT
  const root = path.resolve(UPLOADS_ROOT);
  if (!path.resolve(filePath).startsWith(root + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not a file");
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = createReadStream(filePath) as unknown as ReadableStream;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(fileStat.size),
      // El nombre es aleatorio e irrepetible, así que se puede cachear para siempre.
      // El material va como "private": depende de la sesión y no debe quedar en
      // cachés compartidas donde lo alcanzaría alguien de otra academia.
      "Cache-Control":
        PRIVATE_FOLDERS.has(folder)
          ? "private, max-age=31536000, immutable"
          : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

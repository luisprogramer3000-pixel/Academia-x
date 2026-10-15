import { Readable } from "stream";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { isMongoConfigured } from "@/lib/mongo";
import { MATERIAL_FORMATS_LABEL, MATERIAL_TYPES, MAX_MATERIAL_BYTES } from "@/lib/upload-types";
import { LIBRARY_LANGUAGES, LibraryService } from "@/modules/library/library.service";

export const dynamic = "force-dynamic";

/**
 * Subida a la biblioteca de la plataforma (profesores y administrador). Recibe
 * un formulario con el archivo y su ficha; el archivo se guarda en MongoDB
 * (GridFS, carpeta de imágenes o de documentos según el tipo) y después la ficha.
 */

const fieldsSchema = z.object({
  title: z.string().trim().min(3, "Escribe un título (mínimo 3 caracteres).").max(150),
  description: z.string().trim().max(1000).optional().default(""),
  language: z.enum(LIBRARY_LANGUAGES, { errorMap: () => ({ message: "Elige el idioma." }) }),
});

const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireTenantAccess(STAFF_ROLES);
  } catch {
    return fail("No autorizado.", 401);
  }
  if (!isMongoConfigured()) return fail("La biblioteca de la plataforma aún no está configurada.", 503);

  // Antes de leer el cuerpo: tamaño declarado (archivo + campos del formulario)
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_MATERIAL_BYTES + 1024 * 1024) {
    return fail(`El archivo no debe superar los ${Math.round(MAX_MATERIAL_BYTES / 1048576)} MB.`, 413);
  }

  const limit = await checkRateLimit({ key: `library_upload:${ctx.userId}`, limit: 20, windowMs: 60 * 60_000 });
  if (!limit.success) return fail("Has subido demasiados archivos en la última hora. Inténtalo más tarde.", 429);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("No se pudo leer el archivo. Inténtalo de nuevo.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Elige un archivo.");

  const fields = fieldsSchema.safeParse({ title: form.get("title"), description: form.get("description") ?? "", language: form.get("language") });
  if (!fields.success) return fail(fields.error.issues[0]?.message ?? "Datos no válidos.");

  // Sin Office instalado, Windows a veces no da el tipo de un .pptx/.docx: se deduce de la extensión
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const mimeType = MATERIAL_TYPES[file.type] ? file.type : Object.keys(MATERIAL_TYPES).find((t) => MATERIAL_TYPES[t] === extension);
  if (!mimeType) return fail(`Formato no permitido. Usa ${MATERIAL_FORMATS_LABEL}.`);
  if (file.size <= 0) return fail("El archivo está vacío.");
  if (file.size > MAX_MATERIAL_BYTES) return fail(`El archivo no debe superar los ${Math.round(MAX_MATERIAL_BYTES / 1048576)} MB.`, 413);

  const originalName = file.name.trim().slice(0, 200) || `archivo${MATERIAL_TYPES[mimeType]}`;
  let stored;
  try {
    stored = await LibraryService.storeFile(Readable.fromWeb(file.stream() as import("stream/web").ReadableStream), {
      originalName,
      mimeType,
      maxBytes: MAX_MATERIAL_BYTES,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "No se pudo guardar el archivo.", 500);
  }

  try {
    const doc = await LibraryService.create({
      title: fields.data.title,
      description: fields.data.description,
      language: fields.data.language,
      folder: stored.folder,
      fileId: stored.fileId,
      originalName,
      mimeType,
      size: stored.size,
      uploadedBy: {
        userId: ctx.userId,
        name: ctx.user.name || ctx.user.email,
        tenantId: ctx.tenantId,
        tenantName: ctx.tenant.name,
        isPlatformAdmin: ctx.isSuperAdmin,
      },
    });
    revalidatePath("/dashboard/biblioteca");
    revalidatePath("/dashboard/admin/sales");
    return NextResponse.json({ success: true, status: doc.status });
  } catch {
    // Sin ficha, el archivo quedaría huérfano en GridFS
    await LibraryService.deleteFile(stored.folder, stored.fileId);
    return fail("No se pudo guardar el archivo en la biblioteca.", 500);
  }
}

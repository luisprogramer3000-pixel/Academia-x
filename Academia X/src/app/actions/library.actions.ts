"use server";

import crypto from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLibrarySignedUpload, isLibraryKey, openLibraryFile, putUpload } from "@/lib/storage";
import { IMAGE_TYPES, MATERIAL_FORMATS_LABEL, MATERIAL_TYPES, MAX_MATERIAL_BYTES } from "@/lib/upload-types";
import { isMongoConfigured } from "@/lib/mongo";
import { LIBRARY_LANGUAGES, LibraryService } from "@/modules/library/library.service";

/** Biblioteca de la plataforma: subir (profesores y administrador), moderar y eliminar. */

function fail(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? fallback };
  return { success: false as const, error: error instanceof Error ? error.message : fallback };
}

/** Paso 1: enlace firmado para subir el archivo directo al bucket de la biblioteca. */
export async function prepareLibraryUploadAction(input: { type: string; size: number }) {
  try {
    const { userId } = await requireTenantAccess(STAFF_ROLES);
    const extension = MATERIAL_TYPES[input?.type];
    if (!extension) return { success: false as const, error: `Formato no permitido. Usa ${MATERIAL_FORMATS_LABEL}.` };
    const size = Number(input?.size);
    if (!Number.isFinite(size) || size <= 0) return { success: false as const, error: "El archivo está vacío." };
    if (size > MAX_MATERIAL_BYTES) return { success: false as const, error: `El archivo no debe superar los ${Math.round(MAX_MATERIAL_BYTES / 1048576)} MB.` };

    const limit = await checkRateLimit({ key: `library_upload:${userId}`, limit: 20, windowMs: 60 * 60_000 });
    if (!limit.success) return { success: false as const, error: "Has subido demasiados archivos en la última hora. Inténtalo más tarde." };

    const key = `files/${new Date().getUTCFullYear()}/${crypto.randomBytes(12).toString("hex")}${extension}`;
    return { success: true as const, uploadUrl: await createLibrarySignedUpload(key), key };
  } catch (error) {
    return fail(error, "No se pudo preparar la subida.");
  }
}

const registerSchema = z.object({
  key: z.string().refine(isLibraryKey, "Archivo no válido."),
  title: z.string().trim().min(3, "Escribe un título (mínimo 3 caracteres).").max(150),
  description: z.string().trim().max(1000).optional().default(""),
  language: z.enum(LIBRARY_LANGUAGES, { errorMap: () => ({ message: "Elige el idioma." }) }),
  originalName: z.string().trim().min(1).max(200),
  mimeType: z.string().refine((t) => Boolean(MATERIAL_TYPES[t]), "Formato no permitido."),
  size: z.number().int().positive().max(MAX_MATERIAL_BYTES),
});

/** Paso 2: con el archivo ya subido, se crea su ficha en MongoDB. */
export async function registerLibraryFileAction(input: unknown) {
  try {
    const ctx = await requireTenantAccess(STAFF_ROLES);
    const data = registerSchema.parse(input);

    // El archivo tiene que estar de verdad en el bucket (no se registran fichas vacías)
    const stored = await openLibraryFile(data.key);
    if (!stored) return { success: false as const, error: "El archivo no llegó a subirse. Inténtalo de nuevo." };
    await stored.body.cancel().catch(() => undefined);

    const doc = await LibraryService.create({
      title: data.title,
      description: data.description,
      language: data.language,
      storageKey: data.key,
      originalName: data.originalName,
      mimeType: data.mimeType,
      size: stored.size ?? data.size,
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
    return { success: true as const, status: doc.status };
  } catch (error) {
    return fail(error, "No se pudo guardar el archivo en la biblioteca.");
  }
}

/** Aprobar o rechazar un archivo subido por un profesor (solo administrador de la plataforma). */
export async function reviewLibraryFileAction(id: string, decision: "approved" | "rejected", note?: string) {
  try {
    const ctx = await requireTenantAccess(STAFF_ROLES);
    if (!ctx.isSuperAdmin) return { success: false as const, error: "Solo el administrador de la plataforma puede revisar archivos." };
    const value = z.enum(["approved", "rejected"]).parse(decision);
    const cleanNote = z.string().trim().max(300).parse(note ?? "");
    await LibraryService.review(id, value, cleanNote || null);
    revalidatePath("/dashboard/biblioteca");
    revalidatePath("/dashboard/admin/sales");
    return { success: true as const };
  } catch (error) {
    return fail(error, "No se pudo revisar el archivo.");
  }
}

export async function deleteLibraryFileAction(id: string) {
  try {
    const ctx = await requireTenantAccess(STAFF_ROLES);
    await LibraryService.remove(id, { userId: ctx.userId, isPlatformAdmin: ctx.isSuperAdmin });
    revalidatePath("/dashboard/biblioteca");
    revalidatePath("/dashboard/admin/sales");
    return { success: true as const };
  } catch (error) {
    return fail(error, "No se pudo eliminar el archivo.");
  }
}

/** Imágenes publicadas de la biblioteca, para el selector del editor de lecciones. */
export async function listLibraryImagesAction(input: { language?: string; q?: string; page?: number }) {
  try {
    const { userId } = await requireTenantAccess(STAFF_ROLES);
    if (!isMongoConfigured()) return { success: false as const, error: "La biblioteca de la plataforma aún no está configurada." };
    const data = await LibraryService.list({ userId }, { language: input?.language, q: input?.q, page: input?.page, mimeTypes: Object.keys(IMAGE_TYPES) });
    return {
      success: true as const,
      items: data.items.map((f) => ({ id: f.id, title: f.title, language: f.language })),
      page: data.page,
      pages: data.pages,
    };
  } catch (error) {
    return fail(error, "No se pudo abrir la biblioteca.");
  }
}

const MAX_LIBRARY_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * Usa una imagen de la biblioteca en una lección. El bucket de la biblioteca es
 * privado (solo profesores), así que la imagen se COPIA a las imágenes de la
 * academia: los alumnos la pueden ver y la lección no se rompe si el archivo
 * desaparece después de la biblioteca.
 */
export async function copyLibraryImageAction(id: string) {
  try {
    const ctx = await requireTenantAccess(STAFF_ROLES);
    const doc = await LibraryService.get(String(id ?? ""));
    const canSee = doc && (doc.status === "approved" || ctx.isSuperAdmin || doc.uploadedBy.userId === ctx.userId);
    if (!doc || !canSee) return { success: false as const, error: "Imagen no encontrada." };
    const extension = IMAGE_TYPES[doc.mimeType];
    if (!extension) return { success: false as const, error: "Ese archivo no es una imagen." };
    if (doc.size > MAX_LIBRARY_IMAGE_BYTES) return { success: false as const, error: "La imagen es demasiado grande para usarla en una lección (máx. 15 MB)." };

    const file = await openLibraryFile(doc.storageKey);
    if (!file) return { success: false as const, error: "No se pudo leer la imagen de la biblioteca." };
    const bytes = new Uint8Array(await new Response(file.body).arrayBuffer());

    const fileName = `lib-${ctx.tenantId}-${crypto.randomBytes(8).toString("hex")}${extension}`;
    const url = await putUpload("class-images", fileName, bytes, doc.mimeType);
    if (doc.status === "approved") await LibraryService.countDownload(doc._id.toHexString()).catch(() => undefined);
    return { success: true as const, url, title: doc.title };
  } catch (error) {
    return fail(error, "No se pudo usar la imagen.");
  }
}

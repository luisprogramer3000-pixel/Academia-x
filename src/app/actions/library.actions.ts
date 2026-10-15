"use server";

import crypto from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { putUpload } from "@/lib/storage";
import { IMAGE_TYPES } from "@/lib/upload-types";
import { isMongoConfigured } from "@/lib/mongo";
import { LibraryService } from "@/modules/library/library.service";

/** Biblioteca de la plataforma: moderar y eliminar (la subida va por /api/library/upload). */

function fail(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? fallback };
  return { success: false as const, error: error instanceof Error ? error.message : fallback };
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
 * Usa una imagen de la biblioteca en una lección. La biblioteca es privada
 * (solo profesores), así que la imagen se COPIA a las imágenes de la
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

    const file = await LibraryService.openFile(doc);
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

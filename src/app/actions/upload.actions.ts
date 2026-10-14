"use server";

import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { createSignedUpload, putUpload, storageDriver, type UploadFolder } from "@/lib/storage";
import {
  IMAGE_TYPES,
  MATERIAL_TYPES,
  IMAGE_FORMATS_LABEL,
  MATERIAL_FORMATS_LABEL,
  MAX_MATERIAL_BYTES,
  MAX_SERVER_UPLOAD_BYTES,
} from "@/lib/upload-types";

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

interface StoredFile {
  url: string;
  fileName: string;
}

async function storeUploadedFile(
  file: File,
  options: { folder: UploadFolder; prefix: string; tenantId: string; extension: string }
): Promise<StoredFile> {
  const uniqueName = `${options.prefix}-${options.tenantId}-${crypto
    .randomBytes(8)
    .toString("hex")}${options.extension}`;

  const url = await putUpload(options.folder, uniqueName, new Uint8Array(await file.arrayBuffer()), file.type);
  return { url, fileName: file.name };
}

export async function uploadLogoAction(formData: FormData) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);

    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      return { success: false, error: "No se proporcionó ningún archivo." };
    }

    const extension = IMAGE_TYPES[file.type];
    if (!extension) {
      return { success: false, error: `Formato no permitido. Usa ${IMAGE_FORMATS_LABEL}.` };
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: "La imagen no debe superar los 2MB." };
    }

    const stored = await storeUploadedFile(file, {
      folder: "logos",
      prefix: "logo",
      tenantId,
      extension,
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { logoUrl: stored.url },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/verify");

    return { success: true, logoUrl: stored.url };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: error.message || "Error al subir la imagen" };
  }
}

export async function uploadMaterialAction(formData: FormData) {
  try {
    // Both students and teachers can upload files (teachers to lessons, students to submissions)
    const lessonImage = formData.get("purpose") === "lesson-image";
    const { tenantId } = await requireTenantAccess(lessonImage ? STAFF_ROLES : undefined);

    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      return { success: false, error: "No se proporcionó ningún archivo." };
    }

    const extension = (lessonImage ? IMAGE_TYPES : MATERIAL_TYPES)[file.type];
    if (!extension) {
      return { success: false, error: `Formato no permitido. Usa ${lessonImage ? IMAGE_FORMATS_LABEL : MATERIAL_FORMATS_LABEL}.` };
    }

    // Por esta vía el archivo pasa por el servidor (límite de 6 MB por petición).
    // Los grandes van directos a Storage con prepareMaterialUploadAction.
    if (file.size > MAX_SERVER_UPLOAD_BYTES) {
      return { success: false, error: `El archivo no debe superar los ${mb(MAX_SERVER_UPLOAD_BYTES)} MB.` };
    }

    const stored = await storeUploadedFile(file, {
      folder: lessonImage ? "class-images" : "materials",
      prefix: lessonImage ? "img" : "mat",
      tenantId,
      extension,
    });

    return { success: true, fileUrl: stored.url, fileName: stored.fileName };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: error.message || "Error al subir el archivo" };
  }
}

/**
 * Subida directa de materiales a Supabase Storage (sin pasar por el servidor).
 *
 * El navegador pide permiso indicando tipo y tamaño; el servidor comprueba la
 * sesión, el formato y el límite, genera el nombre (con el tenant de la sesión)
 * y devuelve un enlace firmado que solo sirve para subir ESE archivo a ESA ruta.
 * Sin Storage configurado responde mode "server" y el navegador usa
 * uploadMaterialAction (archivos pequeños).
 */
export async function prepareMaterialUploadAction(input: { type: string; size: number; purpose?: "lesson-image" }) {
  try {
    // Alumnos (entregas) y profesores (lecciones) pueden subir materiales.
    // Las imágenes de lección (solo profesores) van a la carpeta pública "class-images",
    // como las generadas por IA: así se ven también en la lección de muestra.
    const lessonImage = input?.purpose === "lesson-image";
    const { tenantId, userId } = await requireTenantAccess(lessonImage ? STAFF_ROLES : undefined);

    const extension = (lessonImage ? IMAGE_TYPES : MATERIAL_TYPES)[input?.type];
    if (!extension) {
      return { success: false as const, error: `Formato no permitido. Usa ${lessonImage ? IMAGE_FORMATS_LABEL : MATERIAL_FORMATS_LABEL}.` };
    }
    const size = Number(input?.size);
    if (!Number.isFinite(size) || size <= 0) {
      return { success: false as const, error: "El archivo está vacío." };
    }

    if (storageDriver() !== "supabase") {
      if (size > MAX_SERVER_UPLOAD_BYTES) {
        return { success: false as const, error: `El archivo no debe superar los ${mb(MAX_SERVER_UPLOAD_BYTES)} MB.` };
      }
      return { success: true as const, mode: "server" as const };
    }

    if (size > MAX_MATERIAL_BYTES) {
      return { success: false as const, error: `El archivo no debe superar los ${mb(MAX_MATERIAL_BYTES)} MB.` };
    }

    const limit = await checkRateLimit({ key: `material_upload:${userId}`, limit: 30, windowMs: 10 * 60_000 });
    if (!limit.success) {
      return { success: false as const, error: "Has subido demasiados archivos seguidos. Espera unos minutos." };
    }

    const fileName = `${lessonImage ? "img" : "mat"}-${tenantId}-${crypto.randomBytes(8).toString("hex")}${extension}`;
    const { uploadUrl, fileUrl } = await createSignedUpload(lessonImage ? "class-images" : "materials", fileName);
    return { success: true as const, mode: "direct" as const, uploadUrl, fileUrl };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false as const, error: error.message || "No se pudo preparar la subida." };
  }
}

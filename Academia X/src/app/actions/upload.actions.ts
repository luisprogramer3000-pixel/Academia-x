"use server";

import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { UPLOADS_ROOT, publicUploadUrl } from "@/lib/uploads";

/**
 * Formatos permitidos. La extensión SIEMPRE sale de esta tabla, nunca del nombre
 * que envía el navegador: así no se puede guardar un .html o .svg (XSS almacenado
 * servido desde nuestro propio dominio) ni colar separadores de ruta.
 */
const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const MATERIAL_TYPES: Record<string, string> = {
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

const IMAGE_FORMATS_LABEL = "PNG, JPG, WEBP o GIF";
const MATERIAL_FORMATS_LABEL = "PDF, Word, Excel, PowerPoint, TXT, CSV, ZIP, imágenes, audio o video";

interface StoredFile {
  url: string;
  fileName: string;
}

async function storeUploadedFile(
  file: File,
  options: { folder: string; prefix: string; tenantId: string; extension: string }
): Promise<StoredFile> {
  const buffer = Buffer.from(await file.arrayBuffer());

  const uniqueName = `${options.prefix}-${options.tenantId}-${crypto
    .randomBytes(8)
    .toString("hex")}${options.extension}`;

  const uploadDir = path.join(UPLOADS_ROOT, options.folder);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, uniqueName), buffer);

  return { url: publicUploadUrl(options.folder, uniqueName), fileName: file.name };
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
    const { tenantId } = await requireTenantAccess();

    const file = formData.get("file") as File;
    if (!file || file.size === 0) {
      return { success: false, error: "No se proporcionó ningún archivo." };
    }

    const extension = MATERIAL_TYPES[file.type];
    if (!extension) {
      return { success: false, error: `Formato no permitido. Usa ${MATERIAL_FORMATS_LABEL}.` };
    }

    // Validate size (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      return { success: false, error: "El archivo no debe superar los 20MB." };
    }

    const stored = await storeUploadedFile(file, {
      folder: "materials",
      prefix: "mat",
      tenantId,
      extension,
    });

    return { success: true, fileUrl: stored.url, fileName: stored.fileName };
  } catch (error: any) {
    console.error("Upload error:", error);
    return { success: false, error: error.message || "Error al subir el archivo" };
  }
}

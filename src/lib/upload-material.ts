"use client";

import { prepareMaterialUploadAction, uploadMaterialAction } from "@/app/actions/upload.actions";
import { MATERIAL_FORMATS_LABEL, MATERIAL_TYPES } from "@/lib/upload-types";

export type MaterialUploadResult = { success: true; fileUrl: string; fileName: string } | { success: false; error: string };

/**
 * Sube un material (archivo de lección o entrega de un alumno).
 *
 * Con Supabase Storage: el servidor da un enlace firmado y el navegador sube el
 * archivo DIRECTO al bucket (no pasa por nuestro servidor, admite archivos
 * grandes). Sin Storage: se envía al servidor como antes (archivos pequeños).
 */
export async function uploadMaterialFile(file: File, options: { purpose?: "lesson-image" } = {}): Promise<MaterialUploadResult> {
  if (!MATERIAL_TYPES[file.type]) {
    return { success: false, error: `Formato no permitido. Usa ${MATERIAL_FORMATS_LABEL}.` };
  }

  const prepared = await prepareMaterialUploadAction({ type: file.type, size: file.size, purpose: options.purpose });
  if (!prepared.success) return { success: false, error: prepared.error };

  if (prepared.mode === "server") {
    const formData = new FormData();
    formData.append("file", file);
    if (options.purpose) formData.append("purpose", options.purpose);
    const res = await uploadMaterialAction(formData);
    return res.success && res.fileUrl
      ? { success: true, fileUrl: res.fileUrl, fileName: res.fileName || file.name }
      : { success: false, error: res.error || "No se pudo subir el archivo." };
  }

  try {
    const res = await fetch(prepared.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type, "x-upsert": "false" },
      body: file,
    });
    if (!res.ok) {
      return {
        success: false,
        error: res.status === 413 ? "El archivo es demasiado grande." : `No se pudo subir el archivo (${res.status}). Inténtalo de nuevo.`,
      };
    }
  } catch {
    return { success: false, error: "Error de red al subir el archivo. Revisa tu conexión e inténtalo de nuevo." };
  }
  return { success: true, fileUrl: prepared.fileUrl, fileName: file.name };
}

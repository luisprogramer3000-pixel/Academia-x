"use client";

/** Lado mayor máximo: suficiente para una portada a pantalla completa. */
const MAX_SIDE = 1920;
/** Por debajo de esto (y con medidas razonables) la imagen se sube tal cual. */
const SMALL_ENOUGH_BYTES = 600 * 1024;

/**
 * Reduce una foto antes de subirla (lado mayor 1920 px, WebP calidad 0,85).
 *
 * Una foto de móvil o cámara (12+ MP, 3-10 MB) decodificada en cada vista previa
 * ocupa ~50 MB de memoria por copia y puede dejar sin memoria un equipo modesto;
 * reducida pesa ~200-400 KB y la página pública también carga mucho más rápido.
 *
 * Los GIF no se tocan (perderían la animación). Si el navegador no puede
 * procesarla o el resultado no es más liviano, se devuelve el archivo original.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap | null = null;
  try {
    // Primero solo las medidas (decodifica, pero la copia se libera enseguida)
    bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    if (scale === 1 && file.size <= SMALL_ENOUGH_BYTES) return file;

    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    bitmap = null;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    // Liberar la memoria del lienzo
    canvas.width = 0;
    canvas.height = 0;
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    bitmap?.close();
  }
}

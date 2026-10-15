/**
 * Pasa los archivos de la Biblioteca de Supabase Storage (bucket
 * "platform-library") a MongoDB (GridFS), separados en dos carpetas:
 * library_images (imágenes) y library_documents (PowerPoint, PDF...).
 *
 *   npx tsx scripts/migrate-library-to-mongo.ts
 *
 * Solo toca las fichas que aún no tienen el archivo en MongoDB, así que es
 * seguro repetirlo. No borra nada de Supabase: queda como copia de seguridad.
 */
import { existsSync, readFileSync } from "fs";
import { Readable } from "stream";

// tsx no carga .env.local: se leen las variables necesarias (sin sobrescribir las del sistema)
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Falta MONGODB_URI en .env.local.");
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para leer los archivos de Supabase.");
  const headers: Record<string, string> = key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
  const supabaseBucket = process.env.SUPABASE_LIBRARY_BUCKET || "platform-library";

  const { getMongoDb } = await import("../src/lib/mongo");
  const { LibraryService } = await import("../src/modules/library/library.service");
  const col = (await getMongoDb()).collection("library_files");

  const pending = await col.find({ fileId: { $exists: false } }).sort({ createdAt: 1 }).toArray();
  console.log(`Fichas sin archivo en MongoDB: ${pending.length}`);
  let moved = 0;
  let failed = 0;
  for (const doc of pending) {
    const label = `${doc.title} (${doc.originalName})`;
    if (!doc.storageKey) {
      console.log(`  ✗ ${label}: no tiene archivo en Supabase`);
      failed++;
      continue;
    }
    const res = await fetch(`${url}/storage/v1/object/authenticated/${supabaseBucket}/${doc.storageKey.split("/").map(encodeURIComponent).join("/")}`, {
      headers,
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok || !res.body) {
      console.log(`  ✗ ${label}: no se pudo descargar de Supabase (${res.status})`);
      failed++;
      continue;
    }
    const stored = await LibraryService.storeFile(Readable.fromWeb(res.body as import("stream/web").ReadableStream), {
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      maxBytes: 100 * 1024 * 1024,
    });
    if (stored.size !== doc.size) {
      await LibraryService.deleteFile(stored.folder, stored.fileId);
      console.log(`  ✗ ${label}: llegó incompleto (${stored.size} de ${doc.size} bytes)`);
      failed++;
      continue;
    }
    await col.updateOne({ _id: doc._id }, { $set: { folder: stored.folder, fileId: stored.fileId, updatedAt: new Date() } });
    moved++;
    console.log(`  ✓ [${stored.folder === "images" ? "imágenes" : "documentos"}] ${label} (${(stored.size / 1048576).toFixed(1)} MB)`);
  }

  const db = await getMongoDb();
  const count = async (name: string) => db.collection(`${name}.files`).countDocuments();
  console.log(`\nMovidos: ${moved} · Con error: ${failed}`);
  console.log(`MongoDB → library_images: ${await count("library_images")} archivos · library_documents: ${await count("library_documents")} archivos`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});

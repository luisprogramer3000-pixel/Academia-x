/**
 * Prepara la Biblioteca de la plataforma.
 *
 *   npx tsx scripts/setup-library.ts
 *
 * 1. Crea el bucket PRIVADO "platform-library" en Supabase Storage (si no existe).
 * 2. Conecta con MongoDB (MONGODB_URI) y crea los índices de library_files.
 * 3. Prueba de ida y vuelta: sube un archivo, lo lee y lo borra.
 *
 * Es seguro ejecutarlo varias veces. Lee la configuración de .env.local.
 */
import { readFileSync, existsSync } from "fs";

// tsx no carga .env.local: se leen las variables necesarias (sin sobrescribir las del sistema)
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
process.env.STORAGE_DRIVER = "supabase";

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Falta MONGODB_URI en .env.local.");

  const storage = await import("../src/lib/storage");
  console.log(`Bucket "${process.env.SUPABASE_LIBRARY_BUCKET || "platform-library"}": ${await storage.ensureLibraryBucket()} (privado)`);

  const { getMongoDb } = await import("../src/lib/mongo");
  const db = await getMongoDb();
  await db.command({ ping: 1 });
  console.log(`MongoDB: conectado a la base "${db.databaseName}"`);

  const col = db.collection("library_files");
  await Promise.all([
    col.createIndex({ status: 1, language: 1, createdAt: -1 }),
    col.createIndex({ "uploadedBy.userId": 1, createdAt: -1 }),
    col.createIndex({ title: "text", description: "text" }, { default_language: "spanish", name: "text_search" }),
  ]);
  console.log(`Índices: ${(await col.indexes()).map((i) => i.name).join(", ")}`);
  console.log(`Fichas en la biblioteca: ${await col.countDocuments()}`);

  // Ida y vuelta en el bucket con un archivo de prueba
  const key = `files/${new Date().getUTCFullYear()}/${"0".repeat(24)}.txt`;
  const uploadUrl = await storage.createLibrarySignedUpload(key);
  const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "text/plain", "x-upsert": "true" }, body: "prueba biblioteca" });
  if (!put.ok) throw new Error(`La subida de prueba falló (${put.status}): ${await put.text()}`);
  const read = await storage.openLibraryFile(key);
  const text = read ? await new Response(read.body).text() : null;
  await storage.deleteLibraryFile(key);
  if (text !== "prueba biblioteca") throw new Error("El archivo de prueba no se pudo leer de vuelta.");
  console.log("Storage: subida directa, lectura y borrado OK");

  console.log("\nBiblioteca lista.");
  process.exit(0);
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});

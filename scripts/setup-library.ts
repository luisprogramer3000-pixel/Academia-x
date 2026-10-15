/**
 * Prepara la Biblioteca de la plataforma.
 *
 *   npx tsx scripts/setup-library.ts
 *
 * 1. Conecta con MongoDB (MONGODB_URI) y crea los índices de library_files.
 * 2. Prueba de ida y vuelta en GridFS: guarda un archivo, lo lee y lo borra.
 *
 * Es seguro ejecutarlo varias veces. Lee la configuración de .env.local.
 */
import { readFileSync, existsSync } from "fs";
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

  const { getMongoDb } = await import("../src/lib/mongo");
  const db = await getMongoDb();
  await db.command({ ping: 1 });
  console.log(`MongoDB: conectado a la base "${db.databaseName}"`);

  const col = db.collection("library_files");
  await Promise.all([
    col.createIndex({ status: 1, language: 1, createdAt: -1 }),
    col.createIndex({ "uploadedBy.userId": 1, createdAt: -1 }),
    col.createIndex({ title: "text", description: "text" }, { default_language: "spanish", language_override: "textSearchLanguage", name: "text_search_v2" }),
  ]);
  console.log(`Índices: ${(await col.indexes()).map((i) => i.name).join(", ")}`);
  console.log(`Fichas en la biblioteca: ${await col.countDocuments()}`);

  // Ida y vuelta en GridFS con un archivo de prueba
  const { LibraryService } = await import("../src/modules/library/library.service");
  const stored = await LibraryService.storeFile(Readable.from([Buffer.from("prueba biblioteca")]), { originalName: "prueba.txt", mimeType: "text/plain", maxBytes: 1024 });
  const read = await LibraryService.openFile({ ...stored });
  const text = read ? await new Response(read.body).text() : null;
  await LibraryService.deleteFile(stored.folder, stored.fileId);
  if (text !== "prueba biblioteca") throw new Error("El archivo de prueba no se pudo leer de vuelta.");
  console.log("GridFS: guardado, lectura y borrado OK");

  console.log("\nBiblioteca lista.");
  process.exit(0);
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});

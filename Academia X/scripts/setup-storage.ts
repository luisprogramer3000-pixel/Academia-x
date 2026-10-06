/**
 * Configura Supabase Storage y migra los archivos que hoy están en disco.
 *
 *   npx tsx scripts/setup-storage.ts
 *
 * 1. Crea el bucket PRIVADO (si no existe) y comprueba que no sea público.
 * 2. Sube cada archivo de UPLOADS_DIR a tenants/{tenantId}/{carpeta}/{archivo}.
 * 3. Lo vuelve a descargar y compara byte a byte.
 *
 * No borra nada del disco: cuando todo esté verificado, la carpeta local se
 * puede archivar a mano. Es seguro ejecutarlo varias veces (salta lo ya subido).
 * Lee la configuración de .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */
import { readFileSync, existsSync } from "fs";
import { readdir, readFile } from "fs/promises";
import path from "path";

// tsx no carga .env.local: se leen las variables necesarias (sin sobrescribir las del sistema)
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
process.env.STORAGE_DRIVER = "supabase";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".pdf": "application/pdf", ".txt": "text/plain", ".csv": "text/csv", ".zip": "application/zip",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm",
  ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

async function main() {
  const storage = await import("../src/lib/storage");
  console.log(`Bucket "${process.env.SUPABASE_STORAGE_BUCKET || "uploads"}": ${await storage.ensureBucket()} (privado)`);

  const root = storage.UPLOADS_ROOT;
  if (!existsSync(root)) {
    console.log(`No hay carpeta local (${root}): nada que migrar.`);
    return;
  }

  let uploaded = 0, skipped = 0, failed = 0;
  for (const folder of await readdir(root)) {
    if (!storage.isUploadFolder(folder)) {
      console.log(`  ⚠ carpeta desconocida, se omite: ${folder}`);
      continue;
    }
    for (const fileName of await readdir(path.join(root, folder))) {
      const label = `${folder}/${fileName}`;
      if (!storage.isSafeFileName(fileName) || !storage.tenantOfFile(fileName)) {
        console.log(`  ⚠ nombre no válido, se omite: ${label}`);
        failed++;
        continue;
      }
      const local = new Uint8Array(await readFile(path.join(root, folder, fileName)));

      const existing = await storage.readUpload(folder, fileName, 100 * 1024 * 1024);
      if (existing && Buffer.compare(Buffer.from(existing), Buffer.from(local)) === 0) {
        console.log(`  = ya estaba: ${label}`);
        skipped++;
        continue;
      }

      try {
        await storage.putUpload(folder, fileName, local, MIME[path.extname(fileName).toLowerCase()] || "application/octet-stream");
        const back = await storage.readUpload(folder, fileName, 100 * 1024 * 1024);
        if (!back || Buffer.compare(Buffer.from(back), Buffer.from(local)) !== 0) throw new Error("la copia descargada no coincide");
        console.log(`  ✓ subido y verificado: ${label} (${(local.length / 1024).toFixed(0)} KB)`);
        uploaded++;
      } catch (error) {
        console.log(`  ✗ ${label}: ${error instanceof Error ? error.message : error}`);
        failed++;
      }
    }
  }
  console.log(`\nSubidos: ${uploaded} | ya estaban: ${skipped} | con error: ${failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

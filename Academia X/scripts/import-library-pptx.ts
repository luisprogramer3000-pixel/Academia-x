/**
 * Sube a la Biblioteca de la plataforma los PowerPoint de
 * "public/archivos de power point para la biblioteca". Cada subcarpeta es un
 * idioma (ESPAÑOL, INGLÉS, FRANCÉS...); los archivos sueltos van como Español.
 *
 *   npx tsx scripts/import-library-pptx.ts [carpeta]
 *
 * El archivo va al bucket privado de Supabase y la ficha a MongoDB
 * (library_files), publicada a nombre de Mentor Studio Global (super admin).
 * Es seguro repetirlo: los archivos ya importados (mismo nombre) se saltan.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import crypto from "crypto";

// tsx no carga .env.local: se leen las variables necesarias (sin sobrescribir las del sistema)
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
process.env.STORAGE_DRIVER = "supabase";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const MAX_BYTES = 50 * 1024 * 1024;

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Recorre la carpeta: [ruta, nombre, carpeta de idioma] de cada .pptx */
function collect(dir: string, folder = ""): Array<{ path: string; name: string; folder: string }> {
  return readdirSync(dir).sort().flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return folder ? [] : collect(path, entry);
    return /\.pptx$/i.test(entry) ? [{ path, name: entry, folder }] : [];
  });
}

/** "LAS COMIDAS DEL DIA .pptx" → "Las comidas del dia" */
function titleFromFile(name: string): string {
  const base = name.replace(/\.pptx$/i, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
  return base.charAt(0).toLocaleUpperCase("es") + base.slice(1);
}

async function main() {
  const dir = process.argv[2] || join("public", "archivos de power point para la biblioteca");
  if (!existsSync(dir)) throw new Error(`No existe la carpeta "${dir}".`);
  if (!process.env.MONGODB_URI) throw new Error("Falta MONGODB_URI en .env.local.");

  const storage = await import("../src/lib/storage");
  const { getMongoDb } = await import("../src/lib/mongo");
  const { LibraryService } = await import("../src/modules/library/library.service");
  const { PrismaClient } = await import("@prisma/client");

  const prisma = new PrismaClient();
  const admin = await prisma.user.findFirst({ where: { globalRole: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } });
  await prisma.$disconnect();
  if (!admin) throw new Error("No hay ningún usuario SUPER_ADMIN para firmar los archivos.");

  console.log(`Bucket: ${await storage.ensureLibraryBucket()}`);
  const col = (await getMongoDb()).collection("library_files");

  const { LIBRARY_LANGUAGES } = await import("../src/modules/library/library.service");
  const files = collect(dir);
  if (!files.length) console.log("No hay archivos .pptx en la carpeta.");
  let added = 0;
  for (const { path, name, folder } of files) {
    const language = folder ? LIBRARY_LANGUAGES.find((l) => plain(l) === plain(folder)) : "Español";
    if (!language) {
      console.log(`  ✗ ${folder}/${name}: la carpeta "${folder}" no es un idioma de la biblioteca (${LIBRARY_LANGUAGES.join(", ")})`);
      continue;
    }
    const size = statSync(path).size;
    if (size > MAX_BYTES) {
      console.log(`  ✗ ${name}: supera 50 MB, se omite`);
      continue;
    }
    if (await col.findOne({ originalName: name, "uploadedBy.isPlatformAdmin": true })) {
      console.log(`  = ${name}: ya estaba en la biblioteca`);
      continue;
    }

    const key = `files/${new Date().getUTCFullYear()}/${crypto.randomBytes(12).toString("hex")}.pptx`;
    const uploadUrl = await storage.createLibrarySignedUpload(key);
    const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": PPTX_MIME }, body: readFileSync(path) });
    if (!put.ok) throw new Error(`Falló la subida de "${name}" (${put.status}): ${(await put.text()).slice(0, 200)}`);

    const title = titleFromFile(name);
    await LibraryService.create({
      title,
      description: `Presentación de clase en PowerPoint: ${title}. Lista para usar en el aula.`,
      language,
      storageKey: key,
      originalName: name,
      mimeType: PPTX_MIME,
      size,
      uploadedBy: { userId: admin.id, name: admin.name || admin.email, tenantId: null, tenantName: null, isPlatformAdmin: true },
    });
    added++;
    console.log(`  ✓ [${language}] ${title} (${(size / 1048576).toFixed(1)} MB)`);
  }

  console.log(`\nAñadidos: ${added} · Fichas en la biblioteca: ${await col.countDocuments()}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});

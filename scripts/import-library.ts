/**
 * Sube a la Biblioteca de la plataforma lo que haya en
 * "public/archivos de power point para la biblioteca": PowerPoint, PDF,
 * imágenes y cualquier otro formato que admita la biblioteca.
 *
 *   npx tsx scripts/import-library-pptx.ts [carpeta]
 *
 * Idioma según la subcarpeta: ESPAÑOL, INGLÉS, FRANCÉS... (los de la
 * biblioteca); IMAGENES y los archivos sueltos van como Español; OTRAS
 * ASIGNATURAS y cualquier otra carpeta, como "Otro". Las imágenes AVIF/HEIC
 * se convierten a JPG porque la biblioteca no las admite.
 *
 * El archivo va a MongoDB (GridFS: library_images o library_documents) y la
 * ficha a library_files, publicada a nombre de Mentor Studio Global (super admin).
 * Es seguro repetirlo: los archivos ya importados (mismo nombre) se saltan.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { Readable } from "stream";

// tsx no carga .env.local: se leen las variables necesarias (sin sobrescribir las del sistema)
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const MAX_BYTES = 50 * 1024 * 1024;
/** Formatos que la biblioteca no admite pero que se pueden convertir a JPG */
const CONVERT_TO_JPG = new Set([".avif", ".heic", ".heif", ".tif", ".tiff", ".bmp"]);

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Todos los archivos de la carpeta y de sus subcarpetas (un nivel) */
function collect(dir: string, folder = ""): Array<{ path: string; name: string; folder: string }> {
  return readdirSync(dir).sort().flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return folder ? [] : collect(path, entry);
    return entry.startsWith(".") ? [] : [{ path, name: entry, folder }];
  });
}

/** "LAS COMIDAS DEL DIA .pptx" → "Las comidas del dia"; "compras_lectura_1778922806206.png" → "Compras lectura" */
function titleFromFile(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s\d{10,}$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
  return base.charAt(0).toLocaleUpperCase("es") + base.slice(1);
}

function describe(title: string, mimeType: string): string {
  if (mimeType.startsWith("image/")) return `Imagen para clase: ${title}. Úsala en lecciones, presentaciones y actividades.`;
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return `Presentación de clase en PowerPoint: ${title}. Lista para usar en el aula.`;
  if (mimeType === "application/pdf") return `Material en PDF: ${title}.`;
  return `Material de clase: ${title}.`;
}

async function main() {
  const dir = process.argv[2] || join("public", "archivos de power point para la biblioteca");
  if (!existsSync(dir)) throw new Error(`No existe la carpeta "${dir}".`);
  if (!process.env.MONGODB_URI) throw new Error("Falta MONGODB_URI en .env.local.");

  const { getMongoDb } = await import("../src/lib/mongo");
  const { LibraryService, LIBRARY_LANGUAGES } = await import("../src/modules/library/library.service");
  const { MATERIAL_TYPES } = await import("../src/lib/upload-types");
  const { PrismaClient } = await import("@prisma/client");

  const prisma = new PrismaClient();
  const admin = await prisma.user.findFirst({ where: { globalRole: "SUPER_ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } });
  await prisma.$disconnect();
  if (!admin) throw new Error("No hay ningún usuario SUPER_ADMIN para firmar los archivos.");

  const col = (await getMongoDb()).collection("library_files");

  const languageOf = (folder: string) => {
    if (!folder || plain(folder).startsWith("imagen")) return "Español";
    return LIBRARY_LANGUAGES.find((l) => plain(l) === plain(folder)) ?? "Otro";
  };
  const mimeOf = (extension: string) => Object.keys(MATERIAL_TYPES).find((t) => MATERIAL_TYPES[t] === extension);

  const files = collect(dir);
  if (!files.length) console.log("La carpeta está vacía.");
  let added = 0;
  let skipped = 0;
  for (const { path, name, folder } of files) {
    const label = folder ? `${folder}/${name}` : name;
    if (await col.findOne({ originalName: name, "uploadedBy.isPlatformAdmin": true })) {
      skipped++;
      continue;
    }

    let extension = name.slice(name.lastIndexOf(".")).toLowerCase();
    if (extension === ".jpeg") extension = ".jpg";
    let body: Buffer = readFileSync(path);
    if (CONVERT_TO_JPG.has(extension)) {
      const sharp = (await import("sharp")).default;
      body = await sharp(body).rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      extension = ".jpg";
    }
    const mimeType = mimeOf(extension);
    if (!mimeType) {
      console.log(`  ✗ ${label}: formato no admitido por la biblioteca`);
      continue;
    }
    if (body.length > MAX_BYTES) {
      console.log(`  ✗ ${label}: supera 50 MB, se omite`);
      continue;
    }

    const stored = await LibraryService.storeFile(Readable.from([body]), { originalName: name, mimeType, maxBytes: MAX_BYTES });

    const title = titleFromFile(name);
    const language = languageOf(folder);
    await LibraryService.create({
      title,
      description: describe(title, mimeType),
      language,
      folder: stored.folder,
      fileId: stored.fileId,
      originalName: name,
      mimeType,
      size: body.length,
      uploadedBy: { userId: admin.id, name: admin.name || admin.email, tenantId: null, tenantName: null, isPlatformAdmin: true },
    });
    added++;
    console.log(`  ✓ [${language}] ${title} (${(body.length / 1048576).toFixed(1)} MB)`);
  }

  console.log(`\nAñadidos: ${added} · Ya estaban: ${skipped} · Fichas en la biblioteca: ${await col.countDocuments()}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});

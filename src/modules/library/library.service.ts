import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { GridFSBucket, ObjectId, type Collection, type Filter } from "mongodb";
import { getMongoDb } from "@/lib/mongo";

/**
 * Biblioteca de la plataforma: archivos que cualquier profesor de cualquier
 * academia puede descargar. Todo vive en MongoDB: la ficha en library_files y
 * el archivo en GridFS, en dos "carpetas" separadas para que no se mezclen:
 * library_images (imágenes) y library_documents (PowerPoint, PDF, Word, audio...).
 *
 * Moderación: lo que sube el administrador de la plataforma se publica al
 * momento; lo que sube un profesor queda PENDIENTE hasta que el administrador
 * lo aprueba. Cada profesor ve siempre el estado de lo suyo.
 */

export const LIBRARY_LANGUAGES = ["Inglés", "Español", "Francés", "Portugués", "Italiano", "Alemán", "Chino", "Otro"] as const;
export type LibraryLanguage = (typeof LIBRARY_LANGUAGES)[number];
export type LibraryStatus = "approved" | "pending" | "rejected";
export type LibraryFolder = "images" | "documents";

/** Bucket de GridFS de cada carpeta (colecciones {bucket}.files y {bucket}.chunks). */
const FOLDER_BUCKETS: Record<LibraryFolder, string> = { images: "library_images", documents: "library_documents" };

export function libraryFolderOf(mimeType: string): LibraryFolder {
  return mimeType.startsWith("image/") ? "images" : "documents";
}

export interface LibraryFileDoc {
  _id: ObjectId;
  title: string;
  description: string;
  language: LibraryLanguage;
  /** Carpeta (bucket de GridFS) y id del archivo dentro de ella */
  folder: LibraryFolder;
  fileId: ObjectId;
  /** Ruta antigua en Supabase Storage (solo en los archivos que se trajeron de allí) */
  storageKey?: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: LibraryStatus;
  uploadedBy: { userId: string; name: string; tenantId: string | null; tenantName: string | null; isPlatformAdmin: boolean };
  reviewNote?: string | null;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Lo que se envía a la página (sin ObjectId ni Date, serializable). */
export interface LibraryFileView {
  id: string;
  title: string;
  description: string;
  language: LibraryLanguage;
  originalName: string;
  mimeType: string;
  size: number;
  status: LibraryStatus;
  uploadedByName: string;
  uploadedByAcademy: string | null;
  isMine: boolean;
  reviewNote: string | null;
  downloads: number;
  createdAt: string;
}

let indexesReady: Promise<unknown> | null = null;

async function files(): Promise<Collection<LibraryFileDoc>> {
  const db = await getMongoDb();
  const col = db.collection<LibraryFileDoc>("library_files");
  // Índices: listado por estado/idioma/fecha, archivos de cada profesor y búsqueda de texto
  // language_override: sin él MongoDB lee el campo "language" ("Español", "Inglés"...) como
  // idioma del índice de texto y rechaza la ficha. El índice antiguo se reemplaza.
  indexesReady ??= col.dropIndex("text_search").catch(() => undefined).then(() => Promise.all([
    col.createIndex({ status: 1, language: 1, createdAt: -1 }),
    col.createIndex({ "uploadedBy.userId": 1, createdAt: -1 }),
    col.createIndex({ title: "text", description: "text" }, { default_language: "spanish", language_override: "textSearchLanguage", name: "text_search_v2" }),
  ])).catch((error) => {
    indexesReady = null;
    throw error;
  });
  await indexesReady;
  return col;
}

function toView(d: LibraryFileDoc, viewerUserId: string): LibraryFileView {
  return {
    id: d._id.toHexString(),
    title: d.title,
    description: d.description,
    language: d.language,
    originalName: d.originalName,
    mimeType: d.mimeType,
    size: d.size,
    status: d.status,
    uploadedByName: d.uploadedBy.isPlatformAdmin ? "Mentor Studio Global" : d.uploadedBy.name,
    uploadedByAcademy: d.uploadedBy.isPlatformAdmin ? null : d.uploadedBy.tenantName,
    isMine: d.uploadedBy.userId === viewerUserId,
    reviewNote: d.reviewNote ?? null,
    downloads: d.downloads,
    createdAt: d.createdAt.toISOString(),
  };
}

const objectId = (id: string) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

async function bucket(folder: LibraryFolder): Promise<GridFSBucket> {
  return new GridFSBucket(await getMongoDb(), { bucketName: FOLDER_BUCKETS[folder] });
}

export class LibraryService {
  /** Archivos publicados (con filtros) + los propios del profesor en cualquier estado. */
  static async list(viewer: { userId: string }, filters: { language?: string; q?: string; page?: number; mimeTypes?: string[] }) {
    const col = await files();
    const pageSize = 30;
    const page = Math.max(1, filters.page ?? 1);
    const where: Filter<LibraryFileDoc> = { status: "approved" };
    if (filters.language && (LIBRARY_LANGUAGES as readonly string[]).includes(filters.language)) {
      where.language = filters.language as LibraryLanguage;
    }
    const q = (filters.q ?? "").trim().slice(0, 100);
    if (q) where.$text = { $search: q };
    if (filters.mimeTypes?.length) where.mimeType = { $in: filters.mimeTypes };

    const [items, total, mine] = await Promise.all([
      col.find(where).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(where),
      // Lo que subió este profesor y aún no está publicado (pendiente o rechazado)
      col.find({ "uploadedBy.userId": viewer.userId, status: { $ne: "approved" } }).sort({ createdAt: -1 }).limit(50).toArray(),
    ]);
    return {
      items: items.map((d) => toView(d, viewer.userId)),
      mine: mine.map((d) => toView(d, viewer.userId)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Pendientes de revisión (solo administrador). */
  static async listPending(viewerUserId: string) {
    const col = await files();
    const docs = await col.find({ status: "pending" }).sort({ createdAt: 1 }).limit(100).toArray();
    return docs.map((d) => toView(d, viewerUserId));
  }

  /**
   * Guarda el archivo en su carpeta de GridFS (imágenes o documentos). Si supera
   * maxBytes se borra lo escrito y falla. Devuelve dónde quedó y su tamaño real.
   */
  static async storeFile(body: Readable, file: { originalName: string; mimeType: string; maxBytes: number }) {
    const folder = libraryFolderOf(file.mimeType);
    const upload = (await bucket(folder)).openUploadStream(file.originalName, { metadata: { mimeType: file.mimeType } });
    let size = 0;
    try {
      await pipeline(
        body,
        async function* (source) {
          for await (const chunk of source) {
            size += chunk.length;
            if (size > file.maxBytes) throw new Error(`El archivo no debe superar los ${Math.round(file.maxBytes / 1048576)} MB.`);
            yield chunk;
          }
        },
        upload
      );
    } catch (error) {
      await upload.abort().catch(() => undefined);
      throw error;
    }
    if (size === 0) {
      await LibraryService.deleteFile(folder, upload.id);
      throw new Error("El archivo está vacío.");
    }
    return { folder, fileId: upload.id, size };
  }

  /** Abre el archivo de una ficha como stream (para descargarlo), o null si no existe. */
  static async openFile(doc: Pick<LibraryFileDoc, "folder" | "fileId" | "size">): Promise<{ body: ReadableStream; size: number } | null> {
    if (!doc.fileId) return null;
    const b = await bucket(doc.folder);
    const info = await b.find({ _id: doc.fileId }).limit(1).next();
    if (!info) return null;
    return { body: Readable.toWeb(b.openDownloadStream(doc.fileId)) as unknown as ReadableStream, size: info.length };
  }

  static async deleteFile(folder: LibraryFolder, fileId: ObjectId) {
    await (await bucket(folder)).delete(fileId).catch(() => undefined);
  }

  static async create(input: Omit<LibraryFileDoc, "_id" | "downloads" | "createdAt" | "updatedAt" | "status" | "reviewNote">) {
    const col = await files();
    const now = new Date();
    const doc: LibraryFileDoc = {
      ...input,
      _id: new ObjectId(),
      // El administrador publica directamente; los profesores pasan por revisión
      status: input.uploadedBy.isPlatformAdmin ? "approved" : "pending",
      reviewNote: null,
      downloads: 0,
      createdAt: now,
      updatedAt: now,
    };
    await col.insertOne(doc);
    return doc;
  }

  static async get(id: string) {
    const _id = objectId(id);
    if (!_id) return null;
    return (await files()).findOne({ _id });
  }

  static async review(id: string, decision: "approved" | "rejected", note: string | null) {
    const _id = objectId(id);
    if (!_id) throw new Error("Archivo no encontrado.");
    const res = await (await files()).updateOne({ _id }, { $set: { status: decision, reviewNote: note, updatedAt: new Date() } });
    if (res.matchedCount === 0) throw new Error("Archivo no encontrado.");
  }

  /** Borra ficha y archivo. El administrador puede borrar cualquiera; un profesor, solo lo suyo. */
  static async remove(id: string, viewer: { userId: string; isPlatformAdmin: boolean }) {
    const doc = await LibraryService.get(id);
    if (!doc) throw new Error("Archivo no encontrado.");
    if (!viewer.isPlatformAdmin && doc.uploadedBy.userId !== viewer.userId) throw new Error("Solo puedes eliminar los archivos que subiste tú.");
    await (await files()).deleteOne({ _id: doc._id });
    await LibraryService.deleteFile(doc.folder, doc.fileId);
  }

  /** Resumen para el panel del administrador: estados, tipos, descargas y aportes de profesores. */
  static async stats() {
    const col = await files();
    const [byStatus, byKind, downloads, topDownloaded, contributors] = await Promise.all([
      col.aggregate<{ _id: LibraryStatus; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
      col
        .aggregate<{ _id: string; count: number }>([
          { $match: { status: "approved" } },
          {
            $group: {
              _id: {
                $switch: {
                  branches: [
                    { case: { $regexMatch: { input: "$mimeType", regex: "^image/" } }, then: "Imágenes" },
                    { case: { $regexMatch: { input: "$mimeType", regex: "presentation|powerpoint" } }, then: "PowerPoint" },
                    { case: { $eq: ["$mimeType", "application/pdf"] }, then: "PDF" },
                    { case: { $regexMatch: { input: "$mimeType", regex: "^(audio|video)/" } }, then: "Audio y video" },
                  ],
                  default: "Otros",
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      col.aggregate<{ total: number }>([{ $group: { _id: null, total: { $sum: "$downloads" } } }]).toArray(),
      col.find({ status: "approved", downloads: { $gt: 0 } }).sort({ downloads: -1 }).limit(5).toArray(),
      // Profesores (no el administrador) que han aportado archivos
      col
        .aggregate<{ _id: string; name: string; academy: string | null; total: number; approved: number; pending: number }>([
          { $match: { "uploadedBy.isPlatformAdmin": false } },
          {
            $group: {
              _id: "$uploadedBy.userId",
              name: { $last: "$uploadedBy.name" },
              academy: { $last: "$uploadedBy.tenantName" },
              total: { $sum: 1 },
              approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
              pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
            },
          },
          { $sort: { pending: -1, total: -1 } },
          { $limit: 20 },
        ])
        .toArray(),
    ]);
    const count = (s: LibraryStatus) => byStatus.find((b) => b._id === s)?.count ?? 0;
    return {
      approved: count("approved"),
      pending: count("pending"),
      rejected: count("rejected"),
      byKind: byKind.map((k) => ({ label: k._id, count: k.count })),
      downloads: downloads[0]?.total ?? 0,
      topDownloaded: topDownloaded.map((d) => ({ id: d._id.toHexString(), title: d.title, downloads: d.downloads })),
      contributors: contributors.map((c) => ({ userId: c._id, name: c.name, academy: c.academy, total: c.total, approved: c.approved, pending: c.pending })),
    };
  }

  static async countDownload(id: string) {
    const _id = objectId(id);
    if (_id) await (await files()).updateOne({ _id }, { $inc: { downloads: 1 } });
  }
}

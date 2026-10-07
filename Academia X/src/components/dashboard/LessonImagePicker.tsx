"use client";

import { useEffect, useState } from "react";
import { ImageIcon, Library, Loader2, Search, UploadCloud, X } from "lucide-react";
import { uploadMaterialFile } from "@/lib/upload-material";
import { shrinkImage } from "@/lib/shrink-image";
import { IMAGE_FORMATS_LABEL, IMAGE_TYPES } from "@/lib/upload-types";
import { copyLibraryImageAction, listLibraryImagesAction } from "@/app/actions/library.actions";

const LANGUAGES = ["Inglés", "Español", "Francés", "Portugués", "Italiano", "Alemán", "Chino", "Otro"];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * Elegir la imagen de un bloque: subirla desde el ordenador o tomarla de la
 * Biblioteca de la plataforma (se copia a la academia).
 */
export function LessonImagePicker({
  onPick,
  compact,
}: {
  onPick: (image: { url: string; title?: string }) => void;
  /** Botones pequeños (para añadir una imagen a un bloque de texto) */
  compact?: boolean;
}) {
  const [busy, setBusy] = useState<false | "prepare" | "upload">(false);
  const [error, setError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);

  async function upload(original: File) {
    setError("");
    if (!IMAGE_TYPES[original.type]) return setError(`Formato no permitido. Usa ${IMAGE_FORMATS_LABEL}.`);
    if (original.size > 4 * MAX_IMAGE_BYTES) return setError("La imagen es demasiado grande (máx. 60 MB).");
    try {
      // Las fotos grandes se reducen a 1920 px antes de subirlas: pesan ~10 veces menos
      setBusy("prepare");
      const file = await shrinkImage(original);
      if (file.size > MAX_IMAGE_BYTES) return setError("La imagen no debe superar los 15 MB.");
      setBusy("upload");
      const res = await uploadMaterialFile(file, { purpose: "lesson-image" });
      if (res.success) onPick({ url: res.fileUrl, title: res.fileName.replace(/\.[^.]+$/, "") });
      else setError(res.error);
    } catch {
      setError("Error de red al subir la imagen.");
    } finally {
      setBusy(false);
    }
  }

  const btn = compact
    ? "px-3 py-1.5 rounded-lg text-[11px]"
    : "px-4 py-2.5 rounded-xl text-xs";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <label className={`${btn} cursor-pointer bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center gap-2 border border-slate-700 ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {busy === "prepare" ? "Preparando…" : busy ? "Subiendo…" : "Subir desde mi computadora"}
          <input
            type="file"
            accept={Object.keys(IMAGE_TYPES).join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          disabled={busy !== false}
          className={`${btn} bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center gap-2 border border-slate-700 disabled:opacity-50`}
        >
          <Library className="w-4 h-4" /> Elegir de la biblioteca
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {libraryOpen && (
        <LibraryImageDialog
          onClose={() => setLibraryOpen(false)}
          onPick={(image) => {
            setLibraryOpen(false);
            onPick(image);
          }}
        />
      )}
    </div>
  );
}

type LibraryImage = { id: string; title: string; language: string };

function LibraryImageDialog({ onClose, onPick }: { onClose: () => void; onPick: (image: { url: string; title?: string }) => void }) {
  const [language, setLanguage] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: LibraryImage[]; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    listLibraryImagesAction({ language, q: query, page }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.success) setData({ items: res.items, pages: res.pages });
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [language, query, page]);

  async function pick(item: LibraryImage) {
    setPicking(item.id);
    setError("");
    const res = await copyLibraryImageAction(item.id);
    setPicking(null);
    if (res.success) onPick({ url: res.url, title: res.title });
    else setError(res.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/85 backdrop-blur-sm overflow-y-auto p-4" onClick={onClose}>
      <div className="w-full max-w-4xl my-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Library className="w-5 h-5 text-blue-400" /> Imágenes de la biblioteca
          </h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {["", ...LANGUAGES].map((l) => (
            <button
              key={l || "all"}
              type="button"
              onClick={() => { setLanguage(l); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${language === l ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
            >
              {l || "Todos"}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }}
          className="flex gap-2 mb-5 max-w-lg"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar imagen…" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
          </div>
          <button type="submit" className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white">Buscar</button>
        </form>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-500" /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-14 text-center">
            <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-white font-semibold">{query || language ? "No hay imágenes con esos filtros" : "Aún no hay imágenes en la biblioteca"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pick(item)}
                disabled={picking !== null}
                className="group text-left rounded-2xl overflow-hidden border border-slate-800 hover:border-blue-500 bg-slate-950 disabled:opacity-60 relative"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/library/${item.id}/download?inline=1`} alt={item.title} loading="lazy" className="w-full aspect-video object-cover bg-slate-800" />
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                  <p className="text-[10px] text-slate-500">{item.language}</p>
                </div>
                {picking === item.id && (
                  <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center text-xs text-white gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Añadiendo…
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {data && data.pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6 text-sm text-slate-300">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-4 py-2 rounded-xl bg-slate-800 disabled:opacity-40">Anterior</button>
            <span>Página {page} de {data.pages}</span>
            <button type="button" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-xl bg-slate-800 disabled:opacity-40">Siguiente</button>
          </div>
        )}
      </div>
    </div>
  );
}

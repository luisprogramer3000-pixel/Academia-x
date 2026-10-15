"use client";

import { useState } from "react";
import { Link2, Loader2, Music, UploadCloud, Video } from "lucide-react";
import { uploadMaterialFile } from "@/lib/upload-material";
import { safeExternalUrl } from "@/lib/utils";
import type { ExerciseMedia } from "@/components/lesson/lesson-blocks";

/** Audio y video que se pueden subir a un ejercicio (tipo → extensión) */
const MEDIA_TYPES: Record<string, string> = {
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

/** Windows a veces da otro tipo (audio/x-m4a, audio/x-wav) o ninguno: se deduce de la extensión */
function normalizeMediaFile(file: File): File | null {
  if (MEDIA_TYPES[file.type]) return file;
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const type = Object.keys(MEDIA_TYPES).find((t) => MEDIA_TYPES[t] === extension);
  return type ? new File([file], file.name, { type }) : null;
}

/**
 * Audio, video o enlace de un ejercicio ("Escucha la grabación…", "Mira el
 * video…", "Lee el artículo…"). El archivo se sube a los materiales de la
 * academia: solo lo ven sus alumnos.
 */
export function ExerciseMediaPicker({ media, onChange }: { media?: ExerciseMedia; onChange: (media: ExerciseMedia | undefined) => void }) {
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  async function upload(raw: File) {
    const file = normalizeMediaFile(raw);
    if (!file) return setError("Formato no permitido. Usa MP3, M4A o WAV (audio) o MP4 o WEBM (video).");
    setError("");
    setBusy(true);
    const res = await uploadMaterialFile(file);
    setBusy(false);
    if (!res.success) return setError(res.error);
    onChange({ kind: file.type.startsWith("video/") ? "video" : "audio", url: res.fileUrl, name: file.name });
  }

  function addLink(e: React.FormEvent) {
    e.preventDefault();
    const value = link.trim();
    const url = /^https?:\/\//i.test(value) ? safeExternalUrl(value) : safeExternalUrl(`https://${value}`);
    if (!value || !url || url.startsWith("/")) return setError("Pega un enlace válido (por ejemplo, https://www.youtube.com/watch?v=…).");
    setError("");
    onChange({ kind: "link", url });
    setLink("");
    setLinkOpen(false);
  }

  const btn = "px-3 py-1.5 rounded-lg text-[11px] bg-slate-800 hover:bg-slate-700 text-white font-medium flex items-center gap-2 border border-slate-700";

  return (
    <div className="space-y-2">
      {media?.url && (
        <div className="space-y-2">
          {media.kind === "audio" && <audio src={media.url} controls preload="metadata" className="w-full max-w-md" />}
          {media.kind === "video" && <video src={media.url} controls preload="metadata" className="w-full max-w-md rounded-lg bg-black" />}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-300 min-w-0">
              {media.kind === "audio" ? <Music className="w-3.5 h-3.5 shrink-0" /> : media.kind === "video" ? <Video className="w-3.5 h-3.5 shrink-0" /> : <Link2 className="w-3.5 h-3.5 shrink-0" />}
              {media.kind === "link" ? (
                <a href={media.url} target="_blank" rel="noopener noreferrer" className="truncate text-blue-400 hover:underline">{media.url}</a>
              ) : (
                <span className="truncate">{media.name || (media.kind === "audio" ? "Audio" : "Video")}</span>
              )}
            </span>
            <button type="button" onClick={() => onChange(undefined)} className="text-slate-400 hover:text-red-400 shrink-0">
              Quitar
            </button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <label className={`${btn} cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {busy ? "Subiendo…" : media?.url && media.kind !== "link" ? "Cambiar audio o video" : "Subir audio o video"}
          <input
            type="file"
            accept={[...Object.keys(MEDIA_TYPES), ".mp3", ".m4a", ".wav", ".mp4", ".webm"].join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </label>
        <button type="button" onClick={() => setLinkOpen((v) => !v)} disabled={busy} className={`${btn} disabled:opacity-50`}>
          <Link2 className="w-4 h-4" /> {media?.kind === "link" ? "Cambiar enlace" : "Pegar enlace (YouTube, web…)"}
        </button>
      </div>
      {linkOpen && (
        <form onSubmit={addLink} className="flex gap-2 max-w-xl">
          <input
            type="text"
            inputMode="url"
            autoFocus
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=… o la dirección de una página"
            className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
          />
          <button type="submit" className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold">Añadir</button>
        </form>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

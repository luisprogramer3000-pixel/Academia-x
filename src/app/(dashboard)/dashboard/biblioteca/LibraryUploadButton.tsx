"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { DialogShell, fieldCls, labelCls } from "@/components/dashboard/DialogShell";
import { MATERIAL_FORMATS_LABEL, MATERIAL_TYPES, MAX_MATERIAL_BYTES } from "@/lib/upload-types";

export function LibraryUploadButton({ languages, isPlatformAdmin }: { languages: readonly string[]; isPlatformAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setTitle("");
    setDescription("");
    setLanguage("");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Elige un archivo.");
    // Sin Office instalado, Windows a veces no da el tipo de un .pptx/.docx: se deduce de la extensión
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    const type = MATERIAL_TYPES[file.type] ? file.type : Object.keys(MATERIAL_TYPES).find((t) => MATERIAL_TYPES[t] === extension);
    if (!type) return setError(`Formato no permitido. Usa ${MATERIAL_FORMATS_LABEL}.`);
    if (file.size > MAX_MATERIAL_BYTES) return setError(`El archivo no debe superar los ${Math.round(MAX_MATERIAL_BYTES / 1048576)} MB.`);
    setError("");

    // Archivo y ficha van juntos al servidor, que los guarda en MongoDB
    setBusy(true);
    const form = new FormData();
    form.append("title", title);
    form.append("description", description);
    form.append("language", language);
    form.append("file", new File([file], file.name, { type }));
    let res: { success: boolean; error?: string; status?: string };
    try {
      const response = await fetch("/api/library/upload", { method: "POST", body: form });
      res = await response.json().catch(() => ({
        success: false,
        error: response.status === 413 ? "El archivo es demasiado grande." : `No se pudo subir el archivo (${response.status}).`,
      }));
    } catch {
      res = { success: false, error: "Error de red al subir el archivo. Revisa tu conexión." };
    }
    setBusy(false);
    if (!res.success) return setError(res.error ?? "No se pudo subir el archivo.");

    setDone(res.status === "approved" ? "Archivo publicado en la biblioteca." : "Archivo enviado. Aparecerá en la biblioteca cuando el administrador lo apruebe.");
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => { setDone(null); setOpen(true); }}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2"
        >
          <UploadCloud className="w-4 h-4" /> Subir archivo
        </button>
        {done && <p className="text-xs text-emerald-400 max-w-xs text-right">{done}</p>}
      </div>

      {open && (
        <DialogShell title="Subir a la biblioteca" onClose={() => !busy && setOpen(false)}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={labelCls}>Archivo (máx. 50 MB)</label>
              <input
                type="file"
                required
                accept={Object.keys(MATERIAL_TYPES).join(",")}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 150));
                }}
                className="w-full text-sm text-slate-300 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white"
              />
              <p className="text-[11px] text-slate-500 mt-1">{MATERIAL_FORMATS_LABEL}.</p>
            </div>
            <div>
              <label className={labelCls}>Título</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={150} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Idioma</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} required className={fieldCls}>
                <option value="">Elige el idioma…</option>
                {languages.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Descripción <span className="normal-case font-normal text-slate-500">(opcional)</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} className={`${fieldCls} resize-none`} placeholder="Para qué sirve, nivel recomendado, cómo usarlo en clase…" />
            </div>
            {!isPlatformAdmin && (
              <p className="text-xs text-slate-400">Lo verán todos los profesores de la plataforma cuando el administrador lo apruebe.</p>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">Cancelar</button>
              <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2">
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? "Subiendo archivo…" : isPlatformAdmin ? "Publicar" : "Enviar a revisión"}
              </button>
            </div>
          </form>
        </DialogShell>
      )}
    </>
  );
}

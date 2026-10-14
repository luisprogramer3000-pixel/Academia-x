"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2, X } from "lucide-react";
import { deleteLibraryFileAction, reviewLibraryFileAction } from "@/app/actions/library.actions";

/** Eliminar (propio o administrador) y, para el administrador, aprobar o rechazar. */
export function LibraryItemActions({ id, title, canDelete, canReview }: { id: string; title: string; canDelete: boolean; canReview: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "delete" | "approved" | "rejected">(null);
  const [confirm, setConfirm] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function run(action: "delete" | "approved" | "rejected") {
    setBusy(action);
    setError("");
    const res = action === "delete" ? await deleteLibraryFileAction(id) : await reviewLibraryFileAction(id, action, note);
    setBusy(null);
    if (!res.success) return setError(res.error);
    setConfirm(false);
    setRejecting(false);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {canReview && !rejecting && (
        <div className="flex gap-2">
          <button type="button" onClick={() => run("approved")} disabled={busy !== null} className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5">
            {busy === "approved" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Aprobar
          </button>
          <button type="button" onClick={() => setRejecting(true)} disabled={busy !== null} className="flex-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5">
            <X className="w-3.5 h-3.5" /> Rechazar
          </button>
        </div>
      )}
      {rejecting && (
        <div className="space-y-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Motivo (lo verá el profesor)" className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white" />
          <div className="flex gap-2">
            <button type="button" onClick={() => run("rejected")} disabled={busy !== null} className="flex-1 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold">
              {busy === "rejected" ? "Enviando…" : "Rechazar"}
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs">Cancelar</button>
          </div>
        </div>
      )}
      {canDelete && (
        confirm ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => run("delete")} disabled={busy !== null} className="flex-1 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold" aria-label={`Confirmar: eliminar ${title}`}>
              {busy === "delete" ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs">No</button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1" aria-label={`Eliminar ${title}`}>
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        )
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

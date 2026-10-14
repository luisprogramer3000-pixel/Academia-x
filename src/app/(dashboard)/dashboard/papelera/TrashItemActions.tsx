"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import { restoreFromTrashAction, deleteForeverAction } from "@/app/actions/trash.actions";

export function TrashItemActions({ kind, id, title }: { kind: "course" | "resource"; id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "restore" | "delete">(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "restore" | "delete") {
    setBusy(action);
    setError("");
    const res = action === "restore" ? await restoreFromTrashAction({ kind, id }) : await deleteForeverAction({ kind, id });
    setBusy(null);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setConfirm(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      {confirm ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-300 hidden sm:inline">¿Eliminar para siempre?</span>
          <button
            type="button"
            onClick={() => run("delete")}
            disabled={busy !== null}
            className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
            aria-label={`Confirmar: eliminar para siempre ${title}`}
          >
            {busy === "delete" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Sí, eliminar
          </button>
          <button type="button" onClick={() => setConfirm(false)} disabled={busy !== null} className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
            No
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => run("restore")}
            disabled={busy !== null}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
            aria-label={`Restaurar ${title}`}
          >
            {busy === "restore" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Restaurar
          </button>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={busy !== null}
            title="Eliminar para siempre"
            aria-label={`Eliminar para siempre ${title}`}
            className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/15 text-slate-400 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400 max-w-xs text-right">{error}</p>}
    </div>
  );
}

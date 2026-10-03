"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, X } from "lucide-react";
import { deleteModuleAction, deleteLessonAction } from "@/app/actions/course.actions";

interface Props {
  type: "module" | "lesson";
  itemId: string;
  itemTitle: string;
}

export function DeleteItemButton({ type, itemId, itemTitle }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      if (type === "module") {
        await deleteModuleAction(itemId);
      } else {
        await deleteLessonAction(itemId);
      }
      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Error al eliminar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
        title={`Eliminar ${type === "module" ? "módulo" : "lección"}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="font-bold text-white text-base mb-1">
              ¿Eliminar {type === "module" ? "módulo" : "lección"}?
            </h3>
            <p className="text-sm text-slate-400 mb-1">
              <span className="text-white font-medium">"{itemTitle}"</span>
            </p>
            {type === "module" && (
              <p className="text-xs text-amber-400 mb-4">
                ⚠ Se eliminará el módulo y <strong>todas sus lecciones</strong> con su contenido.
              </p>
            )}
            {type === "lesson" && (
              <p className="text-xs text-amber-400 mb-4">
                ⚠ Se eliminará la lección y todo su contenido. Esta acción no se puede deshacer.
              </p>
            )}

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={confirm}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-sm transition-colors"
              >
                {busy ? "Eliminando..." : "Sí, eliminar"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

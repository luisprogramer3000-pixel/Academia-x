"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteCourseAction } from "@/app/actions/course.actions";
import { DialogShell } from "@/components/dashboard/DialogShell";
import { Eye, Loader2, Trash2 } from "lucide-react";

export function LessonCardActions({ id, title, canPreview }: { id: string; title: string; canPreview: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await deleteCourseAction(id);
    setBusy(false);
    if (!res.success) return setError(res.error || "No se pudo eliminar la lección.");
    setConfirm(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1">
      {canPreview && (
        <Link
          href={`/campus/courses/${id}`}
          target="_blank"
          title="Ver como alumno"
          className="px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
        >
          <Eye className="w-4 h-4" /> Ver
        </Link>
      )}
      <button
        onClick={() => setConfirm(true)}
        title="Eliminar lección"
        className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {confirm && (
        <DialogShell title="Eliminar lección" onClose={() => setConfirm(false)}>
          <p className="text-sm text-slate-300">
            ¿Eliminar <strong>{title}</strong>? Irá a la <strong>Papelera</strong> con su contenido, actividades y resultados de los alumnos, y podrás restaurarla durante 30 días.
          </p>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setConfirm(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">Cancelar</button>
            <button onClick={remove} disabled={busy} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar
            </button>
          </div>
        </DialogShell>
      )}
    </div>
  );
}

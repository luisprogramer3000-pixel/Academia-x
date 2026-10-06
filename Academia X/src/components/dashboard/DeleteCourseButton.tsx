"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, X, Archive } from "lucide-react";
import { deleteCourseAction, archiveCourseAction } from "@/app/actions/course.actions";

interface Props {
  courseId: string;
  courseTitle: string;
  lessonCount: number;
}

export function DeleteCourseButton({ courseId, courseTitle, lessonCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Con certificados emitidos no se puede borrar: se ofrece archivar
  const [canArchive, setCanArchive] = useState(false);

  function close() {
    if (busy) return;
    setOpen(false);
    setError("");
    setCanArchive(false);
  }

  async function run(action: typeof deleteCourseAction) {
    setBusy(true);
    setError("");
    const result = await action(courseId);
    setBusy(false);
    if (result.success) {
      setOpen(false);
      router.refresh();
      return;
    }
    setError(result.error || "No se pudo completar la acción.");
    setCanArchive(/certificado/i.test(result.error || ""));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/15 text-slate-400 hover:text-red-400 transition-colors"
        title="Eliminar curso"
        aria-label={`Eliminar el curso ${courseTitle}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" onClick={close}>
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button type="button" onClick={close} className="text-slate-400 hover:text-white" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="font-bold text-white text-base mb-1">¿Eliminar curso?</h3>
            <p className="text-sm text-white font-medium mb-3">"{courseTitle}"</p>
            <p className="text-xs text-slate-300 mb-4">
              Irá a la <strong>Papelera</strong> con sus módulos{lessonCount ? `, sus ${lessonCount} lecciones` : ""} y sus alumnos inscritos. Dejará de verse en la plataforma, pero podrás <strong>restaurarlo durante 30 días</strong>.
            </p>

            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

            <div className="flex items-center gap-3">
              {canArchive ? (
                <button
                  type="button"
                  onClick={() => run(archiveCourseAction)}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Archive className="w-4 h-4" /> {busy ? "Archivando..." : "Archivar"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => run(deleteCourseAction)}
                  disabled={busy}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-sm transition-colors"
                >
                  {busy ? "Moviendo..." : "Mover a la papelera"}
                </button>
              )}
              <button
                type="button"
                onClick={close}
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

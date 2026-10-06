"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteResourceAction, duplicateResourceAction } from "@/app/actions/resource.actions";
import { DialogShell } from "@/components/dashboard/DialogShell";
import { Copy, Loader2, Trash2 } from "lucide-react";

export function ResourceCardActions({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"dup" | "del" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function duplicate() {
    setBusy("dup");
    const res = await duplicateResourceAction(id);
    setBusy(null);
    if (res.success) router.refresh();
    else setError(res.error);
  }

  async function remove() {
    setBusy("del");
    const res = await deleteResourceAction(id);
    setBusy(null);
    if (res.success) {
      setConfirm(false);
      router.refresh();
    } else setError(res.error);
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={duplicate} disabled={busy !== null} title="Duplicar" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
        {busy === "dup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
      </button>
      <button onClick={() => setConfirm(true)} title="Eliminar" className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800">
        <Trash2 className="w-4 h-4" />
      </button>
      {confirm && (
        <DialogShell title="Eliminar recurso" onClose={() => setConfirm(false)}>
          <p className="text-sm text-slate-300">
            ¿Eliminar <strong>{title}</strong>? Irá a la <strong>Papelera</strong>, donde podrás restaurarlo durante 30 días. Las lecciones que ya creaste a partir de él no se borran.
          </p>
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setConfirm(false)} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">Cancelar</button>
            <button onClick={remove} disabled={busy === "del"} className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold flex items-center gap-2">
              {busy === "del" && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar
            </button>
          </div>
        </DialogShell>
      )}
    </div>
  );
}

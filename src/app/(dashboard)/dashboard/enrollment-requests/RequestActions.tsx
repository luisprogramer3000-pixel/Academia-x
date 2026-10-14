"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { approveEnrollmentRequestAction, rejectEnrollmentRequestAction } from "@/app/actions/enrollment.actions";

export function RequestActions({ requestId, studentName }: { requestId: string; studentName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setBusy(true);
    setError("");
    const result = await action();
    setBusy(false);
    if (!result.success) {
      setError(result.error || "No se pudo completar la acción.");
      return;
    }
    setRejecting(false);
    router.refresh();
  }

  if (rejecting) {
    return (
      <div className="w-full space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={`Motivo para ${studentName} (ej. el comprobante no se ve bien)`}
          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-red-500"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => rejectEnrollmentRequestAction(requestId, note))}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold"
          >
            {busy ? "Enviando..." : "Rechazar y avisar"}
          </button>
          <button type="button" disabled={busy} onClick={() => setRejecting(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
            Cancelar
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => approveEnrollmentRequestAction(requestId))}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" /> {busy ? "Aprobando..." : "Aprobar"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setRejecting(true)}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-500/15 text-slate-300 hover:text-red-400 text-xs font-semibold flex items-center gap-1.5"
        >
          <X className="w-3.5 h-3.5" /> Rechazar
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

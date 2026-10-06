"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { scheduleClassAction } from "@/app/actions/resource.actions";
import { DialogShell, fieldCls, labelCls } from "./DialogShell";
import { Loader2 } from "lucide-react";

export interface ResourceOption {
  id: string;
  title: string;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleClassDialog({
  onClose,
  defaultTitle = "",
  defaultDuration = 50,
  defaultDate,
  resourceId,
  resources,
  onScheduled,
}: {
  onClose: () => void;
  defaultTitle?: string;
  defaultDuration?: number;
  defaultDate?: Date;
  /** Recurso fijo (desde la página del recurso) */
  resourceId?: string;
  /** Recursos para elegir (desde el planificador) */
  resources?: ResourceOption[];
  onScheduled?: () => void;
}) {
  const router = useRouter();
  const initial = defaultDate ?? (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; })();
  const [title, setTitle] = useState(defaultTitle);
  const [startsAt, setStartsAt] = useState(toLocalInput(initial));
  const [duration, setDuration] = useState(defaultDuration);
  const [groupName, setGroupName] = useState("");
  const [notes, setNotes] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [linked, setLinked] = useState(resourceId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await scheduleClassAction({
      title,
      startsAt: new Date(startsAt).toISOString(),
      durationMinutes: duration,
      groupName: groupName || undefined,
      notes: notes || undefined,
      resourceId: linked || undefined,
      meetingUrl: meetingUrl.trim() || undefined,
    });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    onScheduled?.();
    router.refresh();
    onClose();
  }

  return (
    <DialogShell title="Programar clase" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls}>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} className={fieldCls} placeholder="Ej. Pretérito perfecto — Grupo B1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Fecha y hora</label>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={fieldCls} />
          </div>
          <div>
            <label className={labelCls}>Duración (min)</label>
            <input type="number" min={5} max={600} value={duration} onChange={(e) => setDuration(Number(e.target.value) || 50)} className={fieldCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Grupo <span className="normal-case font-normal text-slate-500">(opcional)</span></label>
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} className={fieldCls} placeholder="Ej. Adultos martes y jueves" />
        </div>
        <div>
          <label className={labelCls}>Enlace de la reunión <span className="normal-case font-normal text-slate-500">(opcional)</span></label>
          <input
            type="url"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className={fieldCls}
            placeholder="https://meet.google.com/... o https://zoom.us/j/..."
          />
        </div>
        {resources && !resourceId && (
          <div>
            <label className={labelCls}>Plan de clase <span className="normal-case font-normal text-slate-500">(opcional)</span></label>
            <select value={linked} onChange={(e) => {
              setLinked(e.target.value);
              const r = resources.find((x) => x.id === e.target.value);
              if (r && !title) setTitle(r.title);
            }} className={fieldCls}>
              <option value="">Sin plan vinculado</option>
              {resources.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={labelCls}>Notas <span className="normal-case font-normal text-slate-500">(opcional)</span></label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className={`${fieldCls} resize-none`} />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">Cancelar</button>
          <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Programar
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

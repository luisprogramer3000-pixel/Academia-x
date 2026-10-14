"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteScheduledClassAction, setScheduledClassStatusAction } from "@/app/actions/resource.actions";
import { ScheduleClassDialog, type ResourceOption } from "@/components/dashboard/ScheduleClassDialog";
import { DialogShell } from "@/components/dashboard/DialogShell";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, Loader2, Plus, RotateCcw, Trash2, Users, Video, XCircle } from "lucide-react";

export interface PlannerEvent {
  id: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  groupName: string | null;
  notes: string | null;
  resourceId: string | null;
  resourceTitle: string | null;
  status: "SCHEDULED" | "DONE" | "CANCELLED";
  meetingUrl: string | null;
}

/** Estilo de cada clase en el calendario según su estado */
const STATUS_STYLE: Record<PlannerEvent["status"], string> = {
  SCHEDULED: "bg-blue-500/15 border-blue-500/30 text-blue-100 hover:bg-blue-500/25",
  DONE: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/20",
  CANCELLED: "bg-slate-800/60 border-slate-700 text-slate-500 line-through hover:bg-slate-800",
};
const STATUS_LABEL: Record<PlannerEvent["status"], string> = { SCHEDULED: "Programada", DONE: "Dada", CANCELLED: "Cancelada" };

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const monthFmt = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit" });
const longFmt = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const monthParam = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, "0")}`;

type PlannerProps = {
  year: number;
  month: number;
  events: PlannerEvent[];
  upcoming: PlannerEvent[];
  resources: ResourceOption[];
};

/** Fechas y horas dependen de la zona horaria del navegador: se pinta solo en cliente. */
export function PlannerClient(props: PlannerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-[600px] rounded-2xl bg-slate-900 border border-slate-800 animate-pulse" />;
  return <PlannerCalendar {...props} />;
}

function PlannerCalendar({ year, month, events, upcoming, resources }: PlannerProps) {
  const [creatingOn, setCreatingOn] = useState<Date | null | "new">(null);
  const [selected, setSelected] = useState<PlannerEvent | null>(null);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const start = new Date(year, month, 1 - offset);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [year, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlannerEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.startsAt));
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [events]);

  const todayKey = dayKey(new Date());
  const prev = month === 0 ? monthParam(year - 1, 11) : monthParam(year, month - 1);
  const next = month === 11 ? monthParam(year + 1, 0) : monthParam(year, month + 1);
  const trailingWeekEmpty = cells.slice(35).every((d) => d.getMonth() !== month);
  const visibleCells = trailingWeekEmpty ? cells.slice(0, 35) : cells;

  return (
    <div className="grid xl:grid-cols-[1fr_320px] gap-6">
      <section className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/planner?m=${prev}`} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Mes anterior"><ChevronLeft className="w-5 h-5" /></Link>
            <h2 className="text-lg font-bold capitalize w-48 text-center">{monthFmt.format(new Date(year, month, 1))}</h2>
            <Link href={`/dashboard/planner?m=${next}`} className="p-2 rounded-lg hover:bg-slate-800" aria-label="Mes siguiente"><ChevronRight className="w-5 h-5" /></Link>
            <Link href="/dashboard/planner" className="ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700">Hoy</Link>
          </div>
          <button onClick={() => setCreatingOn("new")} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2">
            <Plus className="w-4 h-4" /> Programar clase
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500 border-b border-slate-800">
          {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {visibleCells.map((d) => {
            const k = dayKey(d);
            const inMonth = d.getMonth() === month;
            const list = byDay.get(k) ?? [];
            return (
              <div
                key={k}
                onClick={() => { const at = new Date(d); at.setHours(9, 0, 0, 0); setCreatingOn(at); }}
                className={`min-h-[110px] border-b border-r border-slate-800 p-1.5 cursor-pointer group hover:bg-slate-800/40 ${inMonth ? "" : "bg-slate-950/50"}`}
              >
                <div className="flex items-center justify-between px-1">
                  <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                    k === todayKey ? "bg-blue-600 text-white" : inMonth ? "text-slate-300" : "text-slate-600"
                  }`}>
                    {d.getDate()}
                  </span>
                  <Plus className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100" />
                </div>
                <div className="mt-1 space-y-1">
                  {list.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={(ev) => { ev.stopPropagation(); setSelected(e); }}
                      className={`w-full text-left text-[11px] px-1.5 py-1 rounded-md border truncate ${STATUS_STYLE[e.status]}`}
                      title={`${e.title} · ${STATUS_LABEL[e.status]}`}
                    >
                      {e.status === "DONE" && "✓ "}
                      <span className="font-semibold">{timeFmt.format(new Date(e.startsAt))}</span> {e.title}
                    </button>
                  ))}
                  {list.length > 3 && <p className="text-[10px] text-slate-500 px-1">+{list.length - 3} más</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="rounded-2xl bg-slate-900 border border-slate-800 p-5 self-start">
        <h3 className="font-bold flex items-center gap-2 mb-1"><CalendarDays className="w-4 h-4 text-blue-400" /> Próximas clases</h3>
        {/* Las horas se muestran en la zona de este equipo: cada profesor ve su hora local */}
        <p className="text-[11px] text-slate-500 mb-4">Horas en tu zona: {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")}</p>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500">No tienes clases programadas. Haz clic en un día del calendario para añadir una.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((e) => (
              <li key={e.id}>
                <button onClick={() => setSelected(e)} className="w-full text-left p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/40">
                  <p className="text-xs text-blue-300 capitalize">{longFmt.format(new Date(e.startsAt))}</p>
                  <p className="font-semibold text-sm mt-0.5">{e.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{e.durationMinutes} min{e.groupName ? ` · ${e.groupName}` : ""}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {creatingOn && (
        <ScheduleClassDialog
          onClose={() => setCreatingOn(null)}
          defaultDate={creatingOn === "new" ? undefined : creatingOn}
          resources={resources}
        />
      )}
      {selected && <EventDialog event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function EventDialog({ event, onClose }: { event: PlannerEvent; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "delete" | PlannerEvent["status"]>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy("delete");
    const res = await deleteScheduledClassAction(event.id);
    setBusy(null);
    if (!res.success) return setError(res.error);
    router.refresh();
    onClose();
  }

  async function setStatus(status: PlannerEvent["status"]) {
    setBusy(status);
    const res = await setScheduledClassStatusAction(event.id, status);
    setBusy(null);
    if (!res.success) return setError(res.error);
    router.refresh();
    onClose();
  }

  const statusButton = (status: PlannerEvent["status"], label: string, Icon: typeof CheckCircle2, cls: string) => (
    <button
      type="button"
      onClick={() => setStatus(status)}
      disabled={busy !== null}
      className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 ${cls}`}
    >
      {busy === status ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />} {label}
    </button>
  );

  return (
    <DialogShell title={event.title} onClose={onClose}>
      <div className="space-y-3 text-sm">
        <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold no-underline ${STATUS_STYLE[event.status].replace("line-through", "")}`}>
          {STATUS_LABEL[event.status]}
        </span>
        <p className="flex items-center gap-2 capitalize text-slate-300"><Clock className="w-4 h-4 text-slate-500" /> {longFmt.format(new Date(event.startsAt))} · {event.durationMinutes} min</p>
        {event.groupName && <p className="flex items-center gap-2 text-slate-300"><Users className="w-4 h-4 text-slate-500" /> {event.groupName}</p>}
        {event.meetingUrl && event.status === "SCHEDULED" && (
          <a
            href={event.meetingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
          >
            <Video className="w-4 h-4" /> Unirse a la reunión
          </a>
        )}
        {event.notes && <p className="text-slate-400 whitespace-pre-line">{event.notes}</p>}
        {event.resourceId && (
          <Link href={`/dashboard/resources/${event.resourceId}`} className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/40">
            <FileText className="w-4 h-4 text-blue-400" />
            <span className="font-semibold">{event.resourceTitle ?? "Plan de clase"}</span>
            <span className="ml-auto text-xs text-blue-400">Abrir plan →</span>
          </Link>
        )}
        {error && <p className="text-red-400">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-2 mt-5">
        {event.status !== "DONE" && statusButton("DONE", "Marcar como dada", CheckCircle2, "bg-emerald-600/15 text-emerald-300 hover:bg-emerald-600/25")}
        {event.status === "SCHEDULED" && statusButton("CANCELLED", "Cancelar clase", XCircle, "bg-slate-800 text-slate-300 hover:bg-slate-700")}
        {event.status !== "SCHEDULED" && statusButton("SCHEDULED", "Volver a programada", RotateCcw, "bg-slate-800 text-slate-300 hover:bg-slate-700")}
      </div>
      <div className="flex justify-between gap-2 mt-4">
        <button onClick={remove} disabled={busy !== null} className="px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 text-sm font-semibold flex items-center gap-2">
          {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Eliminar
        </button>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">Cerrar</button>
      </div>
    </DialogShell>
  );
}

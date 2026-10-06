"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle2, Loader2 } from "lucide-react";
import { setTimezoneAction } from "@/app/actions/academy.actions";
import { TIMEZONE_OPTIONS, formatInTimezone } from "@/lib/timezone";

/** Zona horaria de la academia (Configuración). Propone la del navegador si es distinta. */
export function TimezoneSettings({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [browserTz, setBrowserTz] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setBrowserTz(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
    setNow(new Date());
  }, []);

  // Si la zona guardada no está en la lista (o la del navegador), se añade para poder elegirla
  const options = [...TIMEZONE_OPTIONS];
  for (const tz of [initial, browserTz]) {
    if (tz && !options.some((o) => o.id === tz)) options.push({ id: tz, label: tz.replace(/_/g, " ") });
  }

  async function save(tz: string) {
    setBusy(true);
    setMessage(null);
    const res = await setTimezoneAction(tz);
    setBusy(false);
    if (res.success) {
      setValue(tz);
      setMessage({ ok: true, text: "Zona horaria guardada." });
      router.refresh();
    } else {
      setMessage({ ok: false, text: res.error });
    }
  }

  return (
    <section className="mt-10 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" /> Zona horaria de la academia
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Se usa en las fechas y horas que muestra la plataforma (facturación, solicitudes, certificados, analíticas por mes).
          El Planificador muestra las clases en la hora de cada persona.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={value}
          onChange={(e) => save(e.target.value)}
          disabled={busy}
          aria-label="Zona horaria de la academia"
          className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
        {browserTz && browserTz !== value && (
          <button
            type="button"
            onClick={() => save(browserTz)}
            disabled={busy}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold whitespace-nowrap"
          >
            Usar la de mi equipo ({browserTz.replace(/_/g, " ")})
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs">
        {busy && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        {now && !busy && (
          <span className="text-slate-500">
            Hora actual en la academia: <strong className="text-slate-300">{formatInTimezone(now, value, { weekday: "long", hour: "2-digit", minute: "2-digit" })}</strong>
          </span>
        )}
        {message && (
          <span className={`flex items-center gap-1 ${message.ok ? "text-emerald-400" : "text-red-400"}`}>
            {message.ok && <CheckCircle2 className="w-4 h-4" />} {message.text}
          </span>
        )}
      </div>
    </section>
  );
}

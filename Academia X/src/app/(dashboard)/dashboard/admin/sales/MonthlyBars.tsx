"use client";

import { useState } from "react";

export interface MonthDatum {
  key: string;
  label: string;
  value: number;
}

/**
 * Barras por mes (una sola serie). Al pasar el ratón o el dedo por una columna
 * se resalta y muestra el valor; debajo, la misma información como tabla.
 */
export function MonthlyBars({
  data,
  currency = false,
  unit,
}: {
  data: MonthDatum[];
  /** Valores en dólares (si no, número entero) */
  currency?: boolean;
  /** Texto del tooltip después del valor ("altas", "USD"...) */
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const format = (v: number) =>
    currency ? v.toLocaleString("es", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : v.toLocaleString("es");
  const max = Math.max(1, ...data.map((d) => d.value));
  // Escala con 4 líneas de guía en números redondos
  const step = niceStep(max / 4);
  const top = Math.max(step * 4, step);
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div>
      <div className="relative h-48 pl-10" onMouseLeave={() => setHover(null)}>
        {/* Guías horizontales (recesivas) */}
        {ticks.map((t) => (
          <div key={t} className="absolute left-10 right-0 border-t border-slate-800" style={{ bottom: `${(t / top) * 100}%` }}>
            <span className="absolute -left-10 -translate-y-1/2 w-8 text-right text-[10px] text-slate-500 tabular-nums">{compact(t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 left-10 flex items-end gap-0.5">
          {data.map((d, i) => (
            <button
              key={d.key}
              type="button"
              aria-label={`${d.label}: ${format(d.value)}${unit ? ` ${unit}` : ""}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onClick={() => setHover(i)}
              className={`relative flex-1 h-full flex items-end justify-center rounded-md outline-none ${hover === i ? "bg-slate-800/50" : ""}`}
            >
              <span
                className="w-[55%] max-w-7 rounded-t transition-opacity"
                style={{
                  height: d.value > 0 ? `max(${(d.value / top) * 100}%, 3px)` : 0,
                  background: "#3987e5",
                  opacity: hover === null || hover === i ? 1 : 0.45,
                }}
              />
              {hover === i && (
                <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-white shadow-xl pointer-events-none">
                  <span className="text-slate-400">{d.label} · </span>
                  <span className="font-bold tabular-nums">{format(d.value)}</span>
                  {unit && <span className="text-slate-400"> {unit}</span>}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-0.5 pl-10 mt-1.5">
        {data.map((d, i) => (
          <span key={d.key} className={`flex-1 text-center text-[10px] ${hover === i ? "text-white font-semibold" : "text-slate-500"} ${i % 2 ? "hidden sm:block" : ""}`}>
            {d.label}
          </span>
        ))}
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-slate-500 hover:text-slate-300 select-none">Ver como tabla</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-t border-slate-800">
                <td className="py-1 text-slate-400">{d.label}</td>
                <td className="py-1 text-right text-white tabular-nums">{format(d.value)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-700">
              <td className="py-1 text-slate-300 font-semibold">Total</td>
              <td className="py-1 text-right text-white font-bold tabular-nums">{format(total)}</td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}

function niceStep(raw: number): number {
  if (raw <= 1) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function compact(v: number): string {
  return v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10);
}

"use client";

import { useState } from "react";

export interface MonthlyPoint {
  /** Etiqueta corta del mes: "ene", "feb"... */
  label: string;
  /** Mes completo para el tooltip: "enero 2026" */
  fullLabel: string;
  value: number;
}

interface MonthlyBarChartProps {
  data: MonthlyPoint[];
  /** Color del dato. Debe venir de la paleta validada para fondo oscuro. */
  color: string;
  /** Cómo se escribe el valor (ej. "3 alumnos", "$120") */
  format?: (value: number) => string;
  /** Texto para lectores de pantalla */
  ariaLabel: string;
}

/**
 * Barras mensuales, una sola serie.
 *
 * Serie única = sin leyenda (el título del bloque ya la nombra) y con etiqueta
 * directa sobre cada barra, de modo que el valor nunca depende solo del color.
 * Los colores salen de la paleta validada contra el fondo oscuro del panel.
 */
export function MonthlyBarChart({ data, color, format, ariaLabel }: MonthlyBarChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.value), 1);
  const fmt = format || ((v: number) => String(v));

  if (data.every((d) => d.value === 0)) {
    return (
      <div className="h-44 flex items-center justify-center text-center">
        <p className="text-xs text-slate-500 max-w-[220px]">
          Todavía no hay datos. Aparecerán en cuanto tengas actividad en estos meses.
        </p>
      </div>
    );
  }

  return (
    <div className="relative" role="img" aria-label={ariaLabel}>
      <div className="flex items-end justify-between gap-2 h-44">
        {data.map((point, i) => {
          const heightPercent = (point.value / max) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end h-full gap-2 group"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Etiqueta directa: el valor no depende solo del color */}
              <span className="text-[11px] font-semibold text-slate-200 tabular-nums">
                {point.value > 0 ? fmt(point.value) : ""}
              </span>

              <div
                className="w-full rounded-t transition-opacity"
                style={{
                  height: `${Math.max(heightPercent, point.value > 0 ? 4 : 0)}%`,
                  backgroundColor: color,
                  opacity: hovered === null || hovered === i ? 1 : 0.45,
                  // 4px redondeado solo arriba: el extremo del dato, anclado a la base
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Eje: recesivo, separado por una línea tenue */}
      <div className="flex justify-between gap-2 mt-2 pt-2 border-t border-slate-800">
        {data.map((point, i) => (
          <span
            key={i}
            className={`flex-1 text-center text-[10px] uppercase tracking-wider transition-colors ${
              hovered === i ? "text-slate-200" : "text-slate-500"
            }`}
          >
            {point.label}
          </span>
        ))}
      </div>

      {/* Tooltip al pasar el ratón */}
      {hovered !== null && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 shadow-xl pointer-events-none">
          <span className="text-[11px] text-slate-400">{data[hovered].fullLabel}: </span>
          <span className="text-[11px] font-bold text-white tabular-nums">{fmt(data[hovered].value)}</span>
        </div>
      )}
    </div>
  );
}

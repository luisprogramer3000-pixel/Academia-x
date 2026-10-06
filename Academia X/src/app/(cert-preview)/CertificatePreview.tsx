"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";

const NAMES = ["Clásico premium", "Institucional moderno", "Lujo minimalista", "Académico decorado"];
const SHEET_W = 1122.5; // 297 mm a 96 dpi
const SHEET_H = 793.7; // 210 mm

/** Escala la hoja A4 al ancho de la pantalla; al imprimir se usa a tamaño real. */
export function CertificatePreview({ current, placeholders, children }: { current: number; placeholders: boolean; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, ((box.current?.clientWidth ?? SHEET_W) - 32) / SHEET_W));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="cert-stage min-h-screen bg-slate-200 py-6" ref={box}>
      <div className="no-print max-w-[1180px] mx-auto px-4 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 p-1 rounded-full bg-white shadow-sm text-xs">
          {NAMES.map((n, i) => (
            <Link key={n} href={`/certificate-template-${i + 1}${placeholders ? "?vacio=1" : ""}`} className={`px-3 py-1.5 rounded-full ${current === i + 1 ? "bg-slate-900 text-white font-bold" : "text-slate-600 hover:bg-slate-100"}`}>
              {i + 1}. {n}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 text-xs">
          <Link href={`/certificate-template-${current}${placeholders ? "" : "?vacio=1"}`} className="px-3 py-2 rounded-full bg-white shadow-sm text-slate-700 hover:bg-slate-50">
            {placeholders ? "Ver con datos de ejemplo" : "Ver placeholders"}
          </Link>
          <button type="button" onClick={() => window.print()} className="px-3 py-2 rounded-full bg-slate-900 text-white font-semibold inline-flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
          </button>
        </div>
      </div>
      <div className="cert-wrap mx-auto shadow-2xl" style={{ width: SHEET_W * scale, height: SHEET_H * scale }}>
        <div className="cert-scale" style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: SHEET_W, height: SHEET_H }}>
          {children}
        </div>
      </div>
    </div>
  );
}

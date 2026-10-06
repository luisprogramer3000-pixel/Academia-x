"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";

const SHEET_W = 1122.5; // 297 mm a 96 dpi
const SHEET_H = 793.7; // 210 mm

/**
 * Muestra una hoja A4 horizontal escalada al ancho disponible y, al imprimir,
 * a tamaño real. El CSS de impresión vive en <CertificatePrintStyles />.
 */
export function CertificateSheetViewer({ children, maxWidth = SHEET_W }: { children: ReactNode; maxWidth?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, Math.min(maxWidth, box.current?.clientWidth ?? SHEET_W) / SHEET_W));
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [maxWidth]);
  return (
    <div ref={box} className="cert-stage w-full">
      <div className="cert-wrap mx-auto shadow-2xl" style={{ width: SHEET_W * scale, height: SHEET_H * scale }}>
        <div className="cert-scale" style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: SHEET_W, height: SHEET_H }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Botón de descarga: abre el diálogo de impresión con el certificado en A4 horizontal ("Guardar como PDF"). */
export function DownloadPdfButton({ fileName, className = "" }: { fileName: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const previous = document.title;
        // El navegador usa el título como nombre del PDF
        document.title = fileName;
        window.print();
        setTimeout(() => (document.title = previous), 1000);
      }}
      className={`no-print inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold ${className}`}
    >
      <Download className="w-4 h-4" /> Descargar PDF
    </button>
  );
}

/** CSS de impresión: solo la hoja del certificado, A4 horizontal sin márgenes. */
export function CertificatePrintStyles() {
  return (
    <style>{`
      @page { size: A4 landscape; margin: 0; }
      @media print {
        html, body { background: #fff !important; margin: 0 !important; }
        body * { visibility: hidden; }
        .cert-stage, .cert-stage * { visibility: visible; }
        .cert-stage { position: fixed; left: 0; top: 0; }
        .no-print { display: none !important; }
        .cert-wrap { width: auto !important; height: auto !important; margin: 0 !important; box-shadow: none !important; }
        .cert-scale { transform: none !important; width: auto !important; height: auto !important; }
      }
    `}</style>
  );
}

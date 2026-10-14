"use client";

import { Download } from "lucide-react";

export function PdfExportButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
    >
      <Download className="w-4 h-4" /> Exportar a PDF
    </button>
  );
}

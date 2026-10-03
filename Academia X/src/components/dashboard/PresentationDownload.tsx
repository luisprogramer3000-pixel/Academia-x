"use client";

import { useState } from "react";
import { Presentation, FileText, Download } from "lucide-react";
import { PresentationWizard } from "./PresentationWizard";

interface PresentationDownloadProps {
  lessonId: string;
  /** Sin bloques no hay nada que exportar */
  hasContent: boolean;
  /** Avisa de que lo no guardado no entra en la descarga */
  hasUnsavedChanges?: boolean;
  primaryColor?: string;
}

export function PresentationDownload({ lessonId, hasContent, hasUnsavedChanges, primaryColor = "#2563EB" }: PresentationDownloadProps) {
  const [open, setOpen] = useState<"pptx" | "pdf" | null>(null);

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
      <h3 className="font-bold text-white text-base mb-1 flex items-center gap-2">
        <Presentation className="w-4 h-4 text-amber-400" /> Presentación de clase
      </h3>
      <p className="text-xs text-slate-400 mb-4">
        Convierte esta lección en diapositivas: eliges cuánto texto lleva y el diseño (un modelo, tu propia plantilla o una de internet).
      </p>

      {!hasContent ? (
        <p className="text-xs text-slate-500 italic">Añade contenido a la lección para poder generar la presentación.</p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setOpen("pptx")}
              className="flex-1 px-4 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-600/20"
            >
              <Presentation className="w-4 h-4" /> PowerPoint
            </button>
            <button
              type="button"
              onClick={() => setOpen("pdf")}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors"
            >
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 flex items-start gap-1.5">
            <Download className="w-3 h-3 shrink-0 mt-0.5" />
            El PowerPoint es editable. Las preguntas incluyen una diapositiva con la respuesta, y tu guion va al final.
          </p>
        </>
      )}

      {open && (
        <PresentationWizard
          lessonId={lessonId}
          primaryColor={primaryColor}
          hasUnsavedChanges={hasUnsavedChanges}
          initialFormat={open}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

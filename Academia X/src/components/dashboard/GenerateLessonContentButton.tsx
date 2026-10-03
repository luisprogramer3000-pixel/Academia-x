"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { generateLessonContentAIAction } from "@/app/actions/ai.actions";

interface Props {
  lessonId: string;
  lessonTitle: string;
  courseLevel: string;
  courseLanguage: string;
  courseTitle: string;
  /** La lección ya tiene bloques guardados (generados o escritos a mano) */
  hasContent?: boolean;
}

export function GenerateLessonContentButton({ lessonId, lessonTitle, courseLevel, courseLanguage, courseTitle, hasContent }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(hasContent ? "done" : "idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function generate() {
    setState("busy");
    setErrorMsg("");
    const fd = new FormData();
    fd.set("lessonId", lessonId);
    fd.set("lessonTitle", lessonTitle);
    fd.set("topic", `${courseTitle} — ${lessonTitle}`);
    fd.set("level", courseLevel || "B1");
    fd.set("language", courseLanguage || "es");
    fd.set("clientRequestId", `${lessonId}-gen-${Date.now()}`);

    const res = await generateLessonContentAIAction(fd);
    if (res.success) {
      setState("done");
      router.refresh();
    } else {
      setState("error");
      setErrorMsg(res.error || "No se pudo generar contenido.");
    }
  }

  if (state === "done") {
    return (
      <div className="flex items-center gap-1">
        <span className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" /> Contenido listo
        </span>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`¿Regenerar «${lessonTitle}» con IA? Se reemplazará el contenido actual y se usarán créditos.`)) generate();
          }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
          title="Regenerar con IA (reemplaza el contenido actual)"
          aria-label={`Regenerar ${lessonTitle} con IA`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {state === "error" && (
        <span className="text-xs text-red-400 flex items-center gap-1" title={errorMsg}>
          <AlertCircle className="w-3 h-3" /> Error
        </span>
      )}
      <button
        type="button"
        onClick={generate}
        disabled={state === "busy"}
        className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white text-xs font-medium transition-all flex items-center gap-1 disabled:opacity-50"
      >
        {state === "busy" ? (
          <>
            <span className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent" />
            Generando...
          </>
        ) : (
          <>
            <Sparkles className="w-3 h-3" /> Generar IA
          </>
        )}
      </button>
    </div>
  );
}

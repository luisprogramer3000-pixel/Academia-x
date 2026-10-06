"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateMaterialAction } from "@/app/actions/ai.actions";
import type { MaterialTool } from "@/modules/ai/material-tools";
import { ArrowLeft, Loader2, WandSparkles, Zap } from "lucide-react";

const GRADES = [
  "Primaria (6-8 años)", "Primaria (9-12 años)", "Secundaria", "Bachillerato", "Universidad", "Adultos",
  "ELE A1", "ELE A2", "ELE B1", "ELE B2", "ELE C1", "ELE C2",
];
import { CLASS_LANGUAGES as LANGUAGES } from "@/modules/ai/reading-guidance";

export function ToolForm({ tool }: { tool: Pick<MaterialTool, "id" | "name" | "emoji" | "description" | "countLabel" | "defaultCount" | "maxCount" | "liveQuiz"> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(tool.defaultCount);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("toolId", tool.id);
    fd.set("count", String(count));
    fd.set("idempotencyKey", crypto.randomUUID());
    startTransition(async () => {
      const res = await generateMaterialAction(fd);
      if (!res.success) return setError(res.error);
      router.push(`/dashboard/resources/${res.resourceId}?nuevo=1`);
    });
  }

  const input = "w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500";
  const label = "block text-sm font-semibold text-slate-200 mb-2";

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/ai-tools" className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 mb-5">
        <ArrowLeft className="w-3.5 h-3.5" /> Todas las herramientas
      </Link>
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-3xl">{tool.emoji}</div>
        <div>
          <h1 className="text-3xl font-extrabold text-white">{tool.name}</h1>
          <p className="text-slate-400 text-sm mt-1">{tool.description}</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className={label}>Tema</label>
          <input name="topic" required minLength={3} maxLength={300} className={input} placeholder="Ej. Los verbos reflexivos en la rutina diaria" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>Grado</label>
            <select name="grade" defaultValue="Universidad" className={input}>{GRADES.map((g) => <option key={g}>{g}</option>)}</select>
          </div>
          <div>
            <label className={label}>Asignatura</label>
            <input name="subject" required defaultValue="Español" className={input} />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={label}>{tool.countLabel}: <span className="text-blue-300">{count}</span></label>
            <input type="range" min={1} max={tool.maxCount} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full accent-blue-500 mt-3" />
          </div>
          <div>
            <label className={label}>Idioma</label>
            <select name="language" defaultValue="Español" className={input}>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select>
          </div>
        </div>
        <div>
          <label className={label}>Indicaciones <span className="text-slate-500 font-normal">(opcional)</span></label>
          <textarea name="context" rows={3} maxLength={2000} className={`${input} resize-none`} placeholder="Ej. Alumnos adultos que viajan por trabajo; incluye situaciones de aeropuerto y hotel." />
        </div>

        {tool.liveQuiz && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Podrás lanzarlo como <strong className="text-slate-200">quiz en vivo</strong> para que tus alumnos respondan desde el móvil.
          </p>
        )}
        {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

        <button type="submit" disabled={pending} className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2">
          {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando… (20–40 seg)</> : <><WandSparkles className="w-4 h-4" /> Generar · 1 crédito</>}
        </button>
      </form>
    </div>
  );
}

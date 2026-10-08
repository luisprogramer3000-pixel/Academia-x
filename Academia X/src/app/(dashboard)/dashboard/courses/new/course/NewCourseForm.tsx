"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { createCourseAction, type CreateCourseState } from "@/app/actions/course.actions";

const MAX_DESCRIPTION = 10000;

/** Formulario de nuevo curso: muestra los errores sin romper la página y conserva lo escrito. */
export function NewCourseForm() {
  const [state, formAction, pending] = useActionState<CreateCourseState, FormData>(createCourseAction, {});
  const v = state.values ?? {};
  const [descLength, setDescLength] = useState(v.description?.length ?? 0);
  // El nivel sale del título ("Español B2 - …") mientras el profesor no lo elija a mano
  const [level, setLevel] = useState(v.level || "B1");
  const [levelTouched, setLevelTouched] = useState(Boolean(v.level));
  const [generate, setGenerate] = useState(v.generateStructure !== "0");
  return (
    <form action={formAction} className="space-y-6">

      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Título del Curso</label>
        <input
          type="text"
          name="title"
          onChange={(e) => {
            const m = e.target.value.toUpperCase().match(/(?:^|[^A-Z])([ABC][12])(?![0-9])/);
            if (m && !levelTouched) setLevel(m[1]);
          }}
          required
          defaultValue={v.title}
          placeholder="Ej. Español B2 - Negocios e Industria"
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Descripción General</label>
        <textarea
          name="description"
          rows={4}
          maxLength={MAX_DESCRIPTION}
          defaultValue={v.description}
          onChange={(e) => setDescLength(e.target.value.length)}
          placeholder="Resumen pedagógico de los objetivos del curso..."
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors resize-y"
        />
        <p className={`text-[11px] mt-1 text-right ${descLength > MAX_DESCRIPTION * 0.95 ? "text-amber-400" : "text-slate-500"}`}>
          {descLength.toLocaleString("es")} / {MAX_DESCRIPTION.toLocaleString("es")} caracteres
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Nivel MCER</label>
          <input type="hidden" name="levelTouched" value={levelTouched ? "1" : "0"} />
          <select
            name="level"
            value={level}
            onChange={(e) => { setLevel(e.target.value); setLevelTouched(true); }}
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="A1">A1 - Acceso (Principiante)</option>
            <option value="A2">A2 - Plata (Básico)</option>
            <option value="B1">B1 - Umbral (Intermedio)</option>
            <option value="B2">B2 - Avanzado (Intermedio Alto)</option>
            <option value="C1">C1 - Dominio Eficaz (Avanzado)</option>
            <option value="C2">C2 - Maestría (Nativo/Profesional)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Precio ($ USD)</label>
          <input
            type="number"
            name="priceAmount"
            defaultValue={v.priceAmount || 99}
            min={0}
            step={1}
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Método de Cobro</label>
          <select
            name="paymentType"
            defaultValue="EXTERNAL"
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="EXTERNAL">Enlace Externo (Manual)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Link de Pago (Si es Externo)</label>
          <input
            type="url"
            name="paymentLink"
            defaultValue={v.paymentLink}
            placeholder="https://paypal.me/... o link de pago de Payphone"
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">¿A quién va dirigido? <span className="normal-case font-normal text-slate-500">(opcional)</span></label>
        <input
          type="text"
          name="audience"
          maxLength={200}
          defaultValue={v.audience}
          placeholder="Ej. Adolescentes de 14-16 años, adultos que viajan por trabajo…"
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <label className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${generate ? "border-indigo-500/50 bg-indigo-500/5" : "border-slate-800"}`}>
        <input type="hidden" name="generateStructure" value={generate ? "1" : "0"} />
        <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} className="mt-1 w-4 h-4 accent-indigo-500" />
        <span>
          <span className="block text-sm font-semibold text-white">Generar la estructura del curso con IA al crearlo</span>
          <span className="block text-xs text-slate-400 mt-0.5">
            La IA propone los módulos y lecciones según el título, el nivel y el público. Tú la revisas y la apruebas antes de añadirla (3 créditos).
          </span>
        </span>
      </label>

      {state.error && (
        <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{state.error}</div>
      )}

      <div className="pt-6 border-t border-slate-800 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold text-sm transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/30"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {pending ? "Creando…" : "Crear y Abrir Constructor"}
        </button>
      </div>
    </form>
  );
}

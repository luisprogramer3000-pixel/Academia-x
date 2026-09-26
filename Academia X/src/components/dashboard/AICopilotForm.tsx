"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateCourseAIAction } from "@/app/actions/ai.actions";
import { Wand2, AlertCircle, Sparkles, Loader2, GraduationCap } from "lucide-react";
import { getOperationCreditCost } from "@/modules/ai/ai.catalog";
import { AIOperation } from "@prisma/client";

interface AICopilotFormProps {
  tenantId: string;
  tenantSlug: string;
  isExceeded?: boolean;
  availableTeacherCredits?: number;
}

export function AICopilotForm({ tenantId, tenantSlug, isExceeded, availableTeacherCredits }: AICopilotFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const courseGenCost = getOperationCreditCost(AIOperation.COURSE_GENERATION);
  const isInsufficient = availableTeacherCredits !== undefined && availableTeacherCredits < courseGenCost;
  const isFormDisabled = loading || isExceeded || isInsufficient;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await generateCourseAIAction(formData);

      if (res.success && res.redirectUrl) {
        router.push(`${res.redirectUrl}?tenant=${tenantSlug}`);
      } else {
        setError(res.error || "Ocurrió un error al generar el borrador del curso.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Error de conexión con el servidor de IA.");
      setLoading(false);
    }
  };

  return (
    <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl relative space-y-6">
      {isInsufficient && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-semibold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>
            Saldo de créditos de profesor insuficiente ({availableTeacherCredits} cr disponibles). Esta operación requiere {courseGenCost} créditos.
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <input type="hidden" name="tenantId" value={tenantId} />

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Tema o Especialidad del Curso *
          </label>
          <input
            type="text"
            name="topic"
            required
            disabled={isFormDisabled}
            placeholder="Ej. Español Médico para Médicos y Enfermeros / Inglés Técnico de TI"
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm font-medium disabled:opacity-50"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Nivel MCER Objetivo
            </label>
            <select
              name="level"
              defaultValue="B1"
              disabled={isFormDisabled}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <option value="A1">A1 - Principiante</option>
              <option value="A2">A2 - Básico</option>
              <option value="B1">B1 - Intermedio</option>
              <option value="B2">B2 - Intermedio Alto</option>
              <option value="C1">C1 - Avanzado</option>
              <option value="C2">C2 - Profesional / Nativo</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Idioma Impartido
            </label>
            <select
              name="language"
              defaultValue="es"
              disabled={isFormDisabled}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <option value="es">Español (ELE / General)</option>
              <option value="en">Inglés (ESL / Business)</option>
              <option value="fr">Francés</option>
              <option value="de">Alemán</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              País / Estándar Educativo (Opcional)
            </label>
            <input
              type="text"
              name="countryStandard"
              disabled={isFormDisabled}
              placeholder="Ej. Ministerio de Educación, SEP, etc."
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm font-medium disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Público Objetivo (Opcional)
            </label>
            <input
              type="text"
              name="audience"
              disabled={isFormDisabled}
              placeholder="Ej. Profesionales extranjeros en Batumi / Georgia"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm font-medium disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Número de Módulos
            </label>
            <input
              type="number"
              name="modulesCount"
              defaultValue={3}
              min={1}
              max={8}
              disabled={isFormDisabled}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm font-medium disabled:opacity-50"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Modelo: <code className="text-indigo-400 font-semibold">gpt-4o-mini</code>
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono font-bold flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" /> Costo: {courseGenCost} créditos Teacher
            </span>
          </div>

          <button
            type="submit"
            disabled={isFormDisabled}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Diseñando Currículo con IA...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Generar Borrador ({courseGenCost} cr)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}


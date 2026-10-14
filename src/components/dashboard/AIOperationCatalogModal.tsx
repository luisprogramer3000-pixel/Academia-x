"use client";

import { useState } from "react";
import { Sparkles, X, Info, GraduationCap, Users, Shield } from "lucide-react";
import { AI_OPERATION_CATALOG, AIOperationConfig } from "@/modules/ai/ai.catalog";
import { AIOperation, AICreditType } from "@prisma/client";

const OPERATION_LABELS: Record<AIOperation, { title: string; description: string }> = {
  COURSE_GENERATION: {
    title: "Estructura de Curso",
    description: "Genera el mapa pedagógico inicial y temario completo en módulos y lecciones.",
  },
  LESSON_GENERATION: {
    title: "Contenido de Lección",
    description: "Genera 3 bloques explicativos pedagógicos (Texto, Vocabulario y Ejercicio).",
  },
  ACTIVITY_GENERATION: {
    title: "Actividad Pedagógica",
    description: "Genera ejercicios de práctica formativa con instrucciones detalladas.",
  },
  QUIZ_GENERATION: {
    title: "Quiz de Evaluación",
    description: "Genera cuestionarios de evaluación con opciones y explicaciones.",
  },
  LANDING_GENERATION: {
    title: "Landing Page Copywriting",
    description: "Redacta el contenido promocional de venta para la página del curso.",
  },
  LESSON_REGENERATION: {
    title: "Regenerar Lección",
    description: "Re-escribe los bloques explicativos aplicando feedback específico.",
  },
  COURSE_REGENERATION: {
    title: "Regenerar Curso",
    description: "Re-estructura el mapa completo de módulos y lecciones del curso.",
  },
  AI_TUTOR: {
    title: "Tutoría IA para Alumnos",
    description: "Asistencia pedagógica e interacción con el tutor virtual.",
  },
  AI_FEEDBACK: {
    title: "Feedback Automático",
    description: "Evaluación y retroalimentación de entregas de estudiantes.",
  },
  CLASS_AGENT: {
    title: "Agente de Clase",
    description: "Prepara la clase completa: objetivo, conceptos, mapa mental, ejercicios con solución, quiz, guion de tiempos y notas para el profesor.",
  },
  IMAGE_GENERATION: {
    title: "Imagen Estándar",
    description: "Ilustración didáctica rápida (Flux Schnell). Calidad media a coste mínimo: ideal para ilustrar varias lecciones.",
  },
  IMAGE_GENERATION_HQ: {
    title: "Imagen Alta Calidad",
    description: "Ilustración de máxima calidad (Flux 1.1 Pro). Para portadas, infografías y material impreso.",
  }
};

export interface AIOperationCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId?: string;
}

export function AIOperationCatalogModal({ isOpen, onClose, planId = "STARTER font-mono" }: AIOperationCatalogModalProps) {
  if (!isOpen) return null;

  const catalogItems = Object.keys(AI_OPERATION_CATALOG) as AIOperation[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Catálogo de Créditos de IA</h3>
              <p className="text-xs text-slate-400">
                Costes oficiales y límites diarios configurados dinámicamente en el sistema.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Table Area */}
        <div className="overflow-y-auto flex-1 pr-2 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-3 font-semibold">Operación</th>
                  <th className="p-3 font-semibold">Tipo</th>
                  <th className="p-3 font-semibold text-center">Coste</th>
                  <th className="p-3 font-semibold text-center">Tier IA</th>
                  <th className="p-3 font-semibold text-right">Límite Diario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {catalogItems.map((opKey) => {
                  const config: AIOperationConfig = AI_OPERATION_CATALOG[opKey];
                  const label = OPERATION_LABELS[opKey] || { title: opKey, description: "" };
                  const isTeacher = config.creditType === AICreditType.TEACHER;

                  return (
                    <tr key={opKey} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white text-sm">{label.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{label.description}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {isTeacher ? (
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono font-semibold flex items-center gap-1 w-fit">
                            <GraduationCap className="w-3 h-3" /> Teacher
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-mono font-semibold flex items-center gap-1 w-fit">
                            <Users className="w-3 h-3" /> Student
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap font-mono font-bold text-sm text-white">
                        {config.creditCost} <span className="text-[10px] font-normal text-slate-400">cr</span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border ${
                            config.tier === "PREMIUM"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {config.tier}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono whitespace-nowrap">
                        <span className="text-slate-300 font-bold">{config.dailyLimits.STARTER} /día</span>
                        <span className="text-slate-500 text-[10px] block">PRO: {config.dailyLimits.PRO} / ACADEMY: {config.dailyLimits.ACADEMY}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 text-blue-400">
            <Info className="w-4 h-4" /> Descuento atómico e inmutable vía AICreditEngine
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-md"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

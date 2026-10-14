"use client";

import { Sparkles, GraduationCap, Users, RefreshCw, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

export interface CreditBagInfo {
  available: number;
  monthlyAllowance: number;
  maxRollover: number;
  rolloverCredits?: number;
  purchasedCredits?: number;
  usedThisMonth: number;
  usagePercentage: number;
}

export interface AICreditWalletCardProps {
  planId: string;
  teacherCredits: CreditBagInfo;
  studentCredits: CreditBagInfo;
  resetAt: string | Date;
  capacityStatus: "NORMAL" | "LOW" | "CRITICAL" | "EXCEEDED";
  onOpenCatalog?: () => void;
  onOpenTopUpModal?: () => void;
}

export function AICreditWalletCard({
  planId,
  teacherCredits,
  studentCredits,
  resetAt,
  capacityStatus,
  onOpenCatalog,
  onOpenTopUpModal,
}: AICreditWalletCardProps) {
  const resetDateFormatted = new Date(resetAt).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const getStatusBadge = () => {
    switch (capacityStatus) {
      case "EXCEEDED":
        return (
          <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-mono font-semibold flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Saldo Agotado
          </span>
        );
      case "CRITICAL":
        return (
          <span className="px-3 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 text-xs font-mono font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Saldo Crítico (&gt;90%)
          </span>
        );
      case "LOW":
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Saldo Bajo (&gt;70%)
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Capacidad Normal
          </span>
        );
    }
  };

  return (
    <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl relative overflow-hidden space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-white">Billetera de AI Credits</h2>
              <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-blue-400 text-xs font-mono font-bold uppercase">
                Plan {planId}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Presupuesto mensual de capacidad para producción docente y tutoría.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {getStatusBadge()}
          {onOpenTopUpModal && (
            <button
              onClick={onOpenTopUpModal}
              className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Comprar Créditos
            </button>
          )}
          {onOpenCatalog && (
            <button
              onClick={onOpenCatalog}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all border border-slate-700/60"
            >
              Ver Tabla de Costes
            </button>
          )}
        </div>
      </div>

      {/* Credit Bags Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Teacher Credits Bag */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <GraduationCap className="w-4 h-4 text-blue-400" /> Créditos de Profesor
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Rollover máx: {teacherCredits.maxRollover} cr
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-black text-white font-mono">
                {teacherCredits.available.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 ml-1.5">disponibles</span>
            </div>
            <span className="text-xs text-slate-400">
              {teacherCredits.usedThisMonth} / {teacherCredits.monthlyAllowance} cr usados
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  teacherCredits.usagePercentage >= 90
                    ? "bg-red-500"
                    : teacherCredits.usagePercentage >= 70
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-blue-500 to-indigo-500"
                }`}
                style={{ width: `${teacherCredits.usagePercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>{teacherCredits.usagePercentage}% de la cuota consumido</span>
              <span>Cuota mensual: {teacherCredits.monthlyAllowance} cr</span>
            </div>
          </div>

          {(!!teacherCredits.rolloverCredits || !!teacherCredits.purchasedCredits) && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-900 text-[11px] font-mono text-slate-400">
              {!!teacherCredits.rolloverCredits && (
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  +{teacherCredits.rolloverCredits} rollover
                </span>
              )}
              {!!teacherCredits.purchasedCredits && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  +{teacherCredits.purchasedCredits} Top-Up (Comprados)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Student Credits Bag */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <Users className="w-4 h-4 text-purple-400" /> Créditos para Estudiantes
            </span>
            <span className="text-xs text-slate-400 font-mono">
              Rollover máx: {studentCredits.maxRollover} cr
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-black text-white font-mono">
                {studentCredits.available.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 ml-1.5">disponibles</span>
            </div>
            <span className="text-xs text-slate-400">
              {studentCredits.usedThisMonth} / {studentCredits.monthlyAllowance} cr usados
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  studentCredits.usagePercentage >= 90
                    ? "bg-red-500"
                    : studentCredits.usagePercentage >= 70
                    ? "bg-amber-500"
                    : "bg-gradient-to-r from-purple-500 to-pink-500"
                }`}
                style={{ width: `${studentCredits.usagePercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>{studentCredits.usagePercentage}% de la cuota consumido</span>
              <span>Cuota mensual: {studentCredits.monthlyAllowance} cr</span>
            </div>
          </div>

          {(!!studentCredits.rolloverCredits || !!studentCredits.purchasedCredits) && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-900 text-[11px] font-mono text-slate-400">
              {!!studentCredits.rolloverCredits && (
                <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  +{studentCredits.rolloverCredits} rollover
                </span>
              )}
              {!!studentCredits.purchasedCredits && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  +{studentCredits.purchasedCredits} Top-Up (Comprados)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60 font-mono">
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 text-blue-400" /> Próxima renovación de cuota: <strong>{resetDateFormatted}</strong>
        </span>
        <span className="text-slate-500">Bolsas Aisladas Multi-tenant</span>
      </div>
    </div>
  );
}

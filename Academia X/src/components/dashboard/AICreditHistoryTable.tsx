"use client";

import { History, ArrowDownRight, ArrowUpRight, RotateCcw, Sparkles, GraduationCap, Users } from "lucide-react";
import { AICreditTransactionType, AICreditType, AIOperation } from "@prisma/client";

export interface CreditTransactionRecord {
  id: string;
  tenantId: string;
  userId?: string | null;
  userName?: string;
  creditType: AICreditType;
  amount: number;
  transactionType: AICreditTransactionType;
  operation: AIOperation;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  createdAt: string | Date;
}

export interface AICreditHistoryTableProps {
  transactions: CreditTransactionRecord[];
}

export function AICreditHistoryTable({ transactions }: AICreditHistoryTableProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <History className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">Sin Transacciones Recientes</h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Aún no se han registrado consumos ni reembolsos de AI Credits en esta academia.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Historial de Transacciones de Créditos</h3>
            <p className="text-xs text-slate-400">
              Registro contable inmutable de consumos, reembolsos automáticos y asignaciones.
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[11px] border-b border-slate-800">
            <tr>
              <th className="p-3 font-semibold">Fecha</th>
              <th className="p-3 font-semibold">Usuario</th>
              <th className="p-3 font-semibold">Operación</th>
              <th className="p-3 font-semibold">Bolsa</th>
              <th className="p-3 font-semibold text-center">Tipo</th>
              <th className="p-3 font-semibold text-right">Variación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {transactions.map((tx) => {
              const isRefund = tx.transactionType === AICreditTransactionType.REFUND;
              const isUsage = tx.transactionType === AICreditTransactionType.USAGE;
              const formattedDate = new Date(tx.createdAt).toLocaleString("es-ES", {
                dateStyle: "short",
                timeStyle: "short",
              });

              return (
                <tr key={tx.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3 text-slate-400 whitespace-nowrap">{formattedDate}</td>
                  <td className="p-3 font-sans font-medium text-white whitespace-nowrap">
                    {tx.userName || "Sistema"}
                  </td>
                  <td className="p-3 font-sans font-medium text-slate-200">
                    <div>{tx.operation}</div>
                    {isRefund && tx.referenceId && (
                      <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1 mt-0.5">
                        <RotateCcw className="w-3 h-3" /> Ref. Tx: {tx.referenceId.slice(0, 10)}...
                      </span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {tx.creditType === AICreditType.TEACHER ? (
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-semibold inline-flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" /> TEACHER
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-semibold inline-flex items-center gap-1">
                        <Users className="w-3 h-3" /> STUDENT
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center whitespace-nowrap">
                    {isRefund ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                        REFUND
                      </span>
                    ) : isUsage ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                        USAGE
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px]">
                        {tx.transactionType}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right font-bold whitespace-nowrap text-sm">
                    {isRefund ? (
                      <span className="text-emerald-400 flex items-center justify-end gap-1">
                        <ArrowUpRight className="w-4 h-4" /> +{tx.amount} cr
                      </span>
                    ) : tx.amount < 0 ? (
                      <span className="text-slate-300 flex items-center justify-end gap-1">
                        <ArrowDownRight className="w-4 h-4 text-slate-500" /> {tx.amount} cr
                      </span>
                    ) : (
                      <span className="text-blue-400 flex items-center justify-end gap-1">
                        <ArrowUpRight className="w-4 h-4" /> +{tx.amount} cr
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

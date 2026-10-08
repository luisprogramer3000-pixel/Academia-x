"use client";

import { useState, useEffect } from "react";
import { Sparkles, ShoppingBag, CheckCircle, Zap, ShieldCheck, X } from "lucide-react";
import {
  getTopUpPackagesAction,
  createTopUpCheckoutAction,
  fulfillTopUpPurchaseAction,
} from "@/app/actions/topup.actions";

interface TopUpPackageUI {
  id: string;
  name: string;
  creditType: string;
  credits: number;
  price: number;
  currency: string;
  description: string;
  popular?: boolean;
}

interface AICreditTopUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId?: string;
  onSuccess?: () => void;
}

export function AICreditTopUpModal({
  isOpen,
  onClose,
  tenantId,
  onSuccess,
}: AICreditTopUpModalProps) {
  const [packages, setPackages] = useState<TopUpPackageUI[]>([]);
  const [activeTab, setActiveTab] = useState<"TEACHER" | "STUDENT">("TEACHER");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      getTopUpPackagesAction().then((res) => {
        if (res.success && res.packages) {
          setPackages(res.packages as TopUpPackageUI[]);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredPackages = packages.filter((p) => p.creditType === activeTab);

  const handleBuyPackage = async (packageId: string) => {
    setLoadingId(packageId);
    setSuccessMsg(null);

    try {
      // 1. Crear intención de compra (el tenant se resuelve en servidor desde la sesión)
      const checkoutRes = await createTopUpCheckoutAction(undefined, packageId);

      if (!checkoutRes.success || !checkoutRes.checkoutUrl) {
        setSuccessMsg(checkoutRes.error || "No se pudo iniciar el pago.");
        return;
      }

      // 2. Payphone: ir al formulario de pago. Los créditos se acreditan al confirmar el pago.
      if (/^https?:\/\//.test(checkoutRes.checkoutUrl)) {
        window.location.href = checkoutRes.checkoutUrl;
        return;
      }

      // 3. Solo desarrollo (pagos simulados): confirmación inmediata
      if (checkoutRes.providerPaymentId) {
        const fulfillRes = await fulfillTopUpPurchaseAction(checkoutRes.providerPaymentId);
        if (fulfillRes.success) {
          setSuccessMsg(`¡Acreditados exitosamente ${fulfillRes.creditsGranted} créditos!`);
          if (onSuccess) onSuccess();
        }
      }
    } catch (err) {
      console.error("Error al procesar compra de créditos:", err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Encabezado */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Ampliar Créditos de IA
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Sin expiración
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Los paquetes Top-Up comprados se agregan a tu saldo y nunca caducan.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pestañas de Selección de Bolsa */}
        <div className="px-6 pt-4 border-b border-slate-800/60 flex gap-4">
          <button
            onClick={() => setActiveTab("TEACHER")}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "TEACHER"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Créditos de Profesor (Contenido)
          </button>

          <button
            onClick={() => setActiveTab("STUDENT")}
            className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "STUDENT"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Créditos de Estudiante (Tutor IA)
          </button>
        </div>

        {/* Notificación de Éxito */}
        {successMsg && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        {/* Grilla de Paquetes */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {filteredPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                pkg.popular
                  ? "bg-gradient-to-b from-blue-900/20 to-slate-900 border-blue-500/40 shadow-lg shadow-blue-500/5"
                  : "bg-slate-800/40 border-slate-800 hover:border-slate-700"
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase bg-blue-500 text-white shadow-md">
                  Más Popular
                </span>
              )}

              <div>
                <h3 className="text-sm font-bold text-white mb-1">{pkg.name}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                  {pkg.description}
                </p>

                <div className="mb-4">
                  <span className="text-2xl font-black text-white">${pkg.price}</span>
                  <span className="text-xs text-slate-500 ml-1">USD</span>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    + {pkg.credits} Créditos (${(pkg.price / pkg.credits).toFixed(2)}/cr)
                  </div>
                </div>
              </div>

              <button
                disabled={loadingId === pkg.id}
                onClick={() => handleBuyPackage(pkg.id)}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                  pkg.popular
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                } disabled:opacity-50`}
              >
                {loadingId === pkg.id ? (
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Comprar Créditos
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Footer Informativo */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Transacción segura
          </span>
          <span>Facturación instantánea</span>
        </div>
      </div>
    </div>
  );
}

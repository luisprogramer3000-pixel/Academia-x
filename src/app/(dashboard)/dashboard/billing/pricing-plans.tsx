"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { SAAS_PLANS, chargeInstallments } from "@/modules/billing/plans";
import type { BillingInterval } from "@prisma/client";
import { createCheckoutAction } from "@/app/actions/billing.actions";
import { toSubscriptionPlanCode, type SubscriptionPlanCode } from "@/modules/billing/subscription-plan-codes";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";

interface PricingPlansProps {
  currentPlanId: string | null;
  currentInterval?: BillingInterval;
  hasActiveSubscription?: boolean;
  /** Plan que el cliente eligió en la landing y llega por la URL */
  preselectedPlanId?: string;
  /** Payphone aprobó la tokenización: se ofrece guardar la tarjeta (con consentimiento) */
  tokenizationEnabled?: boolean;
  /** El plan vigente se paga con un Link de Suscripción (PayPhone lo renueva solo) */
  recurringLink?: boolean;
}

export function PricingPlans({
  currentPlanId,
  currentInterval = "MONTHLY",
  hasActiveSubscription = false,
  preselectedPlanId,
  tokenizationEnabled = false,
  recurringLink = false,
}: PricingPlansProps) {
  const { t: d } = useI18n();
  const t = d.billing.plans;
  const UNAVAILABLE = d.serverErrors.paymentUnavailable;
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(currentInterval);
  // Consentimiento explícito para guardar la tarjeta y cobrarla al vencer (exigido por Payphone)
  const [saveCard, setSaveCard] = useState(true);
  const isYearly = billingInterval === "YEARLY";
  // Link de Suscripción: plan que se está abriendo y mensaje para el usuario
  const [redirecting, setRedirecting] = useState<SubscriptionPlanCode | null>(null);
  const [linkMessage, setLinkMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  /** Pide al servidor el link del plan (solo se envía el código) y abre PayPhone. */
  const subscribe = async (planCode: SubscriptionPlanCode, changingPlan: boolean) => {
    if (redirecting) return;
    if (
      changingPlan &&
      !window.confirm(t.changeConfirm)
    ) {
      return;
    }
    setRedirecting(planCode);
    setLinkMessage(null);
    try {
      const res = await fetch("/api/payphone/subscription-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode }),
      });
      const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; error?: string };
      if (!res.ok || !data.checkoutUrl) {
        setLinkMessage({ tone: "error", text: data.error || UNAVAILABLE });
        setRedirecting(null);
        return;
      }
      setLinkMessage({ tone: "info", text: t.redirecting });
      window.location.assign(data.checkoutUrl);
    } catch {
      setLinkMessage({ tone: "error", text: UNAVAILABLE });
      setRedirecting(null);
    }
  };

  const formatPrice = (price: number, yearly: boolean) => {
    if (!yearly) return `$${price}`;
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="w-full">
      {/* Billing Interval Selector */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">{t.title}</h2>
          <p className="text-sm text-slate-400 mt-1">
            {t.subtitle}
          </p>
        </div>

        <div className="flex items-center p-1 rounded-2xl bg-slate-950/80 border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setBillingInterval("MONTHLY")}
            className={`px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm transition-all ${
              !isYearly
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.monthlyBilling}
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("YEARLY")}
            className={`px-5 py-2.5 rounded-xl font-medium text-xs sm:text-sm flex items-center gap-2 transition-all ${
              isYearly
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>{d.common.yearly}</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {t.save20}
            </span>
          </button>
        </div>
      </div>

      {linkMessage && (
        <div
          role="status"
          className={`mb-6 p-4 rounded-2xl text-sm flex items-center gap-2 ${
            linkMessage.tone === "info"
              ? "bg-blue-500/10 border border-blue-500/30 text-blue-300"
              : "bg-red-500/10 border border-red-500/30 text-red-300"
          }`}
        >
          {linkMessage.tone === "info" && <Loader2 className="w-4 h-4 animate-spin" />}
          {linkMessage.text}
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        {Object.values(SAAS_PLANS).map((p) => {
          const isCurrent = currentPlanId === p.id && currentInterval === billingInterval;
          const isPreselected = !isCurrent && preselectedPlanId === p.id;
          const pricing = p.pricing[billingInterval];

          // Formatear montos
          const displayPrice = formatPrice(pricing.price, isYearly);
          const periodSuffix = isYearly ? d.common.perYear : d.common.perMonth;
          const intervalLabel = isYearly ? d.common.yearly : d.common.monthly;

          const planCode = toSubscriptionPlanCode(p.id, billingInterval);
          const activeAutoRenew = isCurrent && recurringLink && Boolean(planCode);
          const buttonLabel = activeAutoRenew
            ? t.activeAutoRenew
            : isCurrent && planCode
            ? fmt(t.enableAutoRenew, { interval: intervalLabel })
            : isCurrent
            ? fmt(t.renewEarly, { interval: intervalLabel })
            : hasActiveSubscription
            ? fmt(t.changeTo, { plan: p.name, interval: intervalLabel })
            : p.id === "PRO"
            ? fmt(t.startPro, { interval: intervalLabel })
            : fmt(t.select, { plan: p.name, interval: intervalLabel });

          return (
            <div
              key={p.id}
              className={`p-8 rounded-3xl bg-slate-900 border flex flex-col justify-between transition-all relative ${
                isCurrent
                  ? "border-2 border-blue-500 shadow-xl shadow-blue-500/10"
                  : isPreselected
                  ? "border-2 border-emerald-500 shadow-xl shadow-emerald-500/10"
                  : p.id === "PRO"
                  ? "border-amber-500/50 shadow-xl shadow-amber-500/5"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              {isPreselected && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold uppercase tracking-wider border border-emerald-500/40 shadow-sm">
                  {t.chosen}
                </div>
              )}

              {p.id === "PRO" && !isPreselected && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider border border-amber-500/40 shadow-sm flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> {t.popular}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-white">{p.name}</h3>
                  {isCurrent && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono font-semibold border border-blue-500/20">
                      {t.current}
                    </span>
                  )}
                </div>

                {/* Price Display */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-white">{displayPrice}</span>
                    <span className="text-sm font-normal text-slate-400">{periodSuffix}</span>
                    {isYearly && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20 ml-auto">
                        {t.save20Badge}
                      </span>
                    )}
                  </div>

                  {isYearly && pricing.equivalentMonthlyPrice && (
                    <div className="mt-2 text-xs text-emerald-400 font-medium">
                      {fmt(t.equivalent, { price: `$${pricing.equivalentMonthlyPrice.toFixed(2)}` })}
                      <span className="text-slate-400 ml-1.5 block sm:inline">
                        {fmt(t.savePerYear, { amount: `$${pricing.annualSavings?.toFixed(2)}` })}
                      </span>
                    </div>
                  )}

                  {chargeInstallments(p.id, billingInterval) === 2 && (
                    <div className="mt-2 text-xs text-blue-300">
                      {fmt(t.installments, { amount: `$${(pricing.amountCents / 200).toFixed(2)}` })}
                    </div>
                  )}
                </div>

                <ul className="space-y-3 text-xs text-slate-300 mb-8">
                  {(t.features[p.id] ?? p.features).map((feat, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" /> {feat}
                    </li>
                  ))}
                </ul>
              </div>

              {planCode ? (
                <button
                  type="button"
                  disabled={activeAutoRenew || redirecting !== null}
                  onClick={() => subscribe(planCode, recurringLink && hasActiveSubscription && !isCurrent)}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
                    activeAutoRenew
                      ? "bg-slate-800 text-slate-400"
                      : isCurrent
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                      : p.id === "PRO"
                      ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 font-bold disabled:opacity-60"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 disabled:opacity-60"
                  }`}
                >
                  {redirecting === planCode && <Loader2 className="w-4 h-4 animate-spin" />}
                  {redirecting === planCode ? t.redirecting : buttonLabel}
                </button>
              ) : (
              <form action={createCheckoutAction}>
                <input type="hidden" name="planId" value={p.id} />
                <input type="hidden" name="billingInterval" value={billingInterval} />
                <input type="hidden" name="saveCard" value={tokenizationEnabled && saveCard ? "1" : "0"} />
                <button
                  type="submit"
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    isCurrent
                      ? "bg-slate-800 hover:bg-slate-700 text-slate-200"
                      : p.id === "PRO"
                      ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 font-bold"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30"
                  }`}
                >
                  {buttonLabel}
                </button>
              </form>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 space-y-3 text-xs text-slate-400">
        {tokenizationEnabled && toSubscriptionPlanCode("ACADEMY", billingInterval) === null && (
          <label className="flex items-start gap-2.5 cursor-pointer max-w-3xl">
            <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} className="mt-0.5 w-4 h-4 accent-blue-600" />
            <span>{t.saveCardConsent}</span>
          </label>
        )}
        <p>
          {fmt(t.footer, { every: isYearly ? d.common.everyYear : d.common.everyMonth })}
          {isYearly && t.footerAcademyYearly}
        </p>
      </div>
    </div>
  );
}

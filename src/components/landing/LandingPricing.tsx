"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles } from "lucide-react";
import { SAAS_PLANS } from "@/modules/billing/plans";
import type { BillingInterval } from "@prisma/client";
import { useI18n } from "@/i18n/client";
import { fmt } from "@/i18n/format";

export function LandingPricing() {
  const { t: d } = useI18n();
  const t = d.landingPricing;
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("MONTHLY");
  const isYearly = billingInterval === "YEARLY";
  const intervalLabel = isYearly ? d.common.yearly : d.common.monthly;

  const starter = SAAS_PLANS.STARTER.pricing[billingInterval];
  const pro = SAAS_PLANS.PRO.pricing[billingInterval];
  const academy = SAAS_PLANS.ACADEMY.pricing[billingInterval];

  const formatPrice = (price: number, yearly: boolean) => {
    if (!yearly) return `$${price}`;
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="w-full">
      {/* Billing Interval Selector */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex items-center p-1.5 rounded-2xl glass-panel border border-amber-500/30 shadow-lg">
          <button
            type="button"
            onClick={() => setBillingInterval("MONTHLY")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              !isYearly
                ? "gold-gradient-bg text-slate-950 shadow-md shadow-amber-500/20"
                : "text-subtle-custom hover:text-main"
            }`}
          >
            {t.monthlyBilling}
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("YEARLY")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all ${
              isYearly
                ? "gold-gradient-bg text-slate-950 shadow-md shadow-amber-500/20"
                : "text-subtle-custom hover:text-main"
            }`}
          >
            <span>{d.common.yearly}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                isYearly
                  ? "bg-slate-950/80 text-amber-300 border border-amber-400/40"
                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              }`}
            >
              {t.save20}
            </span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 items-stretch">
        {/* Starter Plan */}
        <div className="p-8 rounded-2xl glass-panel border border-amber-500/30 flex flex-col justify-between hover:border-amber-500/60 transition-all relative">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-main">Starter</h3>
              {isYearly && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                  {t.save20Badge}
                </span>
              )}
            </div>
            <p className="text-subtle-custom text-sm mb-6 font-medium">
              {t.starterDesc}
            </p>
            <div className="mb-6">
              <div className="text-4xl font-extrabold gold-gradient-text">
                {formatPrice(starter.price, isYearly)}{" "}
                <span className="text-base font-normal text-subtle-custom">
                  {isYearly ? d.common.perYear : d.common.perMonth}
                </span>
              </div>
              {isYearly && starter.equivalentMonthlyPrice && (
                <div className="mt-2 text-xs text-emerald-400 font-medium">
                  {fmt(t.equivalent, { price: `$${starter.equivalentMonthlyPrice.toFixed(2)}` })}
                  <span className="text-subtle-custom block mt-0.5">
                    {fmt(t.savePerYear, { amount: `$${starter.annualSavings?.toFixed(2)}` })}
                  </span>
                </div>
              )}
            </div>
            <ul className="space-y-3.5 text-sm text-muted-custom font-medium mb-8">
              {t.starterFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-gold-custom shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={`/register?plan=STARTER&interval=${billingInterval}&billingInterval=${billingInterval}`}
            className="w-full text-center py-3.5 rounded-xl glass-panel border border-amber-500/40 hover:border-amber-500 text-main font-semibold transition-all block"
          >
            {fmt(t.selectStarter, { interval: intervalLabel })}
          </Link>
        </div>

        {/* Pro Plan (Highlighted VIP) */}
        <div className="p-8 rounded-2xl glass-gold-card border-2 border-amber-500/80 relative flex flex-col justify-between shadow-2xl shadow-amber-500/20 transform md:-translate-y-2">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gold-gradient-bg text-slate-950 text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> {t.popular}
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-2xl font-extrabold text-main">Professional VIP</h3>
              {isYearly && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                  {t.save20Badge}
                </span>
              )}
            </div>
            <p className="text-muted-custom text-sm mb-6 font-medium">
              {t.proDesc}
            </p>
            <div className="mb-6">
              <div className="text-4xl font-extrabold gold-gradient-text">
                {formatPrice(pro.price, isYearly)}{" "}
                <span className="text-base font-normal text-subtle-custom">
                  {isYearly ? d.common.perYear : d.common.perMonth}
                </span>
              </div>
              {isYearly && pro.equivalentMonthlyPrice && (
                <div className="mt-2 text-xs text-emerald-400 font-medium">
                  {fmt(t.equivalent, { price: `$${pro.equivalentMonthlyPrice.toFixed(2)}` })}
                  <span className="text-subtle-custom block mt-0.5">
                    {fmt(t.savePerYear, { amount: `$${pro.annualSavings?.toFixed(2)}` })}
                  </span>
                </div>
              )}
            </div>
            <ul className="space-y-3.5 text-sm text-main font-semibold mb-8">
              {t.proFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-gold-custom shrink-0" />
                  {i === 0 ? <span className="font-bold">{f}</span> : <span>{f}</span>}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={`/register?plan=PRO&interval=${billingInterval}&billingInterval=${billingInterval}`}
            className="w-full text-center py-3.5 rounded-xl gold-gradient-bg text-slate-950 font-bold transition-all shadow-lg shadow-amber-500/30 block"
          >
            {fmt(t.startPro, { interval: intervalLabel })}
          </Link>
        </div>

        {/* Academy Plan */}
        <div className="p-8 rounded-2xl glass-panel border border-amber-500/30 flex flex-col justify-between hover:border-sky-500/50 transition-all relative">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-main">Academy Executive</h3>
              {isYearly && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                  {t.save20Badge}
                </span>
              )}
            </div>
            <p className="text-subtle-custom text-sm mb-6 font-medium">
              {t.academyDesc}
            </p>
            <div className="mb-6">
              <div className="text-4xl font-extrabold cyan-gradient-text">
                {formatPrice(academy.price, isYearly)}{" "}
                <span className="text-base font-normal text-subtle-custom">
                  {isYearly ? d.common.perYear : d.common.perMonth}
                </span>
              </div>
              {isYearly && academy.equivalentMonthlyPrice && (
                <div className="mt-2 text-xs text-emerald-400 font-medium">
                  {fmt(t.equivalent, { price: `$${academy.equivalentMonthlyPrice.toFixed(2)}` })}
                  <span className="text-subtle-custom block mt-0.5">
                    {fmt(t.savePerYear, { amount: `$${academy.annualSavings?.toFixed(2)}` })}
                  </span>
                </div>
              )}
            </div>
            <ul className="space-y-3.5 text-sm text-muted-custom font-medium mb-8">
              {t.academyFeatures.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-sky-custom shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={`/register?plan=ACADEMY&interval=${billingInterval}&billingInterval=${billingInterval}`}
            className="w-full text-center py-3.5 rounded-xl glass-panel border border-amber-500/40 hover:border-sky-500 text-main font-semibold transition-all block"
          >
            {fmt(t.selectAcademy, { interval: intervalLabel })}
          </Link>
        </div>
      </div>
    </div>
  );
}

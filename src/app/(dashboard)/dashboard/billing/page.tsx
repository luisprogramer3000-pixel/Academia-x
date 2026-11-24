import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { BillingService } from "@/modules/billing/billing.service";
import { SAAS_PLANS } from "@/modules/billing/plans";
import { createCheckoutAction, removeSavedCardAction, setAutoRenewAction } from "@/app/actions/billing.actions";
import { PricingPlans } from "./pricing-plans";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { isTokenizationEnabled } from "@/lib/payphone";
import { CreditCard, CheckCircle2, Users, Sparkles, RefreshCw, AlertTriangle, XCircle, Receipt } from "lucide-react";
import { formatInTimezone } from "@/lib/timezone";
import { toSubscriptionPlanCode } from "@/modules/billing/subscription-plan-codes";
import { getI18n } from "@/i18n/server";
import { fmt, rich } from "@/i18n/format";
import { LOCALE_INTL } from "@/i18n/config";

const longDate = { day: "numeric", month: "long", year: "numeric" } as const;

interface BillingPageProps {
  searchParams: Promise<{ checkout?: string; message?: string; welcome?: string; inactive?: string; plan?: string; interval?: string; billingInterval?: string }>;
}

export default async function BillingDashboardPage({ searchParams }: BillingPageProps) {
  const { checkout, message, welcome, inactive, plan, interval, billingInterval: intervalParam } = await searchParams;

  // El plan elegido en la landing viaja en la URL: se preselecciona aquí para
  // que el cliente no tenga que volver a decidir lo que ya decidió.
  const requestedPlanId = plan && plan.toUpperCase() in SAAS_PLANS ? plan.toUpperCase() : undefined;
  const requestedIntervalRaw = (interval || intervalParam || "").toUpperCase();
  const requestedInterval =
    requestedIntervalRaw === "YEARLY" || requestedIntervalRaw === "MONTHLY"
      ? (requestedIntervalRaw as "MONTHLY" | "YEARLY")
      : undefined;
  const ctx = await getDashboardContext(OWNER_ONLY, { requirePlan: false });
  const { locale, t: d } = await getI18n();
  const t = d.billing;
  const intl = LOCALE_INTL[locale];
  const intervalName = (i: string | null | undefined) => (i === "YEARLY" ? d.common.yearlyLower : d.common.monthlyLower);
  const every = (i: string | null | undefined) => (i === "YEARLY" ? d.common.everyYear : d.common.everyMonth);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  const billingInfo = await BillingService.getTenantSubscriptionInfo(tenantId);
  const walletSummary = await AICreditEngine.getTenantWalletSummary(tenantId);
  const active = billingInfo.active;
  const card = billingInfo.card;
  const tokenization = isTokenizationEnabled();
  // Cortesía / simulada: no se paga con Payphone, no hay renovación que gestionar
  const paidWithPayphone = Boolean(active?.externalId?.startsWith("pp_"));
  const courtesy = Boolean(active?.externalId?.startsWith("sub_internal_"));
  // Plan pagado con Link de Suscripción: PayPhone lo cobra solo cada periodo
  const recurringLink = billingInfo.recurringLink;
  const pendingLink = billingInfo.pendingLink;
  // Academy Executive anual (Cajita en dos pagos): parte 1 pagada; la parte 2 se habilita 24 h después
  const secondInstallment = billingInfo.pendingSecondInstallment;
  const secondAvailableAt = secondInstallment?.availableAt ?? null;
  const secondReady = secondAvailableAt ? secondAvailableAt.getTime() <= Date.now() : false;
  // Los 5 planes con link no se renuevan con la Cajita (Academy anual sí)
  const canRenewWithButton = Boolean(active) && !toSubscriptionPlanCode(active!.planId, active!.billingInterval);
  const autoCharge = recurringLink || (paidWithPayphone && Boolean(card) && Boolean(active?.autoRenew) && tokenization);
  const statusLabel: Record<string, string> = t.status;
  const usd = (cents: number) => (cents / 100).toLocaleString(intl, { style: "currency", currency: "USD" });
  const date = (value: Date, opts: Intl.DateTimeFormatOptions = longDate) => formatInTimezone(value, academy.timezone, opts, intl);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
              <CreditCard className="w-7 h-7 text-blue-400" /> {t.title}
            </h1>
            <p className="text-slate-400 text-sm">
              {t.subtitle}
            </p>
          </div>

          {inactive && !welcome && !active && (
            <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
              {t.inactive}
            </div>
          )}

          {welcome && !active && (
            <div className="mb-8 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
              {rich(t.welcome, { name: <strong>{name}</strong> })}
            </div>
          )}

          {checkout === "success" && (
            <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {active
                  ? rich(t.paymentConfirmed, { plan: <strong>{active.plan.name}</strong> })
                  : t.paymentReceived}
              </span>
            </div>
          )}

          {pendingLink && !(active && active.planId === pendingLink.planId && active.billingInterval === pendingLink.billingInterval && recurringLink) && (
            <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
              {rich(t.pendingLink, {
                plan: <strong>{SAAS_PLANS[pendingLink.planId ?? ""]?.name ?? pendingLink.planId}</strong>,
                interval: intervalName(pendingLink.billingInterval),
              })}
            </div>
          )}

          {secondInstallment && secondAvailableAt && (
            <div className="mb-8 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-sm flex flex-col gap-3">
              <span>
                {rich(t.secondInstallment, {
                  plan: <strong>{SAAS_PLANS[secondInstallment.planId ?? ""]?.name ?? secondInstallment.planId}</strong>,
                  amount: usd(secondInstallment.amountCents),
                })}{" "}
                {secondReady
                  ? t.secondReady
                  : fmt(t.secondAvailableAt, { date: date(secondAvailableAt, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) })}
              </span>
              <form action={createCheckoutAction}>
                <input type="hidden" name="planId" value={secondInstallment.planId} />
                <input type="hidden" name="billingInterval" value={secondInstallment.billingInterval} />
                <button
                  type="submit"
                  disabled={!secondReady}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-white"
                >
                  {fmt(t.paySecond, { amount: usd(secondInstallment.amountCents) })}
                </button>
              </form>
            </div>
          )}

          {checkout === "canceled" && (
            <div className="mb-8 p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-sm">
              {t.canceled}
            </div>
          )}

          {checkout === "error" && (
            <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{message || t.error}</span>
            </div>
          )}

          {active?.status === "past_due" && (
            <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {t.pastDue}
            </div>
          )}

          {/* Current Active Plan Overview */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">{t.currentPlan}</span>
                {active ? (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">{active.plan.name}</h2>
                    <div className="text-3xl font-extrabold text-blue-400 mb-2">
                      ${active.plan.pricing[active.billingInterval].price}{" "}
                      <span className="text-xs text-slate-400 font-normal">{active.billingInterval === "YEARLY" ? d.common.perYear : d.common.perMonth}</span>
                    </div>
                    <span className="text-xs text-slate-400 block">
                      {courtesy
                        ? t.courtesy
                        : fmt(autoCharge ? t.renewsOn : t.expiresOn, { date: date(active.currentPeriodEnd) })}
                    </span>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">{t.noPlan}</h2>
                    <p className="text-xs text-slate-400">{t.noPlanHint}</p>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs flex items-center gap-1 ${active?.status === "active" ? "text-emerald-400" : "text-amber-400"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> {statusLabel[active?.status ?? billingInfo.latestStatus ?? ""] ?? t.status.none}
                </span>
                {active && paidWithPayphone && canRenewWithButton && (
                  <form action={createCheckoutAction}>
                    <input type="hidden" name="planId" value={active.planId} />
                    <input type="hidden" name="billingInterval" value={active.billingInterval} />
                    <button type="submit" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> {t.renewNow}
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.studentUsage}</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                {billingInfo.usage.studentsCount} <span className="text-xs font-normal text-slate-400">/ {billingInfo.usage.maxStudents} {t.max}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${billingInfo.usage.maxStudents ? Math.min(100, (billingInfo.usage.studentsCount / billingInfo.usage.maxStudents) * 100) : 0}%` }}
                />
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t.teacherCredits}</span>
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                {walletSummary.teacherCredits.available} <span className="text-xs font-normal text-slate-400">/ {walletSummary.teacherCredits.monthlyAllowance} {t.available}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden font-mono text-[10px]">
                <div
                  className={`h-full rounded-full transition-all ${
                    walletSummary.teacherCredits.usagePercentage >= 90
                      ? "bg-red-500"
                      : walletSummary.teacherCredits.usagePercentage >= 70
                      ? "bg-amber-500"
                      : "bg-purple-500"
                  }`}
                  style={{ width: `${Math.max(5, walletSummary.teacherCredits.usagePercentage)}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400 block mt-2 font-mono">
                {fmt(t.usedThisMonth, { count: walletSummary.teacherCredits.usedThisMonth })}
              </span>
            </div>
          </div>

          {/* Método de pago (Payphone) */}
          {paidWithPayphone && (
            <div className="mb-12 p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-blue-400" /> {t.paymentMethod}
              </h2>
              {recurringLink ? (
                <p className="text-xs text-slate-400 mt-1">
                  {fmt(t.linkMethod, { every: every(active?.billingInterval) })}
                </p>
              ) : card && tokenization ? (
                <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
                  <div>
                    <p className="text-sm text-white font-semibold">
                      {fmt(t.cardEnding, { brand: card.cardBrand || t.card, digits: card.lastDigits?.replace(/\D/g, "") || "••••" })}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {active?.autoRenew
                        ? t.autoOn
                        : t.autoOff}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={setAutoRenewAction}>
                      <input type="hidden" name="enabled" value={active?.autoRenew ? "0" : "1"} />
                      <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white">
                        {active?.autoRenew ? t.disableAuto : t.enableAuto}
                      </button>
                    </form>
                    <form action={removeSavedCardAction}>
                      <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-600 text-xs font-semibold text-white flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> {t.removeCard}
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-1">
                  {fmt(t.manualMethod, { every: every(active?.billingInterval) })}
                  {tokenization && t.manualSaveCard}
                </p>
              )}
            </div>
          )}

          {billingInfo.payments.length > 0 && (
            <div className="mb-12 p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <Receipt className="w-4 h-4 text-blue-400" /> {t.history}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <th className="py-2 font-semibold">{t.colDate}</th>
                      <th className="py-2 font-semibold">{t.colConcept}</th>
                      <th className="py-2 font-semibold">{t.colCard}</th>
                      <th className="py-2 font-semibold text-right">{t.colAmount}</th>
                      <th className="py-2 font-semibold text-right">{t.colStatus}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingInfo.payments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/70">
                        <td className="py-2.5 text-slate-300 whitespace-nowrap">{date(p.createdAt)}</td>
                        <td className="py-2.5 text-white">
                          {p.kind === "TOPUP"
                            ? t.aiCredits
                            : fmt(t.planConcept, { plan: SAAS_PLANS[p.planId ?? ""]?.name ?? p.planId ?? "", interval: intervalName(p.billingInterval) })}
                          {p.method === "TOKEN" && <span className="text-xs text-slate-500"> · {t.autoCharge}</span>}
                          {p.method === "LINK" && <span className="text-xs text-slate-500"> · {t.payphoneSubscription}</span>}
                        </td>
                        <td className="py-2.5 text-slate-400">{p.cardBrand ? `${p.cardBrand} ${p.lastDigits ?? ""}` : "—"}</td>
                        <td className="py-2.5 text-right text-white tabular-nums">{usd(p.amountCents)}</td>
                        <td className="py-2.5 text-right">
                          {p.status === "APPROVED" ? (
                            <span className="text-emerald-400 text-xs font-semibold">{t.approved}</span>
                          ) : (
                            <span className="text-red-400 text-xs font-semibold" title={p.failureReason ?? undefined}>{t.rejected}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                {rich(t.pricesNote, {
                  refunds: <a href="/refunds" target="_blank" className="underline hover:text-slate-300">{d.common.refunds}</a>,
                })}
              </p>
            </div>
          )}

          {/* SaaS Plans Selector with Monthly / Yearly Toggle */}
          <PricingPlans
            currentPlanId={active?.planId ?? null}
            currentInterval={requestedInterval ?? billingInfo.billingInterval}
            hasActiveSubscription={Boolean(active)}
            preselectedPlanId={requestedPlanId}
            tokenizationEnabled={tokenization}
            recurringLink={recurringLink}
          />
        </main>
      </div>
    </div>
  );
}

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
  const autoCharge = paidWithPayphone && Boolean(card) && Boolean(active?.autoRenew) && tokenization;
  const statusLabel: Record<string, string> = { active: "Activo", trialing: "En prueba", past_due: "Vencido (en gracia)", canceled: "Cancelado" };
  const usd = (cents: number) => (cents / 100).toLocaleString("es", { style: "currency", currency: "USD" });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
              <CreditCard className="w-7 h-7 text-blue-400" /> Facturación & Suscripción SaaS
            </h1>
            <p className="text-slate-400 text-sm">
              Administra tu plan activo, consulta el uso de estudiantes e Inteligencia Artificial o escala tu suscripción.
            </p>
          </div>

          {inactive && !welcome && !active && (
            <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
              Tu academia no tiene una suscripción activa. Activa o renueva un plan para volver a usar el panel, la IA y el campus de alumnos.
            </div>
          )}

          {welcome && !active && (
            <div className="mb-8 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-sm">
              ¡Tu academia <strong>{name}</strong> fue creada! Elige un plan para activar tu academia y comenzar a crear cursos.
            </div>
          )}

          {checkout === "success" && (
            <div className="mb-8 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {active
                  ? <>¡Pago confirmado! Tu plan <strong>{active.plan.name}</strong> está activo.</>
                  : "Pago recibido. Estamos activando tu plan; recarga la página en un momento."}
              </span>
            </div>
          )}

          {checkout === "canceled" && (
            <div className="mb-8 p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-sm">
              El pago fue cancelado o rechazado. No se realizó ningún cargo.
            </div>
          )}

          {checkout === "error" && (
            <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{message || "No pudimos confirmar el pago con Payphone. Si se te cobró, escríbenos a info@mentorstudioglobal.com."}</span>
            </div>
          )}

          {active?.status === "past_due" && (
            <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              Tu plan venció y no se pudo renovar. Renuévalo ahora para no perder el acceso al terminar los días de gracia.
            </div>
          )}

          {/* Current Active Plan Overview */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Plan Actual</span>
                {active ? (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">{active.plan.name}</h2>
                    <div className="text-3xl font-extrabold text-blue-400 mb-2">
                      ${active.plan.pricing[active.billingInterval].price}{" "}
                      <span className="text-xs text-slate-400 font-normal">/{active.billingInterval === "YEARLY" ? "año" : "mes"}</span>
                    </div>
                    <span className="text-xs text-slate-400 block">
                      {courtesy
                        ? "Plan de cortesía sin vencimiento"
                        : `${autoCharge ? "Se renueva" : "Vence"} el ${formatInTimezone(active.currentPeriodEnd, academy.timezone, longDate)}`}
                    </span>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">Sin plan activo</h2>
                    <p className="text-xs text-slate-400">Elige un plan para activar tu academia.</p>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs flex items-center gap-1 ${active?.status === "active" ? "text-emerald-400" : "text-amber-400"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> {statusLabel[active?.status ?? billingInfo.latestStatus ?? ""] ?? "Sin plan"}
                </span>
                {active && paidWithPayphone && (
                  <form action={createCheckoutAction}>
                    <input type="hidden" name="planId" value={active.planId} />
                    <input type="hidden" name="billingInterval" value={active.billingInterval} />
                    <button type="submit" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> Renovar ahora
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Uso de Estudiantes</span>
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                {billingInfo.usage.studentsCount} <span className="text-xs font-normal text-slate-400">/ {billingInfo.usage.maxStudents} máx</span>
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
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Créditos de Profesor IA</span>
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white mb-2">
                {walletSummary.teacherCredits.available} <span className="text-xs font-normal text-slate-400">/ {walletSummary.teacherCredits.monthlyAllowance} dispon.</span>
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
                Usados este mes: {walletSummary.teacherCredits.usedThisMonth} cr
              </span>
            </div>
          </div>

          {/* Método de pago (Payphone) */}
          {paidWithPayphone && (
            <div className="mb-12 p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-blue-400" /> Forma de pago
              </h2>
              {card && tokenization ? (
                <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
                  <div>
                    <p className="text-sm text-white font-semibold">
                      {card.cardBrand || "Tarjeta"} terminada en {card.lastDigits?.replace(/\D/g, "") || "••••"}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {active?.autoRenew
                        ? "Cobro automático activado: la cobraremos al vencer tu plan."
                        : "Cobro automático desactivado: te avisaremos para renovar a mano."}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={setAutoRenewAction}>
                      <input type="hidden" name="enabled" value={active?.autoRenew ? "0" : "1"} />
                      <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white">
                        {active?.autoRenew ? "Desactivar cobro automático" : "Activar cobro automático"}
                      </button>
                    </form>
                    <form action={removeSavedCardAction}>
                      <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-600 text-xs font-semibold text-white flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> Quitar tarjeta
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-1">
                  Pagas cada {active?.billingInterval === "YEARLY" ? "año" : "mes"} con Payphone. Te avisaremos por el panel y por correo 7, 3 y 1 días antes de que venza tu plan.
                  {tokenization && " Al renovar, puedes guardar tu tarjeta para que el cobro sea automático."}
                </p>
              )}
            </div>
          )}

          {billingInfo.payments.length > 0 && (
            <div className="mb-12 p-6 rounded-2xl bg-slate-900 border border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <Receipt className="w-4 h-4 text-blue-400" /> Historial de pagos
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <th className="py-2 font-semibold">Fecha</th>
                      <th className="py-2 font-semibold">Concepto</th>
                      <th className="py-2 font-semibold">Tarjeta</th>
                      <th className="py-2 font-semibold text-right">Importe</th>
                      <th className="py-2 font-semibold text-right">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingInfo.payments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/70">
                        <td className="py-2.5 text-slate-300 whitespace-nowrap">{formatInTimezone(p.createdAt, academy.timezone, longDate)}</td>
                        <td className="py-2.5 text-white">
                          {p.kind === "TOPUP"
                            ? "Créditos de IA"
                            : `Plan ${SAAS_PLANS[p.planId ?? ""]?.name ?? p.planId} (${p.billingInterval === "YEARLY" ? "anual" : "mensual"})`}
                          {p.method === "TOKEN" && <span className="text-xs text-slate-500"> · cobro automático</span>}
                        </td>
                        <td className="py-2.5 text-slate-400">{p.cardBrand ? `${p.cardBrand} ${p.lastDigits ?? ""}` : "—"}</td>
                        <td className="py-2.5 text-right text-white tabular-nums">{usd(p.amountCents)}</td>
                        <td className="py-2.5 text-right">
                          {p.status === "APPROVED" ? (
                            <span className="text-emerald-400 text-xs font-semibold">Aprobado</span>
                          ) : (
                            <span className="text-red-400 text-xs font-semibold" title={p.failureReason ?? undefined}>Rechazado</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 mt-3">
                Precios en dólares con IVA incluido. Pagos procesados por Payphone. Consulta la{" "}
                <a href="/refunds" target="_blank" className="underline hover:text-slate-300">Política de Reembolsos</a>.
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
          />
        </main>
      </div>
    </div>
  );
}

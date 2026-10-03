import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { BillingService } from "@/modules/billing/billing.service";
import { SAAS_PLANS } from "@/modules/billing/plans";
import { openBillingPortalAction } from "@/app/actions/billing.actions";
import { PricingPlans } from "./pricing-plans";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { CreditCard, CheckCircle2, Users, Sparkles, ArrowUpRight } from "lucide-react";

interface BillingPageProps {
  searchParams: Promise<{ checkout?: string; welcome?: string; inactive?: string; plan?: string; interval?: string; billingInterval?: string }>;
}

export default async function BillingDashboardPage({ searchParams }: BillingPageProps) {
  const { checkout, welcome, inactive, plan, interval, billingInterval: intervalParam } = await searchParams;

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
  const hasStripeCustomer = Boolean(active?.stripeCustomerId && !active.stripeCustomerId.startsWith("cus_simulated"));

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
                  : "Pago recibido. Estamos confirmando tu suscripción con Stripe; esto puede tardar unos segundos. Recarga la página en un momento."}
              </span>
            </div>
          )}

          {checkout === "canceled" && (
            <div className="mb-8 p-4 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 text-sm">
              El pago fue cancelado. No se realizó ningún cargo.
            </div>
          )}

          {active?.status === "past_due" && (
            <div className="mb-8 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              No pudimos cobrar tu último pago. Actualiza tu método de pago para evitar la suspensión del servicio.
            </div>
          )}

          {active?.cancelAtPeriodEnd && (
            <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              Tu suscripción se cancelará el {active.currentPeriodEnd.toLocaleDateString("es-ES")}. Puedes reactivarla desde el portal de facturación.
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
                      Próxima renovación: {active.currentPeriodEnd.toLocaleDateString("es-ES")}
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
                <span className={`text-xs font-mono flex items-center gap-1 ${active ? "text-emerald-400" : "text-amber-400"}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Estado: {active?.status ?? billingInfo.latestStatus ?? "inactivo"}
                </span>
                {hasStripeCustomer && (
                  <form action={openBillingPortalAction}>
                    <button type="submit" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      Gestionar <ArrowUpRight className="w-3.5 h-3.5" />
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

          {/* SaaS Plans Selector with Monthly / Yearly Toggle */}
          <PricingPlans
            currentPlanId={active?.planId ?? null}
            currentInterval={requestedInterval ?? billingInfo.billingInterval}
            hasActiveSubscription={Boolean(active)}
            preselectedPlanId={requestedPlanId}
          />
        </main>
      </div>
    </div>
  );
}

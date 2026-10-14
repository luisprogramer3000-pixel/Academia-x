import { prisma } from "@/lib/db";
import { SAAS_PLANS, type PlanConfig } from "./plans";
import { ACCESS_GRANTING_STATUSES, PAST_DUE_GRACE_DAYS } from "./billing.service";

/**
 * Ventas de la plataforma para el administrador (/dashboard/admin/sales).
 *
 * Lee las tablas Subscription y Payment (pagos con Payphone confirmados por la
 * aplicación). Cada academia cuenta por su suscripción más reciente (la misma
 * regla que da acceso).
 * Las suscripciones internas (cortesía, sub_internal_*) y las simuladas de
 * desarrollo (sub_simulated_*) dan acceso pero no suman ingresos.
 */

export type SaleKind = "payphone" | "internal" | "simulated";
export type SaleState = "active" | "trialing" | "past_due" | "canceling" | "canceled" | "expired";

export interface SaleRow {
  id: string;
  tenantId: string;
  academy: string;
  slug: string;
  ownerEmail: string | null;
  planId: string;
  planName: string;
  interval: "MONTHLY" | "YEARLY";
  /** Cobro automático con tarjeta guardada activo */
  autoCharge: boolean;
  /** Lo que se cobra en cada renovación (USD) */
  amount: number;
  /** Equivalente mensual (anual / 12) para el MRR */
  monthly: number;
  status: string;
  state: SaleState;
  kind: SaleKind;
  currentPeriodEnd: string;
  createdAt: string;
}

export interface MonthPoint {
  /** "2026-10" */
  key: string;
  /** "oct 26" */
  label: string;
  value: number;
}

const DAY = 24 * 60 * 60 * 1000;

function kindOf(externalId: string | null): SaleKind {
  if (externalId?.startsWith("pp_")) return "payphone";
  if (externalId?.startsWith("sub_internal_")) return "internal";
  return "simulated";
}

function stateOf(s: { status: string; currentPeriodEnd: Date; cancelAtPeriodEnd: boolean }, now: number): SaleState {
  const end = s.currentPeriodEnd.getTime();
  const graceEnd = end + PAST_DUE_GRACE_DAYS * DAY;
  if (s.status === "past_due") return graceEnd > now ? "past_due" : "expired";
  if (ACCESS_GRANTING_STATUSES.includes(s.status)) {
    if (graceEnd <= now) return "expired";
    if (s.cancelAtPeriodEnd) return "canceling";
    return s.status === "trialing" ? "trialing" : "active";
  }
  return "canceled";
}

/** Los últimos `count` meses (el actual incluido), del más antiguo al más reciente. */
function lastMonths(count: number): MonthPoint[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1));
    return {
      key: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("es", { month: "short", year: "2-digit", timeZone: "UTC" }).replace(".", ""),
      value: 0,
    };
  });
}

export class SalesAnalyticsService {
  static async getOverview() {
    const now = Date.now();
    const yearAgo = new Date(now - 366 * DAY);

    const [subscriptions, tenantsTotal, tenantsRecent, topUps, owners, payments] = await Promise.all([
      prisma.subscription.findMany({
        orderBy: { updatedAt: "desc" },
        select: {
          id: true, tenantId: true, planId: true, billingInterval: true, status: true, currentPeriodEnd: true,
          cancelAtPeriodEnd: true, createdAt: true, externalId: true, autoRenew: true,
          tenant: { select: { name: true, slug: true, paymentCard: { select: { id: true } } } },
        },
      }),
      prisma.tenant.count(),
      prisma.tenant.findMany({ where: { createdAt: { gte: yearAgo } }, select: { createdAt: true } }),
      prisma.aICreditPurchase.findMany({
        where: { status: "COMPLETED" },
        select: { priceAmount: true, createdAt: true, provider: true },
      }),
      prisma.membership.findMany({
        where: { role: "OWNER" },
        orderBy: { createdAt: "asc" },
        select: { tenantId: true, user: { select: { email: true } } },
      }),
      // Lo cobrado de verdad con Payphone (planes y créditos), últimos 12 meses
      prisma.payment.findMany({
        where: { status: "APPROVED", createdAt: { gte: yearAgo } },
        select: { amountCents: true, createdAt: true, kind: true },
      }),
    ]);

    const ownerOf = new Map<string, string>();
    for (const o of owners) if (!ownerOf.has(o.tenantId)) ownerOf.set(o.tenantId, o.user.email);

    // Una fila por academia: su suscripción más reciente
    const seen = new Set<string>();
    const rows: SaleRow[] = [];
    for (const s of subscriptions) {
      if (seen.has(s.tenantId)) continue;
      seen.add(s.tenantId);
      const plan: PlanConfig | undefined = SAAS_PLANS[s.planId?.toUpperCase()];
      const pricing = plan?.pricing[s.billingInterval];
      const amount = pricing ? pricing.amountCents / 100 : 0;
      const kind = kindOf(s.externalId);
      rows.push({
        id: s.id,
        tenantId: s.tenantId,
        academy: s.tenant.name,
        slug: s.tenant.slug,
        ownerEmail: ownerOf.get(s.tenantId) ?? null,
        planId: plan?.id ?? s.planId,
        planName: plan?.name ?? s.planId,
        interval: s.billingInterval,
        amount,
        monthly: s.billingInterval === "YEARLY" ? amount / 12 : amount,
        status: s.status,
        state: stateOf(s, now),
        kind,
        currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        createdAt: s.createdAt.toISOString(),
        autoCharge: kind === "payphone" && s.autoRenew && Boolean(s.tenant.paymentCard),
      });
    }

    const live = (r: SaleRow) => r.state === "active" || r.state === "trialing" || r.state === "past_due" || r.state === "canceling";
    const paying = rows.filter((r) => live(r) && r.kind === "payphone" && r.state !== "trialing");
    const mrr = paying.reduce((acc, r) => acc + r.monthly, 0);

    const byPlan = Object.values(SAAS_PLANS).map((p) => {
      const inPlan = rows.filter((r) => live(r) && r.planId === p.id);
      return {
        id: p.id,
        name: p.name,
        count: inPlan.length,
        mrr: inPlan.filter((r) => r.kind === "payphone" && r.state !== "trialing").reduce((acc, r) => acc + r.monthly, 0),
      };
    });

    const stateCounts = rows.reduce<Record<SaleState, number>>(
      (acc, r) => ({ ...acc, [r.state]: acc[r.state] + 1 }),
      { active: 0, trialing: 0, past_due: 0, canceling: 0, canceled: 0, expired: 0 }
    );

    // Altas por mes: primera suscripción de cada academia
    const firstSub = new Map<string, Date>();
    for (const s of subscriptions) {
      const prev = firstSub.get(s.tenantId);
      if (!prev || s.createdAt < prev) firstSub.set(s.tenantId, s.createdAt);
    }
    const newSubs = lastMonths(12);
    for (const d of firstSub.values()) {
      const point = newSubs.find((m) => m.key === d.toISOString().slice(0, 7));
      if (point) point.value++;
    }
    const newAcademies = lastMonths(12);
    for (const t of tenantsRecent) {
      const point = newAcademies.find((m) => m.key === t.createdAt.toISOString().slice(0, 7));
      if (point) point.value++;
    }
    const topUpRevenue = lastMonths(12);
    let topUpTotal = 0;
    for (const p of topUps) {
      const amount = Number(p.priceAmount);
      topUpTotal += amount;
      const point = topUpRevenue.find((m) => m.key === p.createdAt.toISOString().slice(0, 7));
      if (point) point.value += amount;
    }

    const collected = lastMonths(12);
    for (const p of payments) {
      const point = collected.find((m) => m.key === p.createdAt.toISOString().slice(0, 7));
      if (point) point.value += p.amountCents / 100;
    }

    const in7Days = now + 7 * DAY;
    const renewingSoon = rows
      .filter((r) => r.kind === "payphone" && (r.state === "active" || r.state === "canceling") && new Date(r.currentPeriodEnd).getTime() <= in7Days)
      .sort((a, b) => a.currentPeriodEnd.localeCompare(b.currentPeriodEnd));

    return {
      rows,
      kpis: {
        mrr,
        arr: mrr * 12,
        payingAcademies: paying.length,
        arpa: paying.length ? mrr / paying.length : 0,
        tenantsTotal,
        withoutPlan: tenantsTotal - rows.filter(live).length,
        courtesy: rows.filter((r) => live(r) && r.kind === "internal").length,
        topUpTotal,
        newThisMonth: newSubs[newSubs.length - 1].value,
        collectedThisMonth: collected[collected.length - 1].value,
        collected12m: collected.reduce((acc, m) => acc + m.value, 0),
        autoChargeCount: rows.filter((r) => live(r) && r.autoCharge).length,
      },
      byPlan,
      stateCounts,
      newSubs,
      newAcademies,
      topUpRevenue,
      collected,
      renewingSoon,
    };
  }
}

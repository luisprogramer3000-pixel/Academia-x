import { prisma } from "@/lib/db";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { BillingInterval, Prisma } from "@prisma/client";
import { getStripe, isMockPaymentsMode, isStripeConfigured, getAppUrl } from "@/lib/stripe";

export { BillingInterval };
import { SAAS_PLANS, type PlanConfig } from "./plans";
export { SAAS_PLANS };
export type { PlanConfig, PlanPricing } from "./plans";

/**
 * Obtiene de forma autoritativa el ID de precio de Stripe para un plan e intervalo.
 * En producción el Price ID debe existir en las variables de entorno.
 */
export function getStripePriceId(
  planId: "STARTER" | "PRO" | "ACADEMY",
  interval: BillingInterval = "MONTHLY"
): string {
  const plan = SAAS_PLANS[planId];
  if (!plan) throw new Error("Plan no válido");
  const envKey = plan.pricing[interval]?.stripePriceEnvKey;
  const priceId = envKey ? process.env[envKey] : undefined;
  if (priceId) return priceId;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Falta configurar ${envKey} en producción.`);
  }
  return `price_mock_${planId.toLowerCase()}_${interval.toLowerCase()}`;
}

export type PlanId = "STARTER" | "PRO" | "ACADEMY";

/**
 * Resuelve plan e intervalo a partir de un Price ID de Stripe (mapa inverso desde el entorno).
 */
export function resolvePlanFromPriceId(
  priceId: string | null | undefined
): { planId: PlanId; billingInterval: BillingInterval } | null {
  if (!priceId) return null;
  for (const plan of Object.values(SAAS_PLANS)) {
    for (const interval of ["MONTHLY", "YEARLY"] as BillingInterval[]) {
      if (process.env[plan.pricing[interval].stripePriceEnvKey] === priceId) {
        return { planId: plan.id, billingInterval: interval };
      }
    }
  }
  return null;
}

/** Estados de Stripe que otorgan acceso al servicio */
export const ACCESS_GRANTING_STATUSES = ["active", "trialing"];
/** Periodo de gracia tras un pago fallido (past_due) antes de bloquear el acceso */
export const PAST_DUE_GRACE_DAYS = 7;

export interface ActiveSubscription {
  id: string;
  stripeSubscriptionId: string | null;
  planId: PlanId;
  plan: PlanConfig;
  billingInterval: BillingInterval;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
}

function normalizePlanId(planId: string | null | undefined): PlanId | null {
  const upper = planId?.toUpperCase();
  return upper && upper in SAAS_PLANS ? (upper as PlanId) : null;
}

function toDate(unixSeconds: number | null | undefined, fallbackDays = 30): Date {
  return unixSeconds ? new Date(unixSeconds * 1000) : new Date(Date.now() + fallbackDays * 24 * 60 * 60 * 1000);
}

export class BillingService {
  /**
   * Devuelve la suscripción que otorga acceso al tenant, o null si no tiene ninguna vigente.
   * Nunca asume un plan por defecto.
   */
  static async getActiveSubscription(tenantId: string): Promise<ActiveSubscription | null> {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });
    if (!subscription) return null;

    const planId = normalizePlanId(subscription.planId);
    if (!planId) return null;

    const now = Date.now();
    const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const periodEnd = subscription.currentPeriodEnd.getTime();

    const hasAccess =
      (ACCESS_GRANTING_STATUSES.includes(subscription.status) && periodEnd + graceMs > now) ||
      (subscription.status === "past_due" && periodEnd + graceMs > now);

    if (!hasAccess) return null;

    return {
      id: subscription.id,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      planId,
      plan: SAAS_PLANS[planId],
      billingInterval: subscription.billingInterval,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      stripeCustomerId: subscription.stripeCustomerId,
    };
  }

  /**
   * Obtiene la información de suscripción y consumo de un tenant para el panel de facturación.
   */
  static async getTenantSubscriptionInfo(tenantId: string) {
    const [active, latest, studentsCount, teachersCount] = await Promise.all([
      this.getActiveSubscription(tenantId),
      prisma.subscription.findFirst({ where: { tenantId }, orderBy: { updatedAt: "desc" } }),
      prisma.membership.count({ where: { tenantId, role: "STUDENT" } }),
      prisma.membership.count({ where: { tenantId, role: { in: ["TEACHER", "OWNER"] } } }),
    ]);

    return {
      active,
      latestStatus: latest?.status ?? null,
      plan: active?.plan ?? null,
      billingInterval: active?.billingInterval ?? ("MONTHLY" as BillingInterval),
      usage: {
        studentsCount,
        maxStudents: active?.plan.maxStudents ?? 0,
        teachersCount,
        maxTeachers: active?.plan.maxTeachers ?? 0,
      },
    };
  }

  /**
   * Obtiene o crea el Customer de Stripe asociado al tenant.
   */
  static async getOrCreateStripeCustomer(tenantId: string, email?: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error("Academia no encontrada.");
    if (tenant.stripeCustomerId) return tenant.stripeCustomerId;

    const customer = await getStripe().customers.create(
      {
        name: tenant.name,
        email,
        metadata: { tenantId },
      },
      { idempotencyKey: `customer_create:${tenantId}` }
    );

    await prisma.tenant.update({ where: { id: tenantId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  /**
   * Crea una sesión de Stripe Checkout para suscribirse a un plan.
   * El plan SOLO se activa cuando Stripe confirma el pago vía webhook.
   *
   * En desarrollo sin STRIPE_SECRET_KEY se usa un modo simulado (bloqueado en producción).
   */
  static async createCheckoutSession(
    tenantId: string,
    planId: PlanId,
    billingInterval: BillingInterval = "MONTHLY",
    options: { customerEmail?: string } = {}
  ) {
    const plan = SAAS_PLANS[planId];
    if (!plan) throw new Error("Plan no válido");

    const pricing = plan.pricing[billingInterval];
    if (!pricing) throw new Error("Intervalo de facturación no válido");

    const stripePriceId = getStripePriceId(planId, billingInterval);

    if (isMockPaymentsMode()) {
      return this.activateMockSubscription(tenantId, planId, billingInterval, stripePriceId, pricing.amountCents);
    }

    const active = await this.getActiveSubscription(tenantId);
    if (active?.stripeSubscriptionId && !active.stripeSubscriptionId.startsWith("sub_simulated")) {
      // Ya tiene una suscripción real: los cambios de plan se gestionan en el portal de Stripe (con prorrateo)
      const portal = await this.createBillingPortalSession(tenantId);
      return { checkoutUrl: portal.url, stripePriceId, amountCents: pricing.amountCents, billingInterval, subscription: null };
    }

    const customerId = await this.getOrCreateStripeCustomer(tenantId, options.customerEmail);
    const appUrl = getAppUrl();
    const metadata = { tenantId, planId, billingInterval };

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: tenantId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      metadata,
      subscription_data: { metadata },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${appUrl}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/billing?checkout=canceled`,
    });

    if (!session.url) throw new Error("Stripe no devolvió una URL de pago.");

    return {
      checkoutUrl: session.url,
      stripePriceId,
      amountCents: pricing.amountCents,
      billingInterval,
      subscription: null,
    };
  }

  /**
   * Portal de cliente de Stripe: cambiar plan, método de pago, facturas y cancelación.
   */
  static async createBillingPortalSession(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { stripeCustomerId: true } });
    if (!tenant?.stripeCustomerId) {
      throw new Error("Esta academia aún no tiene una cuenta de facturación en Stripe.");
    }
    return getStripe().billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${getAppUrl()}/dashboard/billing`,
    });
  }

  /**
   * SOLO DESARROLLO: activa una suscripción simulada sin cobro real.
   */
  private static async activateMockSubscription(
    tenantId: string,
    planId: PlanId,
    billingInterval: BillingInterval,
    stripePriceId: string,
    amountCents: number
  ) {
    const days = billingInterval === "YEARLY" ? 365 : 30;
    const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    console.warn(`[billing] Modo simulado: activando plan ${planId} sin cobro para tenant ${tenantId}`);

    const subscription = await prisma.subscription.upsert({
      where: { stripeSubscriptionId: `sub_simulated_${tenantId}` },
      update: { planId, billingInterval, stripePriceId, status: "active", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false },
      create: {
        tenantId,
        stripeSubscriptionId: `sub_simulated_${tenantId}`,
        stripeCustomerId: `cus_simulated_${tenantId}`,
        stripePriceId,
        planId,
        billingInterval,
        status: "active",
        currentPeriodEnd: periodEnd,
      },
    });

    await AICreditEngine.syncWalletWithPlan(tenantId, planId);

    return {
      checkoutUrl: `/dashboard/billing?checkout=success&plan=${planId}&interval=${billingInterval}`,
      subscription,
      stripePriceId,
      amountCents,
      billingInterval,
    };
  }

  /**
   * Registra el evento como procesado. Devuelve false si ya se había procesado (idempotencia).
   */
  private static async markEventProcessed(eventId: string | undefined, type: string): Promise<boolean> {
    if (!eventId) return true;
    try {
      await prisma.stripeEvent.create({ data: { id: eventId, type } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }
      throw error;
    }
  }

  private static async releaseEvent(eventId: string | undefined) {
    if (!eventId) return;
    await prisma.stripeEvent.delete({ where: { id: eventId } }).catch(() => undefined);
  }

  /**
   * Resuelve el tenant de un objeto de Stripe: metadata → client_reference_id → customer.
   */
  private static async resolveTenantId(obj: {
    metadata?: Record<string, string> | null;
    client_reference_id?: string | null;
    customer?: string | { id: string } | null;
  }): Promise<string | null> {
    const fromMetadata = obj.metadata?.tenantId || obj.client_reference_id;
    if (fromMetadata) {
      const exists = await prisma.tenant.findUnique({ where: { id: fromMetadata }, select: { id: true } });
      if (exists) return exists.id;
    }
    const customerId = typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
    if (customerId) {
      const tenant = await prisma.tenant.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
      if (tenant) return tenant.id;
    }
    return null;
  }

  /**
   * Sincroniza una suscripción de Stripe con la base de datos.
   * Solo re-sincroniza la billetera de créditos cuando cambia el plan o se activa por primera vez
   * (evita recargas de créditos en cada evento customer.subscription.updated).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async syncSubscriptionFromStripe(sub: Record<string, any>) {
    const tenantId = await this.resolveTenantId(sub);
    if (!tenantId) {
      console.warn(`[billing] Suscripción ${sub.id} sin tenant asociado; se ignora.`);
      return null;
    }

    const item = sub.items?.data?.[0];
    const priceId: string | undefined = item?.price?.id ?? item?.plan?.id;
    const fromPrice = resolvePlanFromPriceId(priceId);
    const planId = fromPrice?.planId ?? normalizePlanId(sub.metadata?.planId);
    if (!planId) {
      console.warn(`[billing] Suscripción ${sub.id} con precio desconocido (${priceId}); se ignora.`);
      return null;
    }

    const recurringInterval = item?.price?.recurring?.interval ?? item?.plan?.interval;
    const billingInterval: BillingInterval =
      fromPrice?.billingInterval ??
      (recurringInterval === "year" || sub.metadata?.billingInterval === "YEARLY" || sub.metadata?.interval === "YEARLY"
        ? "YEARLY"
        : "MONTHLY");

    const periodEndUnix: number | undefined = sub.current_period_end ?? item?.current_period_end;
    const currentPeriodEnd = toDate(periodEndUnix, billingInterval === "YEARLY" ? 365 : 30);
    const customerId: string | undefined = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    const status: string = sub.status || "active";

    const previous = await prisma.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });

    const saved = await prisma.subscription.upsert({
      where: { stripeSubscriptionId: sub.id },
      update: {
        planId,
        billingInterval,
        stripePriceId: priceId ?? previous?.stripePriceId,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        stripeCustomerId: customerId ?? previous?.stripeCustomerId,
      },
      create: {
        tenantId,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        planId,
        billingInterval,
        status,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      },
    });

    if (customerId) {
      await prisma.tenant
        .updateMany({ where: { id: tenantId, stripeCustomerId: null }, data: { stripeCustomerId: customerId } })
        .catch(() => undefined);
    }

    const isActiveNow = ACCESS_GRANTING_STATUSES.includes(status);
    const becameActive = isActiveNow && (!previous || !ACCESS_GRANTING_STATUSES.includes(previous.status));
    const planChanged = Boolean(previous && previous.planId !== planId);
    if (isActiveNow && (becameActive || planChanged)) {
      await AICreditEngine.syncWalletWithPlan(tenantId, planId);
    }

    return saved;
  }

  /**
   * Procesa eventos de Webhook de Stripe de manera idempotente (por event.id).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async handleStripeWebhook(event: { id?: string; type: string; data: any }) {
    const isNew = await this.markEventProcessed(event.id, event.type);
    if (!isNew) {
      return { received: true, duplicate: true };
    }

    try {
      const obj = event.data?.object || {};

      switch (event.type) {
        case "checkout.session.completed": {
          const subId = typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id;
          if (obj.mode === "subscription" && subId && isStripeConfigured()) {
            // Fuente de verdad: la suscripción en Stripe
            const sub = await getStripe().subscriptions.retrieve(subId);
            await this.syncSubscriptionFromStripe(sub as unknown as Record<string, unknown>);
          } else if (obj.mode === "subscription" || obj.metadata?.planId) {
            // Sin acceso a la API (pruebas locales): usar la metadata del checkout creada por el servidor
            await this.syncSubscriptionFromStripe({
              id: subId || obj.id,
              customer: obj.customer,
              metadata: { ...(obj.metadata || {}), tenantId: obj.metadata?.tenantId || obj.client_reference_id },
              status: "active",
              items: { data: [] },
            });
          }
          break;
        }

        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
        case "customer.subscription.paused":
        case "customer.subscription.resumed": {
          await this.syncSubscriptionFromStripe(obj);
          break;
        }

        case "invoice.paid":
        case "invoice.payment_failed": {
          const subId = typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id;
          if (subId && isStripeConfigured()) {
            const sub = await getStripe().subscriptions.retrieve(subId);
            await this.syncSubscriptionFromStripe(sub as unknown as Record<string, unknown>);
          }
          break;
        }

        default:
          // Eventos no manejados se reconocen sin error
          break;
      }

      return { received: true };
    } catch (error) {
      // Liberar el evento para que Stripe pueda reintentarlo
      await this.releaseEvent(event.id);
      throw error;
    }
  }
}

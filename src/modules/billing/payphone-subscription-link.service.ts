import { prisma } from "@/lib/db";
import { getSale, newClientTransactionId, splitIva, type PayphoneResult } from "@/lib/payphone";
import { BillingService, type PlanId } from "./billing.service";
import { SAAS_PLANS } from "./plans";
import { getPayphoneSubscriptionLink } from "./payphone-subscription-links";
import { SUBSCRIPTION_PLAN_CODE_MAP, isSubscriptionPlanCode, type SubscriptionPlanCode } from "./subscription-plan-codes";

const DAY = 24 * 60 * 60 * 1000;
/** Un intento pendiente del mismo plan se reutiliza durante este tiempo (evita duplicados por doble clic). */
const REUSE_PENDING_MS = DAY;
/** Ventana para casar el primer cobro con el intento que lo originó. */
const FIRST_PAYMENT_WINDOW_MS = 7 * DAY;

/** Payment.method de los cobros hechos con un Link de Suscripción de PayPhone. */
export const LINK_METHOD = "LINK";

export const UNAVAILABLE_MESSAGE = "Este método de pago no está disponible temporalmente.";

export class SubscriptionCheckoutError extends Error {
  constructor(
    public status: number,
    public code: "INVALID_PLAN" | "NOT_CONFIGURED" | "ALREADY_ACTIVE",
    message: string
  ) {
    super(message);
    this.name = "SubscriptionCheckoutError";
  }
}

export type LinkNotificationOutcome =
  | { status: "approved"; tenantId: string; paymentId: string; renewal: boolean }
  | { status: "ignored"; reason: string }
  | { status: "error"; reason: string };

const isUniqueViolation = (error: unknown) => (error as { code?: string })?.code === "P2002";

/** Importe de cada cobro del link (el precio del plan). */
export function linkAmountCents(planCode: SubscriptionPlanCode): number {
  const { planId, billingInterval } = SUBSCRIPTION_PLAN_CODE_MAP[planCode];
  return SAAS_PLANS[planId].pricing[billingInterval].amountCents;
}

/**
 * Planes recurrentes cobrados con Links de Suscripción de PayPhone.
 *
 * PayPhone gestiona la recurrencia (cobra cada mes o año según el link).
 * Mentor solo refleja el estado:
 *  - startCheckout: valida el plan, registra el intento (Payment PENDING,
 *    method LINK) y devuelve la URL del link. Nada se activa al redirigir.
 *  - handleNotification: con cada notificación de pago aprobado (NotificacionPago)
 *    se VERIFICA la transacción con la API de PayPhone (GET /api/Sale/{id}) y,
 *    si el importe es el de un plan y el correo del pagador coincide sin
 *    ambigüedad con una academia, se activa (primer cobro) o se extiende
 *    (renovación) con BillingService.applySubscriptionPayment.
 *
 * No hay cron de cobro ni tokenización para estos planes.
 */
export class PayphoneSubscriptionLinkService {
  static async startCheckout(input: { tenantId: string; userId: string; planCode: unknown }) {
    if (!isSubscriptionPlanCode(input.planCode)) {
      throw new SubscriptionCheckoutError(400, "INVALID_PLAN", "El plan seleccionado no existe o no admite suscripción.");
    }
    const planCode: SubscriptionPlanCode = input.planCode;
    const { planId, billingInterval } = SUBSCRIPTION_PLAN_CODE_MAP[planCode];

    const checkoutUrl = getPayphoneSubscriptionLink(planCode);
    if (!checkoutUrl) throw new SubscriptionCheckoutError(503, "NOT_CONFIGURED", UNAVAILABLE_MESSAGE);

    const [active, currentMethod] = await Promise.all([
      BillingService.getActiveSubscription(input.tenantId),
      BillingService.getCurrentSubscriptionPaymentMethod(input.tenantId),
    ]);
    const hasActiveLink = Boolean(active) && currentMethod === LINK_METHOD;

    // Ya suscrito a este mismo plan por link: PayPhone ya lo cobra solo
    if (hasActiveLink && active!.planId === planId && active!.billingInterval === billingInterval) {
      throw new SubscriptionCheckoutError(
        409,
        "ALREADY_ACTIVE",
        "Ya tienes este plan activo. PayPhone lo renueva automáticamente; no necesitas volver a contratarlo."
      );
    }

    // Doble clic / vuelta atrás: se reutiliza el intento pendiente del mismo plan
    const pending = await prisma.payment.findFirst({
      where: {
        tenantId: input.tenantId,
        kind: "SUBSCRIPTION",
        method: LINK_METHOD,
        status: "PENDING",
        planId,
        billingInterval,
        createdAt: { gte: new Date(Date.now() - REUSE_PENDING_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const amountCents = linkAmountCents(planCode);
    const payment =
      pending ??
      (await prisma.payment.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          kind: "SUBSCRIPTION",
          method: LINK_METHOD,
          planId,
          billingInterval,
          amountCents,
          taxCents: splitIva(amountCents).tax,
          clientTransactionId: newClientTransactionId("L"),
        },
        select: { id: true },
      }));

    return {
      checkoutUrl,
      paymentId: payment.id,
      planCode,
      // Cambio de plan con un link activo: la suscripción anterior sigue viva en PayPhone
      replacesActiveLinkSubscription: hasActiveLink,
    };
  }

  /**
   * Notificación de pago aprobado que no corresponde a un pago del botón.
   * Idempotente por payphoneTransactionId (único en Payment).
   */
  static async handleNotification(input: { transactionId: number }): Promise<LinkNotificationOutcome> {
    const already = await prisma.payment.findUnique({
      where: { payphoneTransactionId: input.transactionId },
      select: { id: true, tenantId: true, status: true },
    });
    if (already?.status === "APPROVED") {
      return { status: "approved", tenantId: already.tenantId, paymentId: already.id, renewal: false };
    }

    let sale: PayphoneResult;
    try {
      sale = await getSale(input.transactionId);
    } catch (error) {
      console.error(`[payphone] No se pudo consultar la transacción ${input.transactionId}:`, error);
      return { status: "error", reason: "No se pudo verificar la transacción con PayPhone." };
    }
    if (!sale.approved) return { status: "ignored", reason: "La transacción no está aprobada." };

    const amountCents = sale.amountCents;
    const email = sale.email?.trim().toLowerCase() || null;
    if (amountCents === null) return { status: "ignored", reason: "PayPhone no devolvió el importe." };

    // ¿El importe es el de alguno de los planes con link?
    const codes = (Object.keys(SUBSCRIPTION_PLAN_CODE_MAP) as SubscriptionPlanCode[]).filter((code) => linkAmountCents(code) === amountCents);
    if (codes.length === 0) return { status: "ignored", reason: "El importe no corresponde a un plan con Link de Suscripción." };
    if (!email) {
      console.error(`[payphone] Transacción ${input.transactionId} de ${amountCents} centavos sin correo del pagador: revisar a mano.`);
      return { status: "ignored", reason: "Sin correo del pagador para identificar la academia." };
    }

    const paid = {
      payphoneTransactionId: sale.transactionId ?? input.transactionId,
      authorizationCode: sale.authorizationCode,
      cardBrand: sale.cardBrand,
      lastDigits: sale.lastDigits,
      confirmedAt: new Date(),
    };
    const userEmail = { user: { email: { equals: email, mode: "insensitive" as const } } };

    // 1) Primer cobro: intento pendiente del mismo importe iniciado por un usuario con ese correo
    const pending = await prisma.payment.findMany({
      where: {
        kind: "SUBSCRIPTION",
        method: LINK_METHOD,
        status: "PENDING",
        amountCents,
        createdAt: { gte: new Date(Date.now() - FIRST_PAYMENT_WINDOW_MS) },
        ...userEmail,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    if (new Set(pending.map((p) => p.tenantId)).size > 1) {
      console.error(`[payphone] Transacción ${input.transactionId}: varias academias con intentos pendientes para el mismo correo. Revisar a mano.`);
      return { status: "ignored", reason: "Coincidencia ambigua entre varias academias." };
    }
    if (pending[0]) {
      const payment = pending[0];
      try {
        const claimed = await prisma.payment.updateMany({
          where: { id: payment.id, status: "PENDING" },
          data: { status: "APPROVED", ...paid },
        });
        if (claimed.count === 0) return { status: "approved", tenantId: payment.tenantId, paymentId: payment.id, renewal: false };
      } catch (error) {
        if (isUniqueViolation(error)) return { status: "approved", tenantId: payment.tenantId, paymentId: payment.id, renewal: false };
        throw error;
      }
      await BillingService.applySubscriptionPayment({
        tenantId: payment.tenantId,
        planId: payment.planId as PlanId,
        billingInterval: payment.billingInterval!,
      });
      // Otros intentos pendientes de la misma academia ya no tienen sentido
      await prisma.payment.updateMany({
        where: { tenantId: payment.tenantId, method: LINK_METHOD, status: "PENDING", id: { not: payment.id } },
        data: { status: "CANCELED", failureReason: "Reemplazado por otro pago de suscripción aprobado" },
      });
      return { status: "approved", tenantId: payment.tenantId, paymentId: payment.id, renewal: false };
    }

    // 2) Renovación cobrada por PayPhone: academia cuya suscripción vigente se pagó por link,
    //    mismo importe, y cuyo pago anterior lo hizo un usuario con ese correo
    const previous = await prisma.payment.findMany({
      where: { kind: "SUBSCRIPTION", method: LINK_METHOD, status: "APPROVED", amountCents, ...userEmail },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const tenants = [...new Set(previous.map((p) => p.tenantId))];
    if (tenants.length > 1) {
      console.error(`[payphone] Renovación ${input.transactionId}: el correo coincide con varias academias. Revisar a mano.`);
      return { status: "ignored", reason: "Coincidencia ambigua entre varias academias." };
    }
    const last = previous[0];
    if (!last) {
      console.error(
        `[payphone] Transacción ${input.transactionId} aprobada (${amountCents} centavos) sin academia asociada: ` +
          "el correo del pagador no coincide con ningún intento de suscripción. Revisar a mano."
      );
      return { status: "ignored", reason: "No se encontró la academia del pagador." };
    }

    // Solo si la suscripción vigente sigue siendo ese plan por link (no reactivar un plan viejo tras un cambio)
    const current = await prisma.payment.findFirst({
      where: { tenantId: last.tenantId, kind: "SUBSCRIPTION", status: "APPROVED" },
      orderBy: { createdAt: "desc" },
    });
    if (!current || current.method !== LINK_METHOD || current.planId !== last.planId || current.billingInterval !== last.billingInterval) {
      console.error(`[payphone] Renovación ${input.transactionId}: la academia ${last.tenantId} ya no tiene ese plan por link. Revisar a mano.`);
      return { status: "ignored", reason: "La academia cambió de plan." };
    }

    let created;
    try {
      created = await prisma.payment.create({
        data: {
          tenantId: last.tenantId,
          userId: last.userId,
          kind: "SUBSCRIPTION",
          method: LINK_METHOD,
          status: "APPROVED",
          planId: last.planId,
          billingInterval: last.billingInterval,
          amountCents,
          taxCents: splitIva(amountCents).tax,
          clientTransactionId: newClientTransactionId("L"),
          ...paid,
        },
      });
    } catch (error) {
      // Otra notificación simultánea ya la registró
      if (isUniqueViolation(error)) return { status: "approved", tenantId: last.tenantId, paymentId: last.id, renewal: true };
      throw error;
    }
    await BillingService.applySubscriptionPayment({
      tenantId: last.tenantId,
      planId: last.planId as PlanId,
      billingInterval: last.billingInterval!,
    });
    return { status: "approved", tenantId: last.tenantId, paymentId: created.id, renewal: true };
  }
}

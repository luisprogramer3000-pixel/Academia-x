import type { BillingInterval } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAppUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import { seal, open } from "@/lib/secret-box";
import {
  chargeSavedCard,
  confirmPayment,
  isMockPaymentsMode,
  isTokenizationEnabled,
  newClientTransactionId,
  preparePayment,
  splitIva,
  type CardHolder,
  type PayphoneResult,
} from "@/lib/payphone";
import { BillingService, PAST_DUE_GRACE_DAYS, payphoneSubscriptionId, type PlanId } from "./billing.service";
import { SAAS_PLANS, chargeInstallments } from "./plans";
import { CreditPurchaseService } from "./credit-purchase.service";

const DAY = 24 * 60 * 60 * 1000;
/** Intentos de cobro automático por periodo (uno al día) antes de dejarlo vencer */
const MAX_RENEWAL_ATTEMPTS = 3;

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** La parte 2 de un plan en dos pagos aún no se puede pagar (se habilita 24 h después de la parte 1). */
export class SecondInstallmentNotYetError extends Error {
  constructor(public availableAt: Date) {
    super(`Ya pagaste la primera parte. La segunda parte se habilita el ${availableAt.toISOString()}.`);
    this.name = "SecondInstallmentNotYetError";
  }
}

/** No se pudo iniciar el cobro con Payphone (Prepare falló). */
export class PaymentStartError extends Error {
  constructor() {
    super("No se pudo iniciar el pago con Payphone. Inténtalo de nuevo en unos minutos.");
    this.name = "PaymentStartError";
  }
}

type Outcome = { status: "approved" | "canceled" | "error"; kind: "SUBSCRIPTION" | "TOPUP" | null; message?: string };

/**
 * Pagos con Payphone: plan de la academia y paquetes de créditos de IA.
 *
 * Flujo del botón: start*Payment crea el Payment (PENDING) y devuelve la URL del
 * formulario de Payphone → el cliente paga → vuelve a /api/payphone/response →
 * handleReturn confirma con Payphone (dentro de 5 minutos) y aplica el pago.
 * La notificación externa de Payphone (si está habilitada) entra por el mismo
 * camino y también se verifica con Confirm: nunca se confía en el aviso solo.
 *
 * Cobro automático: renewDueSubscriptions (cron) cobra la tarjeta guardada al
 * vencer; si no hay tarjeta, avisa para renovar con el botón.
 */
export class PayphonePaymentService {
  // ─── Inicio del pago ───────────────────────────────────────────────────────

  static async startSubscriptionPayment(input: {
    tenantId: string;
    userId?: string;
    planId: PlanId;
    billingInterval: BillingInterval;
    saveCard: boolean;
  }): Promise<{ redirectUrl: string }> {
    const plan = SAAS_PLANS[input.planId];
    if (!plan) throw new Error("Plan no válido.");
    const fullAmountCents = plan.pricing[input.billingInterval].amountCents;

    // Plan por encima del máximo de PayPhone (Academy anual): dos pagos, día 1 y día 2
    const installments = chargeInstallments(input.planId, input.billingInterval);
    let installment: 1 | 2 | null = null;
    if (installments === 2) {
      const awaiting = await BillingService.getAwaitingSecondInstallment(input.tenantId);
      if (awaiting && awaiting.planId === input.planId && awaiting.billingInterval === input.billingInterval) {
        if (Date.now() < awaiting.availableAt.getTime()) {
          throw new SecondInstallmentNotYetError(awaiting.availableAt);
        }
        installment = 2;
      } else {
        installment = 1;
      }
    }
    const amountCents = installment ? fullAmountCents / installments : fullAmountCents;

    if (isMockPaymentsMode()) {
      // Desarrollo sin Payphone: se aprueba al instante (bloqueado en producción)
      console.warn(`[billing] Modo simulado: activando ${input.planId} sin cobro para ${input.tenantId}`);
      await BillingService.applySubscriptionPayment({ ...input, externalId: `sub_simulated_${input.tenantId}` });
      return { redirectUrl: "/dashboard/billing?checkout=success" };
    }

    const payment = await prisma.payment.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        kind: "SUBSCRIPTION",
        planId: input.planId,
        billingInterval: input.billingInterval,
        amountCents,
        taxCents: splitIva(amountCents).tax,
        clientTransactionId: newClientTransactionId("S"),
        installment,
        // Un plan en dos pagos no se puede cobrar solo con la tarjeta (supera el máximo por cobro)
        saveCard: input.saveCard && isTokenizationEnabled() && !installment,
      },
    });
    const interval = input.billingInterval === "YEARLY" ? "anual" : "mensual";
    const part = installment ? ` · parte ${installment} de 2` : "";
    return this.prepare(payment.id, payment.clientTransactionId, amountCents, `Mentor Studio Global · Plan ${plan.name} (${interval})${part}`, "/dashboard/billing?checkout=canceled");
  }

  static async startTopupPayment(input: {
    tenantId: string;
    userId?: string;
    purchaseId: string;
    amountCents: number;
    packageName: string;
  }): Promise<{ redirectUrl: string; clientTransactionId: string }> {
    const payment = await prisma.payment.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        kind: "TOPUP",
        topupPurchaseId: input.purchaseId,
        amountCents: input.amountCents,
        taxCents: splitIva(input.amountCents).tax,
        clientTransactionId: newClientTransactionId("T"),
      },
    });
    const { redirectUrl } = await this.prepare(payment.id, payment.clientTransactionId, input.amountCents, `Mentor Studio Global · ${input.packageName}`, "/dashboard/ai-copilot?topup=canceled");
    return { redirectUrl, clientTransactionId: payment.clientTransactionId };
  }

  private static async prepare(paymentId: string, clientTransactionId: string, amountCents: number, reference: string, cancelPath: string) {
    const appUrl = getAppUrl();
    try {
      const res = await preparePayment({
        amountCents,
        clientTransactionId,
        reference,
        responseUrl: `${appUrl}/api/payphone/response`,
        cancellationUrl: `${appUrl}${cancelPath}`,
      });
      return { redirectUrl: res.payWithCard };
    } catch (error) {
      await prisma.payment.update({
        where: { id: paymentId },
        data: { status: "FAILED", failureReason: error instanceof Error ? error.message.slice(0, 300) : "Prepare falló" },
      });
      throw new PaymentStartError();
    }
  }

  // ─── Regreso del cliente / notificación de Payphone ───────────────────────

  /**
   * Confirma con Payphone y aplica el pago. Idempotente: si el pago ya estaba
   * aprobado (p. ej. llegó antes la notificación) no se aplica dos veces.
   */
  static async handleReturn(input: { id: number; clientTransactionId: string; cardToken?: string | null }): Promise<Outcome> {
    const payment = await prisma.payment.findUnique({ where: { clientTransactionId: input.clientTransactionId } });
    if (!payment) return { status: "error", kind: null, message: "Pago no encontrado." };
    const kind = payment.kind as Outcome["kind"];
    if (payment.status === "APPROVED") return { status: "approved", kind };

    let result: PayphoneResult;
    try {
      result = await confirmPayment(input.id, input.clientTransactionId);
    } catch (error) {
      console.error("[payphone] Confirm falló:", error);
      return { status: "error", kind, message: "No pudimos confirmar el pago con Payphone." };
    }

    // El importe y el identificador tienen que ser los del pago que creamos
    const matches =
      result.clientTransactionId === payment.clientTransactionId &&
      (result.amountCents === null || result.amountCents === payment.amountCents);

    if (!result.approved || !matches) {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "CANCELED",
          payphoneTransactionId: result.transactionId,
          failureReason: !matches ? "El importe o el identificador no coinciden" : result.message?.slice(0, 300) ?? "Cancelado",
        },
      });
      if (!matches) console.error(`[payphone] Pago ${payment.id}: datos de Confirm no coinciden`, result);
      return { status: "canceled", kind };
    }

    // Marcar aprobado una sola vez (si otra petición ya lo hizo, no se reaplica)
    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: { not: "APPROVED" } },
      data: {
        status: "APPROVED",
        payphoneTransactionId: result.transactionId,
        authorizationCode: result.authorizationCode,
        cardBrand: result.cardBrand,
        lastDigits: result.lastDigits,
        confirmedAt: new Date(),
      },
    });
    if (claimed.count === 0) return { status: "approved", kind };

    await this.applyApproved(payment.id);

    // Tarjeta para cobros automáticos: solo con consentimiento y si Payphone la tokenizó
    if (payment.saveCard && input.cardToken && result.holderName && result.email && result.phoneNumber && result.document) {
      await this.saveCard(payment.tenantId, input.cardToken, {
        name: result.holderName,
        email: result.email,
        phoneNumber: result.phoneNumber,
        document: result.document,
      }, result).catch((error) => console.error("[payphone] No se pudo guardar la tarjeta:", error));
    }
    return { status: "approved", kind };
  }

  private static async applyApproved(paymentId: string) {
    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (payment.kind === "SUBSCRIPTION" && payment.planId && payment.billingInterval && payment.installment === 1) {
      await BillingService.applyFirstInstallment({
        tenantId: payment.tenantId,
        planId: payment.planId as PlanId,
        billingInterval: payment.billingInterval,
        paidAt: payment.confirmedAt ?? new Date(),
      });
    } else if (payment.kind === "SUBSCRIPTION" && payment.planId && payment.billingInterval && payment.installment === 2) {
      const part1 = await prisma.payment.findFirst({
        where: { tenantId: payment.tenantId, kind: "SUBSCRIPTION", status: "APPROVED", installment: 1, planId: payment.planId, createdAt: { lt: payment.createdAt } },
        orderBy: { createdAt: "desc" },
        select: { confirmedAt: true, createdAt: true },
      });
      await BillingService.applySecondInstallment({
        tenantId: payment.tenantId,
        planId: payment.planId as PlanId,
        billingInterval: payment.billingInterval,
        part1PaidAt: part1 ? part1.confirmedAt ?? part1.createdAt : payment.confirmedAt ?? new Date(),
      });
    } else if (payment.kind === "SUBSCRIPTION" && payment.planId && payment.billingInterval) {
      await BillingService.applySubscriptionPayment({
        tenantId: payment.tenantId,
        planId: payment.planId as PlanId,
        billingInterval: payment.billingInterval,
      });
    } else if (payment.kind === "TOPUP" && payment.topupPurchaseId) {
      await CreditPurchaseService.fulfillPurchase({ purchaseId: payment.topupPurchaseId });
    }
  }

  private static async saveCard(tenantId: string, cardToken: string, holder: CardHolder, result: PayphoneResult) {
    const data = {
      tokenEncrypted: seal(cardToken),
      holderEncrypted: seal(JSON.stringify(holder)),
      cardBrand: result.cardBrand,
      lastDigits: result.lastDigits,
      consentAt: new Date(),
    };
    await prisma.paymentCard.upsert({ where: { tenantId }, update: data, create: { tenantId, ...data } });
    await prisma.subscription.updateMany({ where: { externalId: payphoneSubscriptionId(tenantId) }, data: { autoRenew: true, cancelAtPeriodEnd: false } });
  }

  // ─── Renovación automática (cron diario u horario) ────────────────────────

  /**
   * Academy Executive anual (Cajita en dos pagos): desde el día 2 (24 h tras
   * aprobarse la parte 1) avisa por el panel y por correo que ya puede pagar la
   * parte 2, y lo recuerda 24 h después. El cliente paga desde Facturación.
   */
  static async remindSecondInstallments(now = new Date()): Promise<number> {
    const parts1 = await prisma.payment.findMany({
      where: {
        kind: "SUBSCRIPTION",
        status: "APPROVED",
        installment: 1,
        createdAt: { lte: new Date(now.getTime() - DAY), gte: new Date(now.getTime() - 10 * DAY) },
      },
      select: { tenantId: true },
      distinct: ["tenantId"],
      take: 200,
    });
    let sent = 0;
    for (const { tenantId } of parts1) {
      const awaiting = await BillingService.getAwaitingSecondInstallment(tenantId, now);
      if (!awaiting || awaiting.availableAt > now) continue;
      const step = now.getTime() - awaiting.part1PaidAt.getTime() >= 2 * DAY ? 2 : 1;
      const plan = SAAS_PLANS[awaiting.planId];
      const ok = await this.notify(
        tenantId,
        "SUBSCRIPTION_RENEWAL_REMINDER",
        `second-installment:${awaiting.part1Id}:${step}`,
        step === 1 ? "Ya puedes pagar la segunda parte de tu plan" : "Falta la segunda parte de tu plan",
        `Tu plan ${plan?.name ?? ""} anual se paga en dos partes de ${(awaiting.amountCents / 100).toFixed(2)} USD. ` +
          "Ya está habilitada la segunda: págala desde Facturación con Payphone para completar tu año de acceso.",
        true
      );
      if (ok) sent++;
    }
    return sent;
  }

  static async renewDueSubscriptions(now = new Date()) {
    const summary = { charged: 0, failed: 0, reminded: 0, expired: 0, secondInstallmentReminders: 0 };
    summary.secondInstallmentReminders = await this.remindSecondInstallments(now);
    const subs = await prisma.subscription.findMany({
      where: {
        externalId: { startsWith: "pp_" },
        status: { in: ["active", "past_due"] },
        currentPeriodEnd: { lte: new Date(now.getTime() + 7 * DAY) },
      },
      include: { tenant: { select: { id: true, name: true, paymentCard: true } } },
      take: 200,
    });

    for (const sub of subs) {
      const planId = sub.planId.toUpperCase() as PlanId;
      const plan = SAAS_PLANS[planId];
      if (!plan) continue;
      const msLeft = sub.currentPeriodEnd.getTime() - now.getTime();
      const card = sub.tenant.paymentCard;
      // Un plan en dos pagos supera el máximo por cobro: nunca se cobra solo con la tarjeta
      const canAutoCharge = Boolean(card) && sub.autoRenew && isTokenizationEnabled() && chargeInstallments(planId, sub.billingInterval) === 1;

      // Venció hace más que la gracia: se marca vencida (el acceso ya se cortó)
      if (msLeft < -PAST_DUE_GRACE_DAYS * DAY) {
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: "canceled" } });
        summary.expired++;
        continue;
      }

      // Plan con Link de Suscripción: PayPhone cobra solo. Aquí nunca se cobra ni se
      // pide renovar a mano; si al vencer no llegó la notificación del cobro, pasa a
      // past_due (gracia) y se avisa una vez.
      if ((await BillingService.getCurrentSubscriptionPaymentMethod(sub.tenantId)) === "LINK") {
        if (msLeft <= 0) {
          if (sub.status === "active") await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
          const sent = await this.notify(
            sub.tenantId,
            "SUBSCRIPTION_PAYMENT_FAILED",
            `link-renewal-missing:${sub.tenantId}:${sub.currentPeriodEnd.toISOString().slice(0, 10)}`,
            "No recibimos la renovación de tu plan",
            `PayPhone aún no nos confirmó el cobro de renovación de tu plan ${plan.name}. Revisa tu tarjeta o tu suscripción en PayPhone; tienes ${PAST_DUE_GRACE_DAYS} días de gracia. Si ya se te cobró, escríbenos a info@mentorstudioglobal.com.`,
            true
          );
          if (sent) summary.reminded++;
        }
        continue;
      }

      // Pagó la parte 1 y falta la 2: el aviso lo envía remindSecondInstallments
      if (await BillingService.getAwaitingSecondInstallment(sub.tenantId, now)) {
        if (msLeft <= 0 && sub.status === "active") await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
        continue;
      }

      // Cobro automático: desde 1 día antes de vencer, un intento al día como máximo
      const recentlyTried = sub.lastRenewalAttemptAt && now.getTime() - sub.lastRenewalAttemptAt.getTime() < 20 * 60 * 60 * 1000;
      if (canAutoCharge && msLeft <= DAY && sub.renewalAttempts < MAX_RENEWAL_ATTEMPTS && !recentlyTried) {
        const ok = await this.chargeRenewal(sub.tenantId, planId, sub.billingInterval, card!, now);
        if (ok) summary.charged++;
        else summary.failed++;
        continue;
      }

      // Sin cobro automático: avisos 7, 3 y 1 días antes, y al vencer
      if (!canAutoCharge || sub.renewalAttempts >= MAX_RENEWAL_ATTEMPTS) {
        const days = Math.ceil(msLeft / DAY);
        const step = days <= 0 ? 0 : days <= 1 ? 1 : days <= 3 ? 3 : 7;
        if (msLeft <= 0 && sub.status === "active") {
          await prisma.subscription.update({ where: { id: sub.id }, data: { status: "past_due" } });
        }
        if (await this.remind(sub.tenantId, sub.currentPeriodEnd, step, Math.max(0, days), plan.name)) summary.reminded++;
      }
    }
    return summary;
  }

  private static async chargeRenewal(
    tenantId: string,
    planId: PlanId,
    billingInterval: BillingInterval,
    card: { tokenEncrypted: string; holderEncrypted: string },
    now: Date
  ): Promise<boolean> {
    const plan = SAAS_PLANS[planId];
    const amountCents = plan.pricing[billingInterval].amountCents;
    const payment = await prisma.payment.create({
      data: {
        tenantId,
        kind: "SUBSCRIPTION",
        method: "TOKEN",
        planId,
        billingInterval,
        amountCents,
        taxCents: splitIva(amountCents).tax,
        clientTransactionId: newClientTransactionId("R"),
      },
    });
    await prisma.subscription.update({
      where: { externalId: payphoneSubscriptionId(tenantId) },
      data: { lastRenewalAttemptAt: now, renewalAttempts: { increment: 1 } },
    });

    let result: PayphoneResult | null = null;
    let error: string | null = null;
    try {
      result = await chargeSavedCard({
        cardToken: open(card.tokenEncrypted),
        holder: JSON.parse(open(card.holderEncrypted)) as CardHolder,
        amountCents,
        clientTransactionId: payment.clientTransactionId,
        description: `Mentor Studio Global · Renovación ${plan.name}`,
      });
    } catch (e) {
      error = e instanceof Error ? e.message : "Error al cobrar la tarjeta";
    }

    if (result?.approved) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "APPROVED",
          payphoneTransactionId: result.transactionId,
          authorizationCode: result.authorizationCode,
          cardBrand: result.cardBrand,
          lastDigits: result.lastDigits,
          confirmedAt: new Date(),
        },
      });
      await BillingService.applySubscriptionPayment({ tenantId, planId, billingInterval });
      await this.notify(tenantId, "SUBSCRIPTION_RENEWED", `renewed:${payment.id}`, "Plan renovado", `Cobramos ${(amountCents / 100).toFixed(2)} USD a tu tarjeta y tu plan ${plan.name} sigue activo.`);
      return true;
    }

    const reason = error ?? result?.message ?? "La tarjeta fue rechazada";
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: reason.slice(0, 300) } });
    await this.notify(
      tenantId,
      "SUBSCRIPTION_PAYMENT_FAILED",
      `renew-failed:${payment.id}`,
      "No pudimos cobrar tu plan",
      `El cobro automático de ${(amountCents / 100).toFixed(2)} USD no se aprobó (${reason}). Renueva desde Facturación para no perder el acceso.`,
      true
    );
    return false;
  }

  /** Aviso de vencimiento (uno por paso y periodo). Devuelve true si se envió. */
  private static async remind(tenantId: string, periodEnd: Date, step: number, daysLeft: number, planName: string) {
    // Un aviso por escalón (7, 3, 1, 0) y periodo; el texto dice los días reales
    const key = `renewal-reminder:${tenantId}:${periodEnd.toISOString().slice(0, 10)}:${step}`;
    const when = step === 0 ? "venció" : daysLeft <= 1 ? "vence mañana" : `vence en ${daysLeft} días`;
    return this.notify(
      tenantId,
      "SUBSCRIPTION_RENEWAL_REMINDER",
      key,
      step === 0 ? "Tu plan venció" : "Tu plan está por vencer",
      `Tu plan ${planName} ${when}. Renuévalo desde Facturación con Payphone para seguir usando la plataforma${step === 0 ? ` (tienes ${PAST_DUE_GRACE_DAYS} días de gracia)` : ""}.`,
      true
    );
  }

  private static async notify(
    tenantId: string,
    type: "SUBSCRIPTION_RENEWAL_REMINDER" | "SUBSCRIPTION_RENEWED" | "SUBSCRIPTION_PAYMENT_FAILED",
    idempotencyKey: string,
    title: string,
    message: string,
    email = false
  ): Promise<boolean> {
    try {
      await prisma.notification.create({ data: { tenantId, type, title, message, idempotencyKey } });
    } catch (error) {
      // Ya avisado (idempotencyKey única)
      if ((error as { code?: string }).code === "P2002") return false;
      throw error;
    }
    if (email) {
      const owner = await prisma.membership.findFirst({ where: { tenantId, role: "OWNER" }, select: { user: { select: { email: true } } } });
      if (owner) {
        await sendEmail({
          to: owner.user.email,
          subject: title,
          html: `<p>${escapeHtml(message)}</p><p><a href="${getAppUrl()}/dashboard/billing">Ir a Facturación</a></p>`,
          text: `${message}\n\n${getAppUrl()}/dashboard/billing`,
        }).catch(() => undefined);
      }
    }
    return true;
  }
}

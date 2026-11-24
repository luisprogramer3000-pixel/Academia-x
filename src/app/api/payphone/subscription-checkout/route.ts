import { NextRequest, NextResponse } from "next/server";
import { AuthError, OWNER_ONLY, requireTenantAccess } from "@/lib/session";
import {
  PayphoneSubscriptionLinkService,
  SubscriptionCheckoutError,
  UNAVAILABLE_MESSAGE,
} from "@/modules/billing/payphone-subscription-link.service";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Inicia una suscripción recurrente con un Link de Suscripción de PayPhone.
 *
 * Body: { "planCode": "STARTER_MONTHLY" } — solo el código; la URL del link la
 * pone el servidor desde las variables PAYPHONE_SUB_* (nunca se acepta una URL
 * del cliente). Solo el OWNER de la academia; el tenant sale de la sesión.
 *
 * Academy Executive anual no va por aquí: se cobra con la Cajita en dos pagos.
 *
 * Respuesta: { checkoutUrl } (200) o { error } con 400 / 401 / 403 / 409 / 503.
 * Redirigir no activa nada: el plan se activa cuando PayPhone notifica el
 * primer cobro aprobado y Mentor lo verifica (ver NotificacionPago).
 */
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireTenantAccess(OWNER_ONLY);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.code === "UNAUTHORIZED" ? 401 : 403 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  }
  const planCode = (body as { planCode?: unknown } | null)?.planCode;

  try {
    const result = await PayphoneSubscriptionLinkService.startCheckout({ tenantId: ctx.tenantId, userId: ctx.userId, planCode });
    return NextResponse.json({
      checkoutUrl: result.checkoutUrl,
      replacesActiveLinkSubscription: result.replacesActiveLinkSubscription,
    });
  } catch (error) {
    const { t } = await getI18n();
    if (error instanceof SubscriptionCheckoutError) {
      // Mensaje en el idioma del usuario (el del error queda en español para los registros)
      const message =
        error.code === "INVALID_PLAN" ? t.serverErrors.invalidPlan
        : error.code === "ALREADY_ACTIVE" ? t.serverErrors.alreadyActive
        : t.serverErrors.paymentUnavailable;
      return NextResponse.json({ error: message, code: error.code }, { status: error.status });
    }
    console.error("[payphone] subscription-checkout:", error);
    return NextResponse.json({ error: t.serverErrors.paymentUnavailable || UNAVAILABLE_MESSAGE }, { status: 500 });
  }
}

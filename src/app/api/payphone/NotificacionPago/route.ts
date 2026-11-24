import { NextRequest, NextResponse } from "next/server";
import { PayphonePaymentService } from "@/modules/billing/payphone-payment.service";
import { PayphoneSubscriptionLinkService } from "@/modules/billing/payphone-subscription-link.service";

export const dynamic = "force-dynamic";

/**
 * Notificación externa de Payphone (requiere que Payphone la habilite para la
 * tienda; el método debe llamarse NotificacionPago). Solo avisa de pagos
 * aprobados y no viene firmada, así que NO se confía en su contenido: se
 * vuelve a confirmar con la API de Payphone antes de aplicar nada. Sirve de
 * respaldo si el cliente cierra el navegador antes de volver a la web.
 *
 * Dos orígenes:
 *  - Cajita/botón (pagos puntuales y planes por botón): el ClientTransactionId
 *    es nuestro → handleReturn (Confirm) como siempre.
 *  - Links de Suscripción (5 planes recurrentes): PayPhone asigna el
 *    ClientTransactionId, así que no lo reconocemos → se verifica la
 *    transacción con GET /api/Sale/{id} y se casa por importe + correo del
 *    pagador (PayphoneSubscriptionLinkService). Sirve para el primer cobro y,
 *    si PayPhone también notifica los cobros recurrentes, para las renovaciones.
 *
 * Respuesta que espera Payphone: { Response: true, ErrorCode: "000" }.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ Response: false, ErrorCode: "111" });
  }
  const id = Number(body.TransactionId);
  const clientTransactionId = typeof body.ClientTransactionId === "string" ? body.ClientTransactionId : "";
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ Response: false, ErrorCode: "444" });
  }

  try {
    // Sin ClientTransactionId no puede ser un pago del botón (siempre lo enviamos nosotros)
    const outcome = clientTransactionId
      ? await PayphonePaymentService.handleReturn({ id, clientTransactionId })
      : { status: "error" as const, kind: null };
    if (outcome.kind === null) {
      // No es un pago del botón: ¿cobro de un Link de Suscripción?
      const link = await PayphoneSubscriptionLinkService.handleNotification({ transactionId: id });
      if (link.status === "error") return NextResponse.json({ Response: false, ErrorCode: "222" });
      if (link.status === "ignored") console.warn(`[payphone] Notificación ${id} sin aplicar: ${link.reason}`);
      return NextResponse.json({ Response: true, ErrorCode: "000" });
    }
    // Pagos que no son nuestros: se reconocen igual para que Payphone no reintente
    return NextResponse.json({ Response: outcome.status !== "error" || outcome.kind === null, ErrorCode: outcome.status === "error" && outcome.kind !== null ? "222" : "000" });
  } catch (error) {
    console.error("[payphone] Notificación:", error);
    return NextResponse.json({ Response: false, ErrorCode: "222" });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { PayphonePaymentService } from "@/modules/billing/payphone-payment.service";

export const dynamic = "force-dynamic";

/**
 * Notificación externa de Payphone (requiere que Payphone la habilite para la
 * tienda; el método debe llamarse NotificacionPago). Solo avisa de pagos
 * aprobados y no viene firmada, así que NO se confía en su contenido: se
 * vuelve a confirmar con la API de Payphone antes de aplicar nada. Sirve de
 * respaldo si el cliente cierra el navegador antes de volver a la web.
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
  if (!Number.isInteger(id) || id <= 0 || !clientTransactionId) {
    return NextResponse.json({ Response: false, ErrorCode: "444" });
  }

  try {
    const outcome = await PayphonePaymentService.handleReturn({ id, clientTransactionId });
    // Pagos que no son nuestros: se reconocen igual para que Payphone no reintente
    return NextResponse.json({ Response: outcome.status !== "error" || outcome.kind === null, ErrorCode: outcome.status === "error" && outcome.kind !== null ? "222" : "000" });
  } catch (error) {
    console.error("[payphone] Notificación:", error);
    return NextResponse.json({ Response: false, ErrorCode: "222" });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { PayphonePaymentService } from "@/modules/billing/payphone-payment.service";

export const dynamic = "force-dynamic";

/**
 * "URL de Respuesta" de Payphone: el cliente vuelve aquí tras pagar con
 * ?id=<transacción>&clientTransactionId=<nuestro id> (y &ctoken=<tarjeta> si la
 * cuenta tiene tokenización). Se confirma con Payphone en el acto —si no se
 * confirma en 5 minutos, Payphone anula el cobro— y se vuelve al panel.
 */
export async function GET(req: NextRequest) {
  // Payphone no es constante con las mayúsculas (id / ID, clientTransactionId / ClientTransactionID)
  const params = new Map([...req.nextUrl.searchParams].map(([k, v]) => [k.toLowerCase(), v]));
  const id = Number(params.get("id"));
  const clientTransactionId = params.get("clienttransactionid") ?? "";
  const appUrl = getAppUrl();

  if (!Number.isInteger(id) || id <= 0 || !clientTransactionId) {
    return NextResponse.redirect(`${appUrl}/dashboard/billing?checkout=canceled`);
  }

  const outcome = await PayphonePaymentService.handleReturn({ id, clientTransactionId, cardToken: params.get("ctoken") });
  const base = outcome.kind === "TOPUP" ? "/dashboard/ai-copilot?topup=" : "/dashboard/billing?checkout=";
  const status = outcome.status === "approved" ? "success" : outcome.status === "canceled" ? "canceled" : "error";
  return NextResponse.redirect(`${appUrl}${base}${status}`);
}

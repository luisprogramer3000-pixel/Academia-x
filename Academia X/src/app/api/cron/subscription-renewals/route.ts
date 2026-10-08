import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuthorization } from "@/lib/cron-auth";
import { PayphonePaymentService } from "@/modules/billing/payphone-payment.service";

export const dynamic = "force-dynamic";

/**
 * Renovación de planes (cada hora): cobra la tarjeta guardada de las academias
 * que vencen en menos de un día (un intento diario, hasta 3), avisa a las que
 * no tienen cobro automático (7, 3 y 1 días antes y al vencer) y da por
 * vencidas las que pasaron la gracia. Idempotente: repetirlo no cobra dos veces.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuthorization(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await PayphonePaymentService.renewDueSubscriptions());
  } catch (error) {
    console.error("[CRON] Renovación de suscripciones:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

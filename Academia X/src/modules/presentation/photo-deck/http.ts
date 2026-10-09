import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { requireActiveSubscription } from "@/modules/billing/entitlements";
import { AICreditError } from "@/modules/ai/ai.credit-engine";
import { PhotoDeckError } from "./photo-deck.service";

/** Sesión del personal de la academia con plan vigente (todo esto usa IA). */
export async function photoDeckAuth() {
  const ctx = await requireTenantAccess(STAFF_ROLES);
  await requireActiveSubscription(ctx.tenantId);
  return { tenantId: ctx.tenantId, userId: ctx.userId };
}

/** Errores → respuesta JSON con un mensaje entendible para el profesor. */
export function photoDeckError(error: unknown) {
  if (error instanceof PhotoDeckError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Datos no válidos." }, { status: 400 });
  const message = error instanceof Error ? error.message : "";
  if (message === AICreditError.INSUFFICIENT_AI_CREDITS) {
    return NextResponse.json({ error: "No tienes créditos de IA suficientes. Recarga créditos o mejora tu plan." }, { status: 402 });
  }
  if (/sesión|autoriz|plan/i.test(message)) return NextResponse.json({ error: message }, { status: 403 });
  console.error("[photo-deck]", error);
  return NextResponse.json({ error: "No se pudo completar la operación. Inténtalo de nuevo." }, { status: 500 });
}

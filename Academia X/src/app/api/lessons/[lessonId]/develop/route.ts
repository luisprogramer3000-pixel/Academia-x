import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { requireActiveSubscription } from "@/modules/billing/entitlements";
import { AICreditError } from "@/modules/ai/ai.credit-engine";
import { developLesson, LessonDevelopError } from "@/modules/course/lesson-develop.service";

export const dynamic = "force-dynamic";
// Una clase completa con el Agente de Clase puede tardar más de un minuto
export const maxDuration = 600;

const schema = z.object({
  mode: z.enum(["full", "basic"]),
  /** Identificador de este intento: si se repite no se cobra dos veces */
  idempotencyKey: z.string().min(8).max(100),
});

/** Desarrolla con IA una lección vacía de un curso (se cobra por lección). */
export async function POST(req: NextRequest, context: { params: Promise<{ lessonId: string }> }) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(tenantId);
    const { lessonId } = await context.params;
    const body = schema.parse(await req.json());
    return NextResponse.json(await developLesson({ tenantId, userId, lessonId, mode: body.mode, idempotencyKey: body.idempotencyKey }));
  } catch (error) {
    if (error instanceof LessonDevelopError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
    const message = error instanceof Error ? error.message : "";
    if (message === AICreditError.INSUFFICIENT_AI_CREDITS) {
      return NextResponse.json({ error: "No tienes créditos de IA suficientes." }, { status: 402 });
    }
    if (/sesión|autoriz|plan/i.test(message)) return NextResponse.json({ error: message }, { status: 403 });
    console.error("[develop-lesson]", error);
    return NextResponse.json({ error: "La IA no pudo desarrollar esta lección (no se cobró). Inténtalo de nuevo." }, { status: 500 });
  }
}

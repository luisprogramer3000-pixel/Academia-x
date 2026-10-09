import { NextRequest, NextResponse } from "next/server";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { requireActiveSubscription } from "@/modules/billing/entitlements";
import { AICreditError } from "@/modules/ai/ai.credit-engine";
import { AIService } from "@/modules/ai/ai.service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Investiga el tema del curso con fuentes profesionales (una vez por curso,
 * 2 créditos). Las lecciones con IA se escriben después sobre ese marco.
 * { force: true } la rehace (vuelve a cobrar).
 */
export async function POST(req: NextRequest, context: { params: Promise<{ courseId: string }> }) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(tenantId);
    const { courseId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { force?: boolean };
    const brief = await AIService.researchCourse({ tenantId, userId, courseId, force: body.force === true });
    return NextResponse.json({ webSearch: brief.webSearch, sources: brief.sources, generatedAt: brief.generatedAt, preview: brief.brief.slice(0, 1200) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === AICreditError.INSUFFICIENT_AI_CREDITS) return NextResponse.json({ error: "No tienes créditos de IA suficientes." }, { status: 402 });
    if (message === "Curso no encontrado.") return NextResponse.json({ error: message }, { status: 404 });
    if (/sesión|autoriz|plan/i.test(message)) return NextResponse.json({ error: message }, { status: 403 });
    console.error("[course-research]", error);
    return NextResponse.json({ error: "No se pudo investigar el tema (no se cobró). Inténtalo de nuevo." }, { status: 500 });
  }
}

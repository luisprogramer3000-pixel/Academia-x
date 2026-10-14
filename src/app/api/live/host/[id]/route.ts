import { NextResponse } from "next/server";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { LiveService } from "@/modules/live/live.service";

export const dynamic = "force-dynamic";

/** Estado completo para la pantalla del profesor (incluye la respuesta correcta). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let tenantId: string;
  try {
    ({ tenantId } = await requireTenantAccess(STAFF_ROLES));
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = await LiveService.hostState(id, tenantId);
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

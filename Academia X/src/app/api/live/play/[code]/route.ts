import { NextResponse } from "next/server";
import { LiveService } from "@/modules/live/live.service";

export const dynamic = "force-dynamic";

/** Estado de la partida para el móvil del alumno (sondeo cada ~1,5 s). Público. */
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const pid = request.headers.get("x-live-participant");
  const token = request.headers.get("x-live-token");
  const state = await LiveService.playerState(code, pid, token);
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}

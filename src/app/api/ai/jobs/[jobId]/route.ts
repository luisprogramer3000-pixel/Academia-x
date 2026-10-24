import { NextResponse } from "next/server";
import { getAIJobAction } from "@/app/actions/ai.actions";

export const dynamic = "force-dynamic";

/** Estado de una generación en segundo plano (solo la ve quien la lanzó). */
export async function GET(_req: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  return NextResponse.json(await getAIJobAction(jobId), { headers: { "Cache-Control": "no-store" } });
}

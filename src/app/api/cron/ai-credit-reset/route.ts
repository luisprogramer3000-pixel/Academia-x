import { NextRequest, NextResponse } from "next/server";
import { AICreditJobService } from "@/modules/ai/ai.job-service";
import { verifyCronAuthorization } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!verifyCronAuthorization(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(1, Math.min(parseInt(limitParam, 10) || 50, 200)) : 50;

    const summary = await AICreditJobService.processMonthlyResetBatch({ limit });
    return NextResponse.json(summary, { status: 200 });
  } catch (error: any) {
    console.error(
      "[CRON] Error executing monthly reset batch:",
      error?.message ? String(error.message).replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***") : "Internal error"
    );
    return NextResponse.json(
      { error: "Internal Server Error in Monthly Reset Cron Job" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

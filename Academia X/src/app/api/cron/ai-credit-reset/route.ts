import { NextRequest, NextResponse } from "next/server";
import { AICreditJobService } from "@/modules/ai/ai.job-service";

export const dynamic = "force-dynamic";

function verifyAuthorization(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  // En producción, CRON_SECRET es estrictamente obligatorio
  if (isProduction && (!cronSecret || cronSecret.trim() === "")) {
    console.error("[CRON] Unauthorized: CRON_SECRET is missing in production environment.");
    return false;
  }

  // Si no hay secreto configurado en entornos locales/test no productivos, permitir
  if (!cronSecret) {
    return true;
  }

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : undefined;
  const customHeader = req.headers.get("x-cron-secret")?.trim();

  const isBearerValid = bearerToken !== undefined && bearerToken.length > 0 && bearerToken === cronSecret;
  const isCustomValid = customHeader !== undefined && customHeader.length > 0 && customHeader === cronSecret;

  return isBearerValid || isCustomValid;
}

export async function GET(req: NextRequest) {
  if (!verifyAuthorization(req)) {
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

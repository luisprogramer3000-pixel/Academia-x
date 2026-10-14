import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuthorization } from "@/lib/cron-auth";
import { TrashService } from "@/modules/course/trash.service";

export const dynamic = "force-dynamic";

/**
 * Tarea programada (1 vez al día): elimina definitivamente lo que lleva más de
 * 30 días en la papelera, en todas las academias. La papelera también se purga
 * sola al abrirla, así que esta tarea solo hace falta para academias inactivas.
 */
export async function GET(req: NextRequest) {
  if (!verifyCronAuthorization(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const purged = await TrashService.purgeExpired();
    return NextResponse.json({ purged }, { status: 200 });
  } catch (error) {
    console.error("[CRON] Error purgando la papelera:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal Server Error in Trash Purge" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}

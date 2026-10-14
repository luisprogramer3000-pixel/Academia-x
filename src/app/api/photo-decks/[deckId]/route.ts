import { NextRequest, NextResponse } from "next/server";
import { PhotoDeckService } from "@/modules/presentation/photo-deck/photo-deck.service";
import { photoDeckAuth, photoDeckError } from "@/modules/presentation/photo-deck/http";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ deckId: string }> };

export async function GET(_req: NextRequest, context: Ctx) {
  try {
    const { tenantId } = await photoDeckAuth();
    const { deckId } = await context.params;
    const deck = await PhotoDeckService.get(tenantId, deckId);
    return NextResponse.json({ id: deck.id, lessonId: deck.lessonId, status: deck.status, script: deck.script });
  } catch (error) {
    return photoDeckError(error);
  }
}

/** Paso 2: guarda el guion revisado por el profesor (gratis). */
export async function PUT(req: NextRequest, context: Ctx) {
  try {
    const { tenantId } = await photoDeckAuth();
    const { deckId } = await context.params;
    const body = (await req.json()) as { script?: unknown };
    const script = await PhotoDeckService.saveScript(tenantId, deckId, body.script);
    return NextResponse.json({ script });
  } catch (error) {
    return photoDeckError(error);
  }
}

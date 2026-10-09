import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PhotoDeckService } from "@/modules/presentation/photo-deck/photo-deck.service";
import { photoDeckAuth, photoDeckError } from "@/modules/presentation/photo-deck/http";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const createSchema = z.object({
  lessonId: z.string().min(1).max(60),
  density: z.enum(["minimo", "estandar", "detallado"]).default("estandar"),
  slides: z.number().int().min(5).max(24).optional(),
  idempotencyKey: z.string().min(8).max(100),
});

/** Paso 1: la IA escribe el guion de la lección (2 créditos). */
export async function POST(req: NextRequest) {
  try {
    const auth = await photoDeckAuth();
    const body = createSchema.parse(await req.json());
    const deck = await PhotoDeckService.createFromLesson({ ...auth, lessonId: body.lessonId, density: body.density, targetSlides: body.slides, idempotencyKey: body.idempotencyKey });
    return NextResponse.json({ id: deck.id });
  } catch (error) {
    return photoDeckError(error);
  }
}

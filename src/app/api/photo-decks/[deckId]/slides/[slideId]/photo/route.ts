import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PhotoDeckService } from "@/modules/presentation/photo-deck/photo-deck.service";
import { photoDeckAuth, photoDeckError } from "@/modules/presentation/photo-deck/http";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const schema = z.object({
  /** Con instrucción se cambia la foto actual ("cambia la foto por…, deja el resto igual") */
  instruction: z.string().trim().max(500).optional(),
  /** Identificador de este clic: si la petición se repite no se cobra dos veces */
  requestId: z.string().min(6).max(80),
});

/** Paso 3: genera o cambia la foto de una diapositiva (se cobra por foto). */
export async function POST(req: NextRequest, context: { params: Promise<{ deckId: string; slideId: string }> }) {
  try {
    const auth = await photoDeckAuth();
    const { deckId, slideId } = await context.params;
    const body = schema.parse(await req.json());
    const result = await PhotoDeckService.generatePhoto({ ...auth, deckId, slideId, instruction: body.instruction || undefined, requestId: body.requestId });
    return NextResponse.json(result);
  } catch (error) {
    return photoDeckError(error);
  }
}

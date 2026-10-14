import { NextRequest, NextResponse } from "next/server";
import { PhotoDeckService } from "@/modules/presentation/photo-deck/photo-deck.service";
import { photoDeckAuth, photoDeckError } from "@/modules/presentation/photo-deck/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Paso 4: descarga el PowerPoint (foto + texto real + notas del orador). */
export async function GET(_req: NextRequest, context: { params: Promise<{ deckId: string }> }) {
  try {
    const { tenantId } = await photoDeckAuth();
    const { deckId } = await context.params;
    const { file, title } = await PhotoDeckService.buildPptx(tenantId, deckId);
    const name = `${title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 80) || "presentacion"}.pptx`;
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return photoDeckError(error);
  }
}

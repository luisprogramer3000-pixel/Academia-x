import { NextResponse } from "next/server";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { getLibraryPreview } from "@/modules/presentation/presentation.library";

export const dynamic = "force-dynamic";

/** Miniatura de la portada del modelo (imagen junto al .pptx o miniatura interna). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireTenantAccess(STAFF_ROLES);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const preview = await getLibraryPreview(id).catch(() => null);
  if (!preview) return NextResponse.json({ error: "Sin miniatura" }, { status: 404 });
  return new NextResponse(new Uint8Array(preview.data), {
    // La URL lleva la versión (?v=...), así que puede guardarse mucho tiempo sin quedar desfasada
    headers: { "Content-Type": preview.mime, "Cache-Control": "private, max-age=86400" },
  });
}

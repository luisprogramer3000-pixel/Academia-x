import { NextResponse } from "next/server";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { openLibraryFile } from "@/lib/storage";
import { LibraryService } from "@/modules/library/library.service";

export const dynamic = "force-dynamic";

/**
 * Descarga de un archivo de la biblioteca de la plataforma. Solo para profesores
 * y dueños con sesión (de cualquier academia). Los no publicados solo los
 * descargan quien los subió y el administrador (para revisarlos).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requireTenantAccess(STAFF_ROLES);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const { id } = await params;
  const doc = await LibraryService.get(id).catch(() => null);
  const canSee = doc && (doc.status === "approved" || ctx.isSuperAdmin || doc.uploadedBy.userId === ctx.userId);
  if (!doc || !canSee) return new NextResponse("Not found", { status: 404 });

  const file = await openLibraryFile(doc.storageKey);
  if (!file) return new NextResponse("Not found", { status: 404 });

  // ?inline=1: miniatura en el selector de imágenes (se muestra, no se descarga ni se cuenta)
  const inline = new URL(req.url).searchParams.get("inline") === "1" && doc.mimeType.startsWith("image/");
  if (!inline && doc.status === "approved") await LibraryService.countDownload(id).catch(() => undefined);

  // Nombre de descarga seguro (RFC 5987) a partir del nombre original
  const safeName = doc.originalName.replace(/[\r\n"\\]/g, "_");
  return new NextResponse(file.body, {
    headers: {
      "Content-Type": doc.mimeType,
      ...(file.size !== null ? { "Content-Length": String(file.size) } : {}),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      "Cache-Control": inline ? "private, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

import { NextResponse } from "next/server";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { getLibraryPreviewVersion, getLibraryTemplate, listLibraryModels } from "@/modules/presentation/presentation.library";

export const dynamic = "force-dynamic";

/**
 * Modelos de PowerPoint disponibles (carpeta public/modelos powerpoint), con su
 * paleta para dibujar una vista previa si el modelo no tiene miniatura.
 */
export async function GET() {
  try {
    await requireTenantAccess(STAFF_ROLES);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const models = await listLibraryModels();
  const withPalette = await Promise.all(
    models.map(async (model) => {
      const tpl = await getLibraryTemplate(model.id).catch(() => null);
      const version = await getLibraryPreviewVersion(model).catch(() => 0);
      return { id: model.id, name: model.name, version, palette: tpl?.palette ?? null };
    })
  );
  return NextResponse.json(withPalette);
}

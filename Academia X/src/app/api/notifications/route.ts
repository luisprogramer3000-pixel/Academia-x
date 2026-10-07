import { NextResponse } from "next/server";
import { getTenantNotificationsAction } from "@/app/actions/notification.actions";

export const dynamic = "force-dynamic";

/**
 * Notificaciones de la campana del panel. Es una ruta GET y no una acción del
 * servidor a propósito: Next.js ejecuta las acciones de una página de una en
 * una, y una consulta periódica lenta dejaba en cola los botones de guardar.
 * La sesión y el rol se comprueban igual que en la acción (requireTenantAccess).
 */
export async function GET() {
  const res = await getTenantNotificationsAction();
  return NextResponse.json(res, { status: res.success ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}

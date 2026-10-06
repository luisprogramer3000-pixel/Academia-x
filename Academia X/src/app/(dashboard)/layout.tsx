import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PanelTheme } from "@/components/dashboard/PanelTheme";

/**
 * Layout del panel del profesor: aplica el color de fondo elegido en
 * Configuración & Branding. La autenticación y los permisos los sigue
 * comprobando cada página (getDashboardContext).
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const tenant = session?.tenantId
    ? await prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { panelColor: true } })
    : null;
  return <PanelTheme color={tenant?.panelColor ?? null}>{children}</PanelTheme>;
}

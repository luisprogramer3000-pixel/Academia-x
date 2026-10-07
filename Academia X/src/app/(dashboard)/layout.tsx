import type { ReactNode } from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { PanelTheme } from "@/components/dashboard/PanelTheme";
import { AdminFlagProvider } from "@/components/dashboard/AdminFlag";

/**
 * Layout del panel del profesor: aplica el color de fondo elegido en
 * Configuración & Branding. La autenticación y los permisos los sigue
 * comprobando cada página (getDashboardContext).
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const [tenant, user] = await Promise.all([
    session?.tenantId ? prisma.tenant.findUnique({ where: { id: session.tenantId }, select: { panelColor: true } }) : null,
    // El rol se lee de la base de datos, no del token: así deja de verse al quitarlo
    session?.userId ? prisma.user.findUnique({ where: { id: session.userId }, select: { globalRole: true } }) : null,
  ]);
  return (
    <AdminFlagProvider isPlatformAdmin={user?.globalRole === "SUPER_ADMIN"}>
      <PanelTheme color={tenant?.panelColor ?? null}>{children}</PanelTheme>
    </AdminFlagProvider>
  );
}

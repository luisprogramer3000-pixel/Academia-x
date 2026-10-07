"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Indica al menú lateral si quien navega es administrador de la plataforma,
 * para mostrarle la sección de administración. Solo afecta a lo que se ve:
 * cada página de administración comprueba el permiso en el servidor.
 */
const AdminFlagContext = createContext(false);

export function AdminFlagProvider({ isPlatformAdmin, children }: { isPlatformAdmin: boolean; children: ReactNode }) {
  return <AdminFlagContext.Provider value={isPlatformAdmin}>{children}</AdminFlagContext.Provider>;
}

export const useIsPlatformAdmin = () => useContext(AdminFlagContext);

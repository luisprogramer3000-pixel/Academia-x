"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BrandScope } from "@/lib/brand-theme";

/**
 * Color de fondo del panel del profesor (Configuración & Branding). Reutiliza
 * BrandScope: las clases slate-* del panel pasan al color elegido y, si es claro,
 * el texto pasa a oscuro. Sin color guardado, el panel queda oscuro como siempre.
 *
 * La pantalla del quiz en vivo se proyecta a pantalla completa con su propio
 * diseño (texto blanco sobre degradado): se queda siempre igual.
 */
export function PanelTheme({ color, children }: { color: string | null; children: ReactNode }) {
  const pathname = usePathname();
  if (!color || pathname.startsWith("/dashboard/live/")) return <>{children}</>;
  return <BrandScope color={color}>{children}</BrandScope>;
}

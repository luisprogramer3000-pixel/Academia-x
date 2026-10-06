import type { Metadata } from "next";

/** Rutas temporales de comparación de heroes: no se indexan. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function HeroPreviewLayout({ children }: { children: React.ReactNode }) {
  return <div className="light" data-theme="light">{children}</div>;
}

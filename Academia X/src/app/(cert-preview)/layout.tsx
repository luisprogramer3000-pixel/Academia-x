import type { Metadata } from "next";

/** Vistas previas de las plantillas de certificado (temporales, no indexables). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function CertPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* A4 horizontal, sin márgenes: "Imprimir → Guardar como PDF" produce el certificado exacto */}
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print {
          html, body { background: #fff !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .cert-stage { padding: 0 !important; background: none !important; min-height: 0 !important; }
          .cert-wrap { width: auto !important; height: auto !important; margin: 0 !important; box-shadow: none !important; }
          .cert-scale { transform: none !important; width: auto !important; height: auto !important; }
          .certificate-sheet { break-inside: avoid; }
        }
      `}</style>
      {children}
    </>
  );
}

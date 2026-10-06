import type { CertificateData } from "./certificate-data";
import { CertificateTemplate1 } from "./CertificateTemplate1";
import { CertificateTemplate2 } from "./CertificateTemplate2";
import { CertificateTemplate3 } from "./CertificateTemplate3";
import { CertificateTemplate4 } from "./CertificateTemplate4";

/**
 * Diseños de certificado que el profesor elige por curso (Course.certificateTemplate)
 * y que se congelan en cada certificado emitido (Certificate.template).
 */
export const CERTIFICATE_DESIGNS = [
  { id: "INSTITUTIONAL", name: "Institucional moderno", description: "Azul marino, banda lateral con sello y QR. Claro y profesional.", swatch: "linear-gradient(90deg, #0E2A52 0 30%, #ffffff 30%)", Component: CertificateTemplate2 },
  { id: "PREMIUM", name: "Clásico premium", description: "Borgoña y oro, sello con cintas. Ceremonial, para graduaciones.", swatch: "linear-gradient(#6B1424, #6B1424) padding-box, #FCFAF5", Component: CertificateTemplate1 },
  { id: "LUXURY", name: "Lujo minimalista", description: "Marfil y oro, protagonismo tipográfico. Para reconocimientos.", swatch: "linear-gradient(135deg, #FBF8F1, #EFE4CC)", Component: CertificateTemplate3 },
  { id: "ACADEMIC", name: "Académico decorado", description: "Azul noche, borde de seguridad y sello dorado. Documento oficial.", swatch: "linear-gradient(135deg, #122447, #1C3566)", Component: CertificateTemplate4 },
] as const;

export type CertificateDesignId = (typeof CERTIFICATE_DESIGNS)[number]["id"];
export const CERTIFICATE_DESIGN_IDS = CERTIFICATE_DESIGNS.map((d) => d.id) as string[];

/** Plantillas anteriores → su equivalente nuevo (los certificados ya emitidos se ven con el diseño nuevo). */
const LEGACY: Record<string, CertificateDesignId> = { CLASSIC: "PREMIUM", MODERN: "INSTITUTIONAL", ELEGANT: "LUXURY" };

export function resolveDesign(id: string | null | undefined) {
  const key = (id || "").toUpperCase();
  const mapped = LEGACY[key] ?? key;
  return CERTIFICATE_DESIGNS.find((d) => d.id === mapped) ?? CERTIFICATE_DESIGNS[0];
}

export function CertificateView({ templateId, data }: { templateId: string | null | undefined; data: CertificateData }) {
  const { Component } = resolveDesign(templateId);
  return <Component data={data} />;
}

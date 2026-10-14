/**
 * Plantillas de certificado que el profesor elige por curso.
 *
 * Son definiciones de estilo, no HTML: la misma plantilla se usa para la vista
 * de verificación pública y para el PDF, así que debe poder pintarse en ambos.
 */

export type CertificateTemplateId = "CLASSIC" | "MODERN" | "ELEGANT";

export interface CertificateTemplate {
  id: CertificateTemplateId;
  name: string;
  description: string;
  /** Texto de encabezado sobre el nombre del alumno */
  heading: string;
  /** Frase que introduce el curso */
  statement: string;
  style: {
    background: string;
    surface: string;
    border: string;
    accent: string;
    heading: string;
    body: string;
    /** Tipografía del nombre del alumno */
    nameClass: string;
    /** Adorno del marco */
    frame: "double" | "minimal" | "ornate";
  };
}

export const CERTIFICATE_TEMPLATES: Record<CertificateTemplateId, CertificateTemplate> = {
  CLASSIC: {
    id: "CLASSIC",
    name: "Clásico",
    description: "Marco doble y tipografía serif. El formato académico de toda la vida.",
    heading: "Certificado de Aprovechamiento",
    statement: "Se certifica que ha completado satisfactoriamente el curso",
    style: {
      background: "#f8fafc",
      surface: "#ffffff",
      border: "#1e293b",
      accent: "#1e3a8a",
      heading: "#0f172a",
      body: "#334155",
      nameClass: "font-serif",
      frame: "double",
    },
  },
  MODERN: {
    id: "MODERN",
    name: "Moderno",
    description: "Limpio, sin adornos, con una banda de color. Encaja con marcas actuales.",
    heading: "Certificado de Finalización",
    statement: "Otorgado por completar con éxito el programa",
    style: {
      background: "#0f172a",
      surface: "#1e293b",
      border: "#334155",
      accent: "#3b82f6",
      heading: "#ffffff",
      body: "#cbd5e1",
      nameClass: "font-sans",
      frame: "minimal",
    },
  },
  ELEGANT: {
    id: "ELEGANT",
    name: "Elegante",
    description: "Fondo crema y detalles dorados. Para programas premium y diplomas.",
    heading: "Diploma de Excelencia",
    statement: "Concedido en reconocimiento a la superación del programa",
    style: {
      background: "#fdfaf3",
      surface: "#ffffff",
      border: "#b8912f",
      accent: "#a37b1f",
      heading: "#3f2f10",
      body: "#6b5a33",
      nameClass: "font-serif",
      frame: "ornate",
    },
  },
};

export function getCertificateTemplate(id: string | null | undefined): CertificateTemplate {
  const key = (id || "CLASSIC").toUpperCase() as CertificateTemplateId;
  return CERTIFICATE_TEMPLATES[key] || CERTIFICATE_TEMPLATES.CLASSIC;
}

export const CERTIFICATE_TEMPLATE_LIST = Object.values(CERTIFICATE_TEMPLATES);

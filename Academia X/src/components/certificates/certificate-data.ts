/**
 * Datos de un certificado. Todos los campos son opcionales: lo que falte se
 * muestra con su placeholder ([NOMBRE COMPLETO DEL ESTUDIANTE]…), así la misma
 * plantilla sirve de maqueta y de certificado real al conectarla con datos.
 */
export interface CertificateData {
  academyName?: string;
  /** URL del logo (si no hay, se usan las iniciales de la academia) */
  logoUrl?: string | null;
  /** Certificado de Aprobación, Diploma, Certificado de Reconocimiento… */
  certificateType?: string;
  studentName?: string;
  courseName?: string;
  level?: string;
  achievement?: string;
  hours?: string;
  modality?: string;
  issueDate?: string;
  code?: string;
  signerName?: string;
  signerRole?: string;
  /** URL de una imagen de firma (PNG transparente) */
  signatureUrl?: string | null;
  /** URL pública de verificación (para el QR y el texto de validación) */
  verifyUrl?: string;
  /** Texto del sello: "Certificado Premium Verificado" */
  sealText?: string;
  /** QR real (SVG) de la URL de verificación */
  qrSvg?: string | null;
  /**
   * "preview": lo que falte se muestra con su placeholder (maquetas).
   * "real": certificado emitido; los campos opcionales vacíos se ocultan y no se dibuja una firma de ejemplo.
   */
  mode?: "preview" | "real";
}

export const PLACEHOLDERS: Required<Omit<CertificateData, "logoUrl" | "signatureUrl" | "qrSvg" | "mode">> = {
  academyName: "[NOMBRE DE LA ACADEMIA]",
  certificateType: "[TIPO DE CERTIFICADO]",
  studentName: "[NOMBRE COMPLETO DEL ESTUDIANTE]",
  courseName: "[NOMBRE DEL CURSO]",
  level: "[NIVEL]",
  achievement: "[DESCRIPCIÓN DEL LOGRO]",
  hours: "[CARGA HORARIA]",
  modality: "[MODALIDAD]",
  issueDate: "[FECHA DE EMISIÓN]",
  code: "[CÓDIGO DEL CERTIFICADO]",
  signerName: "[NOMBRE DEL DOCENTE]",
  signerRole: "[CARGO]",
  verifyUrl: "[URL DE VALIDACIÓN]",
  sealText: "Certificado Premium Verificado",
};

/** Campos que en un certificado real pueden no existir (se ocultan en lugar de mostrar el placeholder) */
const OPTIONAL = new Set<keyof typeof PLACEHOLDERS>(["hours", "modality", "level", "signerName", "signerRole", "achievement"]);

export function withPlaceholders(d: CertificateData) {
  const real = d.mode === "real";
  const v = <K extends keyof typeof PLACEHOLDERS>(k: K) => (d[k] && String(d[k]).trim()) || (real && OPTIONAL.has(k) ? "" : PLACEHOLDERS[k]);
  return {
    academyName: v("academyName"),
    certificateType: v("certificateType"),
    studentName: v("studentName"),
    courseName: v("courseName"),
    level: v("level"),
    achievement: v("achievement"),
    hours: v("hours"),
    modality: v("modality"),
    issueDate: v("issueDate"),
    code: v("code"),
    signerName: v("signerName"),
    signerRole: v("signerRole"),
    verifyUrl: v("verifyUrl"),
    sealText: v("sealText"),
    real,
    qrSvg: d.qrSvg ?? null,
    logoUrl: d.logoUrl ?? null,
    signatureUrl: d.signatureUrl ?? null,
    initials: (d.academyName || "AC").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
  };
}

export type ResolvedCertificate = ReturnType<typeof withPlaceholders>;

/** Ejemplo realista para las vistas previas. */
export const SAMPLE_CERTIFICATE: CertificateData = {
  academyName: "Academy Ec",
  certificateType: "Certificado de Aprobación",
  studentName: "María Fernanda Torres Vélez",
  courseName: "Español como Lengua Extranjera",
  level: "Nivel B1 · Intermedio (MCER)",
  achievement:
    "Por haber completado y aprobado satisfactoriamente el programa, demostrando las competencias lingüísticas correspondientes al nivel B1 del Marco Común Europeo de Referencia.",
  hours: "120 horas académicas",
  modality: "Online",
  issueDate: "6 de octubre de 2026",
  code: "AEC-2026-0148",
  signerName: "Lorena Fernández",
  signerRole: "Directora Académica",
  verifyUrl: "mentorstudioglobal.com/verify/AEC-2026-0148",
  sealText: "Certificado Premium Verificado",
};

/** Une partes no vacías: join("120 h", "", "Online") → "120 h · Online" */
export function joinParts(...parts: string[]): string {
  return parts.filter((p) => p && p.trim()).join(" · ");
}

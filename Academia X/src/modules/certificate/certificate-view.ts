import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { formatInTimezone } from "@/lib/timezone";
import type { CertificateData } from "@/components/certificates/certificate-data";

/**
 * Convierte un certificado emitido (BD) en los datos de la plantilla:
 * nombres reales, fecha en la zona horaria de la academia, docente que lo
 * aprobó y QR real a la página pública de verificación.
 */
export async function buildCertificateData(cert: {
  code: string;
  issuedAt: Date;
  issuedByUserId: string | null;
  cryptoHash: string | null;
  user: { name: string | null; email: string };
  course: { title: string; level: string };
  tenant: { name: string; logoUrl: string | null; timezone: string };
}): Promise<CertificateData> {
  const host = (process.env.NEXT_PUBLIC_APP_HOST || "mentorstudioglobal.com").replace(/^https?:\/\//, "");
  const verifyUrl = `https://${host}/verify/${cert.code}`;
  const [issuer, qrSvg] = await Promise.all([
    cert.issuedByUserId ? prisma.user.findUnique({ where: { id: cert.issuedByUserId }, select: { name: true } }).catch(() => null) : null,
    QRCode.toString(verifyUrl, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#111827", light: "#ffffff" } }).catch(() => null),
  ]);
  return {
    mode: "real",
    academyName: cert.tenant.name,
    logoUrl: cert.tenant.logoUrl,
    certificateType: "Certificado de Aprobación",
    studentName: cert.user.name || cert.user.email,
    courseName: cert.course.title,
    level: cert.course.level ? `Nivel ${cert.course.level}` : "",
    achievement: "Por haber completado satisfactoriamente los requisitos académicos y las evaluaciones del programa",
    modality: "Online",
    issueDate: formatInTimezone(cert.issuedAt, cert.tenant.timezone, { day: "numeric", month: "long", year: "numeric" }),
    code: cert.code,
    // Sin docente registrado (certificados antiguos o reclamados por el alumno): firma la academia
    signerName: issuer?.name || cert.tenant.name,
    signerRole: issuer?.name ? "Docente" : "Institución emisora",
    verifyUrl: verifyUrl.replace(/^https:\/\//, ""),
    sealText: cert.cryptoHash ? "Certificado Premium Verificado" : "Certificado Verificado",
    qrSvg,
  };
}

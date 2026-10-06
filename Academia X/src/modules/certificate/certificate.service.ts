import { prisma } from "@/lib/db";
import { cryptoNativeToken } from "@/lib/utils";
import crypto from "crypto";

export interface IssueCertificateInput {
  tenantId: string;
  userId: string;
  courseId: string;
  /** Profesor que aprueba la emisión (queda registrado) */
  issuedByUserId?: string;
  /** Plantilla; si se omite, se toma la configurada en el curso */
  template?: string;
}

/**
 * Firma del certificado.
 *
 * Antes se calculaba con Date.now(), lo que la hacía IMPOSIBLE de recomprobar:
 * el hash cambiaba en cada ejecución y no demostraba nada. Ahora es un HMAC
 * determinista sobre los datos del certificado y la fecha real de emisión, con
 * una clave que solo conoce el servidor. Cualquiera puede pedir la verificación
 * y el servidor recalcula la firma: si coincide, el certificado es auténtico y
 * sus datos no han sido alterados.
 */
function signCertificate(params: {
  tenantId: string;
  userId: string;
  courseId: string;
  code: string;
  issuedAt: Date;
}): string {
  const secret = process.env.CERTIFICATE_SIGNING_SECRET || process.env.JWT_SECRET || "";
  if (!secret) throw new Error("Falta CERTIFICATE_SIGNING_SECRET o JWT_SECRET para firmar certificados.");

  const payload = [
    params.tenantId,
    params.userId,
    params.courseId,
    params.code,
    params.issuedAt.toISOString(),
  ].join("|");

  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export class CertificateService {
  /**
   * Genera un código de verificación único para certificados (ej. AX-CERT-9A8B7C6D).
   */
  static generateCertificateCode(): string {
    const randomHex = cryptoNativeToken().slice(0, 8).toUpperCase();
    return `AX-CERT-${randomHex}`;
  }

  /**
   * Emite un certificado para un estudiante que completó un curso.
   */
  static async issueCertificate(input: IssueCertificateInput) {
    // Idempotente: un único certificado por alumno y curso
    const existing = await prisma.certificate.findFirst({
      where: { tenantId: input.tenantId, userId: input.userId, courseId: input.courseId },
      include: { course: true, tenant: true, user: true },
    });
    if (existing) return existing;

    let code = this.generateCertificateCode();

    // Garantizar unicidad de código
    while (await prisma.certificate.findUnique({ where: { code } })) {
      code = this.generateCertificateCode();
    }

    const course = await prisma.course.findFirst({
      where: { id: input.courseId, tenantId: input.tenantId },
      select: { certificateTemplate: true },
    });
    if (!course) throw new Error("Curso no encontrado en esta academia.");

    const issuedAt = new Date();
    const cryptoHash = signCertificate({
      tenantId: input.tenantId,
      userId: input.userId,
      courseId: input.courseId,
      code,
      issuedAt,
    });

    return prisma.certificate.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        courseId: input.courseId,
        code,
        cryptoHash,
        issuedAt,
        template: input.template || course.certificateTemplate || "CLASSIC",
        issuedByUserId: input.issuedByUserId || null,
      },
      include: {
        course: true,
        tenant: true,
        user: true,
      },
    });
  }

  /**
   * Recalcula la firma y confirma que el certificado es auténtico.
   * Devuelve false si alguien alteró los datos en base de datos.
   */
  static verifySignature(certificate: {
    tenantId: string;
    userId: string;
    courseId: string;
    code: string;
    issuedAt: Date;
    cryptoHash: string | null;
  }): boolean {
    if (!certificate.cryptoHash) return false;
    try {
      const expected = signCertificate(certificate);
      // Comparación en tiempo constante
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(certificate.cryptoHash, "hex");
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Consulta pública de verificación de un certificado por su código único.
   */
  static async getCertificateByCode(code: string) {
    return prisma.certificate.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        tenant: true,
        course: true,
        user: true,
      },
    });
  }

  /**
   * Obtiene todos los certificados emitidos por una academia.
   */
  static async getCertificatesByTenant(tenantId: string) {
    return prisma.certificate.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
      orderBy: { issuedAt: "desc" },
    });
  }
}

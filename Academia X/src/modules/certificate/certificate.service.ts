import { prisma } from "@/lib/db";
import { cryptoNativeToken } from "@/lib/utils";
import crypto from "crypto";

export interface IssueCertificateInput {
  tenantId: string;
  userId: string;
  courseId: string;
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

    const subscription = await prisma.subscription.findFirst({
      where: { tenantId: input.tenantId, status: "active" },
    });
    
    // PRO or ACADEMY are premium plans
    const isPremium = subscription?.planId === "PRO" || subscription?.planId === "ACADEMY";

    let cryptoHash = null;
    if (isPremium) {
      const payload = `${input.tenantId}-${input.userId}-${input.courseId}-${Date.now()}-${code}`;
      cryptoHash = crypto.createHash("sha256").update(payload).digest("hex");
    }

    return prisma.certificate.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        courseId: input.courseId,
        code,
        cryptoHash,
      },
      include: {
        course: true,
        tenant: true,
        user: true,
      },
    });
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
        user: true,
        course: true,
      },
      orderBy: { issuedAt: "desc" },
    });
  }
}

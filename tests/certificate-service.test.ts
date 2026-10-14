import { describe, it, expect } from "vitest";
import { CertificateService } from "@/modules/certificate/certificate.service";

describe("Certificate Engine & Unique Hash Verification", () => {
  it("Debe generar un código de verificación único con prefijo AX-CERT-", () => {
    const code1 = CertificateService.generateCertificateCode();
    const code2 = CertificateService.generateCertificateCode();

    expect(code1).toMatch(/^AX-CERT-[A-Z0-9]{8}$/);
    expect(code2).toMatch(/^AX-CERT-[A-Z0-9]{8}$/);
    expect(code1).not.toBe(code2);
  });
});

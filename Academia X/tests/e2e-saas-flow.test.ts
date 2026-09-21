import { describe, it, expect } from "vitest";
import { slugify } from "@/modules/academy/academy.service";
import { CertificateService } from "@/modules/certificate/certificate.service";
import { MockAIAdapter } from "@/modules/ai/ai.adapter";

describe("E2E SaaS Critical User Flow Verification", () => {
  it("Paso 1: Generación de slug para nueva academia", () => {
    const slug = slugify("JL Global Institute Georgia");
    expect(slug).toBe("jl-global-institute-georgia");
  });

  it("Paso 2: Generación automatizada de borrador de curso con Copiloto IA", async () => {
    const aiAdapter = new MockAIAdapter();
    const result = await aiAdapter.generateCourseStructure({
      topic: "Español Medico",
      level: "B2",
      language: "es",
      modulesCount: 2,
    });

    expect(result.modules).toHaveLength(2);
    expect(result.level).toBe("B2");
  });

  it("Paso 3: Emisión y verificación pública del certificado", () => {
    const certCode = CertificateService.generateCertificateCode();
    expect(certCode).toMatch(/^AX-CERT-[A-Z0-9]{8}$/);
  });
});

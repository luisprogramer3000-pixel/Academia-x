import { describe, it, expect } from "vitest";
import {
  tenantIdSchema,
  planIdSchema,
  creditAmountSchema,
  topupPackageIdSchema,
  emailSchema,
  courseCreateSchema,
} from "@/lib/validations";
import { GET as cronHandler } from "@/app/api/cron/ai-credit-reset/route";
import { NextRequest } from "next/server";

describe("Security Suite — Zod Input Validation, Tenant & Auth Hardening", () => {
  describe("Validación Zod de Inputs Críticos", () => {
    it("1. Rechaza tenantId con inyección de código o formato inválido", () => {
      expect(() => tenantIdSchema.parse("")).toThrow();
      expect(() => tenantIdSchema.parse("tenant<script>")).toThrow();
      expect(() => tenantIdSchema.parse("tenant id con espacios")).toThrow();
      expect(tenantIdSchema.parse("tenant_valido-123")).toBe("tenant_valido-123");
    });

    it("2. Rechaza montos de crédito negativos o no enteros", () => {
      expect(() => creditAmountSchema.parse(-50)).toThrow();
      expect(() => creditAmountSchema.parse(0)).toThrow();
      expect(() => creditAmountSchema.parse(10.5)).toThrow();
      expect(creditAmountSchema.parse(100)).toBe(100);
    });

    it("3. Rechaza planes SaaS no autorizados", () => {
      expect(() => planIdSchema.parse("FREE")).toThrow();
      expect(() => planIdSchema.parse("ENTERPRISE")).toThrow();
      expect(planIdSchema.parse("STARTER")).toBe("STARTER");
      expect(planIdSchema.parse("PRO")).toBe("PRO");
      expect(planIdSchema.parse("ACADEMY")).toBe("ACADEMY");
    });

    it("4. Rechaza paquetes Top-Up no reconocidos", () => {
      expect(() => topupPackageIdSchema.parse("UNLIMITED_CREDITS")).toThrow();
      expect(topupPackageIdSchema.parse("TEACHER_TOPUP_150")).toBe("TEACHER_TOPUP_150");
      expect(topupPackageIdSchema.parse("STUDENT_TOPUP_100")).toBe("STUDENT_TOPUP_100");
    });

    it("5. Rechaza emails malformados", () => {
      expect(() => emailSchema.parse("sin-arroba.com")).toThrow();
      expect(() => emailSchema.parse("@sin-usuario.com")).toThrow();
      expect(emailSchema.parse("usuario@dominio.com")).toBe("usuario@dominio.com");
    });
  });

  describe("Protección y Autenticación del Endpoint Cron", () => {
    it("6. Endpoint /api/cron/ai-credit-reset deniega acceso si no existe CRON_SECRET válido", async () => {
      process.env.CRON_SECRET = "secret_super_seguro_123";
      try {
        const req = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset");
        const res = await cronHandler(req);
        expect(res.status).toBe(401);
      } finally {
        delete process.env.CRON_SECRET;
      }
    });

    it("7. Endpoint /api/cron/ai-credit-reset permite acceso cuando se envía la cabecera X-CRON-SECRET válida", async () => {
      process.env.CRON_SECRET = "secret_super_seguro_123";
      try {
        const req = new NextRequest("http://localhost:3000/api/cron/ai-credit-reset?limit=1", {
          headers: {
            "x-cron-secret": "secret_super_seguro_123",
          },
        });
        const res = await cronHandler(req);
        expect(res.status).toBe(200);
      } finally {
        delete process.env.CRON_SECRET;
      }
    });
  });
});

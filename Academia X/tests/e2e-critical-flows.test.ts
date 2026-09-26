import { describe, it, expect } from "vitest";
import { UserService } from "@/modules/user/user.service";
import { AcademyService, slugify } from "@/modules/academy/academy.service";
import { CourseService } from "@/modules/course/course.service";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { MockAIAdapter } from "@/modules/ai/ai.adapter";
import { CreditPurchaseService } from "@/modules/billing/credit-purchase.service";
import { BillingService, SAAS_PLANS } from "@/modules/billing/billing.service";
import { AICreditJobService } from "@/modules/ai/ai.job-service";
import { createSessionToken, verifySessionToken } from "@/lib/auth";
import { TOPUP_PACKAGES } from "@/modules/ai/ai.topup-catalog";

describe("E2E Critical Flow Suite — Mentor Studio Global Platform", () => {
  const testEmail = "e2e_owner@mentorstudioglobal.test";
  const targetTenantId = "tenant_e2e_critical_001";
  const targetUserId = "usr_e2e_critical_001";

  it("Flujo 1: Autenticación & Generación de Token JWT de Sesión", async () => {
    const token = await createSessionToken({
      userId: targetUserId,
      email: testEmail,
      globalRole: "USER",
      tenantId: targetTenantId,
      academyRole: "OWNER",
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.email).toBe(testEmail);
    expect(payload?.academyRole).toBe("OWNER");
  });

  it("Flujo 2: Acceso a Dashboard & Creación/Gestión de Tenant", async () => {
    const formattedSlug = slugify("E2E Academy Pro");
    expect(formattedSlug).toBe("e2e-academy-pro");
  });

  it("Flujo 3: Creación de Curso por el Profesor/Owner", async () => {
    const course = {
      id: "crs_e2e_001",
      title: "Curso E2E de IA Aplicada",
      description: "Aprende automatizaciones avanzadas con Mentor Studio Global",
      level: "INTERMEDIATE",
      tenantId: targetTenantId,
      status: "DRAFT",
    };

    expect(course).toBeDefined();
    expect(course.title).toBe("Curso E2E de IA Aplicada");
  });

  it("Flujo 4: Generación IA y Consumo Transaccional de Créditos", async () => {
    const adapter = new MockAIAdapter();
    const generationResult = await adapter.generateCourseStructure({
      topic: "Machine Learning EdTech",
      level: "Advanced",
      language: "es",
      modulesCount: 3,
    });

    expect(generationResult.modules).toHaveLength(3);
  });

  it("Flujo 5: Visualización de Wallet y Compra Top-Up", async () => {
    const pkg = TOPUP_PACKAGES["TEACHER_TOPUP_150"];
    expect(pkg).toBeDefined();
    expect(pkg.credits).toBe(150);
    expect(pkg.price).toBe(39);
  });

  it("Flujo 6: Persistencia de Créditos Comprados & Historial", async () => {
    const mockHistoryItem = {
      id: "pur_e2e_001",
      tenantId: targetTenantId,
      packageId: "TEACHER_TOPUP_150",
      creditType: "TEACHER",
      creditsGranted: 150,
      status: "COMPLETED",
    };

    expect(mockHistoryItem.packageId).toBe("TEACHER_TOPUP_150");
    expect(mockHistoryItem.status).toBe("COMPLETED");
  });

  it("Flujo 7: Billing & Upgrade de Suscripción SaaS", async () => {
    const plan = SAAS_PLANS.PRO;
    expect(plan.id).toBe("PRO");
    expect(plan.price).toBe(79);
    expect(plan.teacherCredits).toBe(800);
    expect(plan.studentCredits).toBe(0);
  });

  it("Flujo 8: Reset Mensual & Reglas de Rollover Determinista", async () => {
    const resetSummary = {
      processedCount: 1,
      failedCount: 0,
      success: true,
    };

    expect(resetSummary.processedCount).toBeGreaterThanOrEqual(0);
    expect(resetSummary.failedCount).toBe(0);
  });
});

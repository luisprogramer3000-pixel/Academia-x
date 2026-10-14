import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { AIOperation } from "@prisma/client";
import { AICreditEngine, AICreditError } from "@/modules/ai/ai.credit-engine";

describe("AICreditEngine Concurrency Hardening — Step 4.3.2", () => {
  const createTestContext = async (slug: string, teacherCredits = 100, studentCredits = 100) => {
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      await prisma.tenant.delete({ where: { id: existingTenant.id } });
    }

    const tenant = await prisma.tenant.create({
      data: { name: `Tenant Conc ${slug}`, slug },
    });

    const wallet = await prisma.aICreditWallet.create({
      data: {
        tenantId: tenant.id,
        teacherCredits,
        studentCredits,
        monthlyTeacherAllowance: teacherCredits,
        monthlyStudentAllowance: studentCredits,
        resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const userEmail = `${slug}@conc.com`;
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: "Test User Conc",
        },
      });
    }

    await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: "OWNER",
      },
    });

    return { tenant, wallet, user };
  };

  it("1. Wallet = 10 cr -> 2 solicitudes simultáneas de 5 cr ambas se aprueban (Saldo final = 0)", async () => {
    const { tenant, user } = await createTestContext("conc-exact", 10, 50);

    try {
      const results = await Promise.all([
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits
          idempotencyKey: `k_ex1_${Date.now()}`,
        }),
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits
          idempotencyKey: `k_ex2_${Date.now()}`,
        }),
      ]);

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(0);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("2. Wallet = 9 cr -> 2 solicitudes simultáneas de 5 cr -> 1 aprueba, 1 rechaza (Saldo final = 4)", async () => {
    const { tenant, user } = await createTestContext("conc-partial", 9, 50);

    try {
      const results = await Promise.allSettled([
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits
          idempotencyKey: `k_part1_${Date.now()}`,
        }),
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits
          idempotencyKey: `k_part2_${Date.now()}`,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      if (rejected[0].status === "rejected") {
        expect((rejected[0].reason as Error).message).toBe(AICreditError.INSUFFICIENT_AI_CREDITS);
      }

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(4); // 9 - 5 = 4
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("3. Wallet = 10 cr -> 5 solicitudes simultáneas con claves diferentes -> Máximo 2 aprobadas (Saldo = 0)", async () => {
    const { tenant, user } = await createTestContext("conc-stress", 10, 50);

    try {
      const promises = Array.from({ length: 5 }).map((_, i) =>
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits
          idempotencyKey: `k_stress_${i}_${Date.now()}`,
        })
      );

      const results = await Promise.allSettled(promises);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(2);
      expect(rejected.length).toBe(3);

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(0);

      const ledgers = await prisma.aICreditTransaction.count({ where: { tenantId: tenant.id } });
      expect(ledgers).toBe(2);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("4. Operaciones simultáneas Teacher vs Student consumen de sus bolsas aisladas", async () => {
    const { tenant, user } = await createTestContext("conc-isolate", 5, 5);

    try {
      const results = await Promise.all([
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 Teacher Credits
          idempotencyKey: `k_iso_t_${Date.now()}`,
        }),
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.AI_TUTOR, // 1 Student Credit
          idempotencyKey: `k_iso_s_${Date.now()}`,
        }),
      ]);

      expect(results[0].remainingTeacherCredits).toBe(0);
      expect(results[1].remainingStudentCredits).toBe(4);

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(0);
      expect(wallet?.studentCredits).toBe(4);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });
});

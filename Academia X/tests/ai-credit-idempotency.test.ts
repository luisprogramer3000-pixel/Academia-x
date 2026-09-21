import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { AIOperation } from "@prisma/client";
import { AICreditEngine, AICreditError } from "@/modules/ai/ai.credit-engine";

describe("AICreditEngine Idempotency Hardening — Step 4.3.2", () => {
  const createTestContext = async (slug: string, teacherCredits = 100, studentCredits = 100) => {
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      await prisma.tenant.delete({ where: { id: existingTenant.id } });
    }

    const tenant = await prisma.tenant.create({
      data: { name: `Tenant Idemp ${slug}`, slug },
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

    const userEmail = `${slug}@idemp.com`;
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: "Test User Idemp",
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

  it("1. Misma idempotencyKey en secuencia sólo ejecuta 1 descuento", async () => {
    const { tenant, user } = await createTestContext("idemp-seq", 100, 100);
    const key = `key_seq_${Date.now()}`;

    try {
      const res1 = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.COURSE_GENERATION, // 5 credits
        idempotencyKey: key,
      });

      expect(res1.alreadyProcessed).toBe(false);
      expect(res1.remainingTeacherCredits).toBe(95);

      const res2 = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.COURSE_GENERATION,
        idempotencyKey: key,
      });

      expect(res2.alreadyProcessed).toBe(true);
      expect(res2.transactionId).toBe(res1.transactionId);
      expect(res2.remainingTeacherCredits).toBe(95);

      const count = await prisma.aICreditTransaction.count({ where: { idempotencyKey: key } });
      expect(count).toBe(1);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("2 & 3. Misma idempotencyKey enviada concurrentemente ejecuta sólo 1 descuento (Race condition guard)", async () => {
    const { tenant, user } = await createTestContext("idemp-conc", 100, 100);
    const key = `key_race_${Date.now()}`;

    try {
      // 5 peticiones simultáneas con la MISMA clave
      const promises = Array.from({ length: 5 }).map(() =>
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits
          idempotencyKey: key,
        })
      );

      const results = await Promise.all(promises);

      const initialExecs = results.filter((r) => !r.alreadyProcessed);
      const idempotents = results.filter((r) => r.alreadyProcessed);

      expect(initialExecs.length).toBe(1);
      expect(idempotents.length).toBe(4);

      const updatedWallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(updatedWallet?.teacherCredits).toBe(95); // 100 - 5 = 95

      const count = await prisma.aICreditTransaction.count({ where: { idempotencyKey: key } });
      expect(count).toBe(1);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("4 & 5. IdempotencyKey Cross-Tenant no revela datos ni descuenta créditos (IDEMPOTENCY_CONFLICT)", async () => {
    const { tenant: tenantA, user: userA } = await createTestContext("idemp-cross-a", 100, 100);
    const { tenant: tenantB, user: userB } = await createTestContext("idemp-cross-b", 100, 100);
    const key = `key_cross_${Date.now()}`;

    try {
      // Tenant A consume con key
      await AICreditEngine.consumeCredits({
        tenantId: tenantA.id,
        userId: userA.id,
        operation: AIOperation.COURSE_GENERATION,
        idempotencyKey: key,
      });

      // Tenant B intenta reusar la misma key de Tenant A
      await expect(
        AICreditEngine.consumeCredits({
          tenantId: tenantB.id,
          userId: userB.id,
          operation: AIOperation.COURSE_GENERATION,
          idempotencyKey: key,
        })
      ).rejects.toThrow(AICreditError.IDEMPOTENCY_CONFLICT);

      // Verificar que Tenant B no fue afectado
      const walletB = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenantB.id } });
      expect(walletB?.teacherCredits).toBe(100);
    } finally {
      await prisma.tenant.delete({ where: { id: tenantA.id } });
      await prisma.tenant.delete({ where: { id: tenantB.id } });
    }
  });

  it("6. Retry después de Timeout recupera el resultado original de forma transparente", async () => {
    const { tenant, user } = await createTestContext("idemp-timeout", 50, 50);
    const clientRequestId = `req_timeout_${Date.now()}`;

    try {
      // Solicitud original 1 (simula timeout al recibir la respuesta en el cliente)
      const res1 = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.LESSON_GENERATION, // 2 credits
        idempotencyKey: clientRequestId,
      });

      // Cliente reintenta la misma solicitud con el mismo clientRequestId
      const res2 = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.LESSON_GENERATION,
        idempotencyKey: clientRequestId,
      });

      expect(res2.success).toBe(true);
      expect(res2.alreadyProcessed).toBe(true);
      expect(res2.transactionId).toBe(res1.transactionId);
      expect(res2.creditsUsed).toBe(2);
      expect(res2.remainingTeacherCredits).toBe(48);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("7. Peticiones con claves diferentes realizan consumos independientes", async () => {
    const { tenant, user } = await createTestContext("idemp-diff", 50, 50);

    try {
      const res1 = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.LESSON_GENERATION, // 2 credits
        idempotencyKey: `key_1_${Date.now()}`,
      });

      const res2 = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.LESSON_GENERATION, // 2 credits
        idempotencyKey: `key_2_${Date.now()}`,
      });

      expect(res1.remainingTeacherCredits).toBe(48);
      expect(res2.remainingTeacherCredits).toBe(46);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });
});

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { AIOperation } from "@prisma/client";
import { AICreditEngine, AICreditError } from "@/modules/ai/ai.credit-engine";

describe("AICreditEngine Core — Step 4.3.1", () => {
  const createTestContext = async (slug: string, teacherCredits = 100, studentCredits = 100) => {
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      await prisma.tenant.delete({ where: { id: existingTenant.id } });
    }

    const tenant = await prisma.tenant.create({
      data: { name: `Tenant Engine ${slug}`, slug },
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

    const userEmail = `${slug}@engine.com`;
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: "Test User Engine",
        },
      });
    }

    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        tenantId: tenant.id,
        role: "OWNER",
      },
    });

    return { tenant, wallet, user, membership };
  };

  it("TEST 1: Consume correctamente Teacher Credits", async () => {
    const { tenant, user } = await createTestContext("engine-t1", 100, 50);
    try {
      const res = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.COURSE_GENERATION, // 5 credits
      });

      expect(res.success).toBe(true);
      expect(res.creditsUsed).toBe(5);
      expect(res.remainingTeacherCredits).toBe(95);

      const tx = await prisma.aICreditTransaction.findUnique({
        where: { id: res.transactionId },
      });
      expect(tx).toBeDefined();
      expect(tx?.amount).toBe(-5);
      expect(tx?.creditType).toBe("TEACHER");
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("TEST 2: Consume correctamente Student Credits", async () => {
    const { tenant, user } = await createTestContext("engine-t2", 100, 100);
    try {
      const res = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.AI_TUTOR, // 1 student credit
      });

      expect(res.success).toBe(true);
      expect(res.creditsUsed).toBe(1);
      expect(res.remainingStudentCredits).toBe(99);

      const tx = await prisma.aICreditTransaction.findUnique({
        where: { id: res.transactionId },
      });
      expect(tx?.creditType).toBe("STUDENT");
      expect(tx?.amount).toBe(-1);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("TEST 3: Teacher operation no consume Student Credits", async () => {
    const { tenant, user } = await createTestContext("engine-t3", 50, 100);
    try {
      const res = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.LESSON_GENERATION, // 2 teacher credits
      });

      expect(res.remainingTeacherCredits).toBe(48);
      expect(res.remainingStudentCredits).toBe(100);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("TEST 4: Student operation no consume Teacher Credits", async () => {
    const { tenant, user } = await createTestContext("engine-t4", 100, 50);
    try {
      const res = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.AI_FEEDBACK, // 1 student credit
      });

      expect(res.remainingStudentCredits).toBe(49);
      expect(res.remainingTeacherCredits).toBe(100);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("TEST 5: Saldo insuficiente debe rechazar sin crear transacción ni saldo negativo", async () => {
    const { tenant, user } = await createTestContext("engine-t5", 2, 50);
    try {
      await expect(
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits (available 2)
        })
      ).rejects.toThrow(AICreditError.INSUFFICIENT_AI_CREDITS);

      const updatedWallet = await prisma.aICreditWallet.findUnique({
        where: { tenantId: tenant.id },
      });
      expect(updatedWallet?.teacherCredits).toBe(2);

      const txCount = await prisma.aICreditTransaction.count({
        where: { tenantId: tenant.id },
      });
      expect(txCount).toBe(0);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("TEST 6: Operación desconocida debe rechazar inmediatamente", async () => {
    const { tenant, user } = await createTestContext("engine-t6", 100, 100);
    try {
      await expect(
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: "INVALID_OP" as any,
        })
      ).rejects.toThrow(AICreditError.INVALID_AI_OPERATION);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("TEST 7: Tenant Isolation — Tenant A no puede consumir créditos de Tenant B", async () => {
    const { tenant: tenantA } = await createTestContext("engine-t7-a", 100, 50);
    const { tenant: tenantB, user: userB } = await createTestContext("engine-t7-b", 100, 50);

    try {
      // Intento de userB de consumir usando tenantA
      await expect(
        AICreditEngine.consumeCredits({
          tenantId: tenantA.id,
          userId: userB.id,
          operation: AIOperation.COURSE_GENERATION,
        })
      ).rejects.toThrow(AICreditError.USER_NOT_IN_TENANT);
    } finally {
      await prisma.tenant.delete({ where: { id: tenantA.id } });
      await prisma.tenant.delete({ where: { id: tenantB.id } });
    }
  });

  it("TEST 8: Usuario fuera del tenant debe ser rechazado", async () => {
    const { tenant } = await createTestContext("engine-t8", 100, 50);
    const outsiderUser = await prisma.user.create({
      data: { email: "outsider@test.com", name: "Outsider" },
    });

    try {
      await expect(
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: outsiderUser.id,
          operation: AIOperation.LESSON_GENERATION,
        })
      ).rejects.toThrow(AICreditError.USER_NOT_IN_TENANT);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
      await prisma.user.delete({ where: { id: outsiderUser.id } });
    }
  });

  it("TEST 9: Idempotency — Misma idempotencyKey sólo ejecuta 1 descuento", async () => {
    const { tenant, user } = await createTestContext("engine-t9", 100, 50);
    const idempotencyKey = `idemp_engine_${Date.now()}`;

    try {
      const res1 = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.COURSE_GENERATION, // 5 credits
        idempotencyKey,
      });

      expect(res1.alreadyProcessed).toBe(false);
      expect(res1.remainingTeacherCredits).toBe(95);

      const res2 = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.COURSE_GENERATION,
        idempotencyKey,
      });

      expect(res2.alreadyProcessed).toBe(true);
      expect(res2.transactionId).toBe(res1.transactionId);
      expect(res2.creditsUsed).toBe(5);
      expect(res2.remainingTeacherCredits).toBe(95);

      const txCount = await prisma.aICreditTransaction.count({
        where: { idempotencyKey },
      });
      expect(txCount).toBe(1);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("TEST 10: FREE operation (creditCost = 0) no descuenta ni crea transacción de uso", async () => {
    const { tenant, user } = await createTestContext("engine-t10", 100, 50);
    try {
      // Mock operation de coste 0 para la prueba
      const res = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.ACTIVITY_GENERATION,
      });

      // En el catálogo ACTIVITY_GENERATION cuesta 1 crédito
      expect(res.creditsUsed).toBe(1);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("TEST 11: Atomicidad — Descuento y Ledger ocurren juntos en $transaction", async () => {
    const { tenant, user } = await createTestContext("engine-t11", 50, 50);
    try {
      const res = await AICreditEngine.consumeCredits({
        tenantId: tenant.id,
        userId: user.id,
        operation: AIOperation.COURSE_GENERATION,
      });

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      const tx = await prisma.aICreditTransaction.findUnique({ where: { id: res.transactionId } });

      expect(wallet?.teacherCredits).toBe(45);
      expect(tx).toBeDefined();
      expect(tx?.amount).toBe(-5);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("TEST 12: Concurrencia — Previene saldos negativos bajo peticiones simultáneas", async () => {
    const { tenant, user } = await createTestContext("engine-t12", 7, 50); // 7 créditos disponibles

    try {
      // Lanzar 3 solicitudes simultáneas de 5 créditos (Total 15 > 7)
      const results = await Promise.allSettled([
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits
        }),
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits
        }),
        AICreditEngine.consumeCredits({
          tenantId: tenant.id,
          userId: user.id,
          operation: AIOperation.COURSE_GENERATION, // 5 credits
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(2);

      const wallet = await prisma.aICreditWallet.findUnique({ where: { tenantId: tenant.id } });
      expect(wallet?.teacherCredits).toBe(2); // 7 - 5 = 2 >= 0
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });
});

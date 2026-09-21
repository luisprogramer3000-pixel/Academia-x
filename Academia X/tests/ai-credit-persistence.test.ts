import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";

describe("AI Credit Persistence Layer — Step 4.1", () => {
  const createTestContext = async (slug: string) => {
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      await prisma.tenant.delete({ where: { id: existingTenant.id } });
    }

    const tenant = await prisma.tenant.create({
      data: { name: `Test Tenant ${slug}`, slug },
    });

    const userEmail = `${slug}@test.com`;
    let user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: "Test User Credits",
        },
      });
    }

    return { tenant, user };
  };

  it("1. Un tenant puede tener exactamente una wallet de créditos", async () => {
    const { tenant } = await createTestContext("tenant-wallet-test-1");
    try {
      const wallet = await prisma.aICreditWallet.create({
        data: {
          tenantId: tenant.id,
          teacherCredits: 150,
          studentCredits: 50,
          monthlyTeacherAllowance: 150,
          monthlyStudentAllowance: 50,
          resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      expect(wallet).toBeDefined();
      expect(wallet.tenantId).toBe(tenant.id);
      expect(wallet.teacherCredits).toBe(150);
      expect(wallet.studentCredits).toBe(50);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("2. Dos wallets no pueden pertenecer al mismo tenant (Unique Constraint)", async () => {
    const { tenant } = await createTestContext("tenant-wallet-test-2");
    try {
      await prisma.aICreditWallet.create({
        data: {
          tenantId: tenant.id,
          teacherCredits: 100,
          resetAt: new Date(),
        },
      });

      await expect(
        prisma.aICreditWallet.create({
          data: {
            tenantId: tenant.id,
            teacherCredits: 200,
            resetAt: new Date(),
          },
        })
      ).rejects.toThrow();
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("3 & 4. Una transacción pertenece a un tenant y opcionalmente a un usuario", async () => {
    const { tenant, user } = await createTestContext("tenant-tx-test-3");
    try {
      const txWithUser = await prisma.aICreditTransaction.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          creditType: "TEACHER",
          amount: -5,
          transactionType: "USAGE",
          operation: "COURSE_GENERATION",
          referenceId: "ref_course_123",
          metadata: { notes: "Created via AI Copilot" },
        },
      });

      expect(txWithUser.id).toBeDefined();
      expect(txWithUser.userId).toBe(user.id);
      expect(txWithUser.creditType).toBe("TEACHER");

      const txWithoutUser = await prisma.aICreditTransaction.create({
        data: {
          tenantId: tenant.id,
          creditType: "TEACHER",
          amount: 150,
          transactionType: "ALLOCATION",
          operation: "COURSE_GENERATION",
        },
      });

      expect(txWithoutUser.id).toBeDefined();
      expect(txWithoutUser.userId).toBeNull();
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("5. AIUsage puede vincularse a una AICreditTransaction", async () => {
    const { tenant, user } = await createTestContext("tenant-aiusage-tx-test-5");
    try {
      const tx = await prisma.aICreditTransaction.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          creditType: "TEACHER",
          amount: -2,
          transactionType: "USAGE",
          operation: "LESSON_GENERATION",
        },
      });

      const usage = await prisma.aIUsage.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          feature: "LESSON_GENERATOR",
          provider: "mock-ai",
          model: "gpt-4o-mini",
          promptTokens: 250,
          completionTokens: 500,
          estimatedCost: 0.0008,
          creditsUsed: 2,
          creditTransactionId: tx.id,
        },
      });

      expect(usage.creditTransactionId).toBe(tx.id);
      expect(usage.creditsUsed).toBe(2);

      const usageWithTx = await prisma.aIUsage.findUnique({
        where: { id: usage.id },
        include: { creditTransaction: true },
      });

      expect(usageWithTx?.creditTransaction).toBeDefined();
      expect(usageWithTx?.creditTransaction?.amount).toBe(-2);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("6. AIUsage histórico con creditTransactionId = null sigue funcionando correctamente", async () => {
    const { tenant, user } = await createTestContext("tenant-aiusage-null-test-6");
    try {
      const historicalUsage = await prisma.aIUsage.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          feature: "COURSE_GENERATOR",
          provider: "mock-ai",
          model: "gpt-4o-mini",
          promptTokens: 450,
          completionTokens: 850,
          estimatedCost: 0.0015,
        },
      });

      expect(historicalUsage.creditTransactionId).toBeNull();
      expect(historicalUsage.creditsUsed).toBe(0);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("7. No puede existir idempotencyKey duplicada", async () => {
    const { tenant, user } = await createTestContext("tenant-idempotency-test-7");
    try {
      const idempotencyKey = `idemp_${Date.now()}_abc`;

      await prisma.aICreditTransaction.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          creditType: "TEACHER",
          amount: -5,
          transactionType: "USAGE",
          operation: "COURSE_GENERATION",
          idempotencyKey,
        },
      });

      await expect(
        prisma.aICreditTransaction.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            creditType: "TEACHER",
            amount: -5,
            transactionType: "USAGE",
            operation: "COURSE_GENERATION",
            idempotencyKey,
          },
        })
      ).rejects.toThrow();
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });
});

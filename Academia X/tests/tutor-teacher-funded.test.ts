import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { AICreditEngine, AICreditError } from "../src/modules/ai/ai.credit-engine";
import { prisma } from "../src/lib/db";
import { AIOperation, AICreditType } from "@prisma/client";

describe("Tutor IA financiado por el profesor (opción A)", () => {
  const tenantId = "tenant_tutor_test";
  const userId = "user_tutor_test";

  const clean = async () => {
    await prisma.aICreditTransaction.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.aICreditWallet.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.membership.deleteMany({ where: { tenantId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
    await prisma.tenant.deleteMany({ where: { id: tenantId } }).catch(() => {});
  };

  beforeEach(async () => {
    await clean();
    await prisma.tenant.create({ data: { id: tenantId, name: "Tutor Test", slug: "tutor-test-slug" } });
    await prisma.user.create({ data: { id: userId, email: "tutor_test@test.com" } });
    await prisma.membership.create({ data: { tenantId, userId, role: "STUDENT" } });
  }, 30000);

  afterAll(clean);

  it("con el tutor DESACTIVADO, el alumno no puede gastar", async () => {
    await prisma.aICreditWallet.create({
      data: { tenantId, teacherCredits: 100, studentCredits: 0, allowTeacherCreditsForStudents: false, resetAt: new Date() },
    });
    await expect(
      AICreditEngine.consumeCredits({ tenantId, userId, operation: AIOperation.AI_TUTOR, idempotencyKey: "k1" })
    ).rejects.toThrow(AICreditError.INSUFFICIENT_AI_CREDITS);

    const w = await prisma.aICreditWallet.findUnique({ where: { tenantId } });
    expect(w?.teacherCredits).toBe(100); // no se tocó la bolsa del profesor
  }, 30000);

  it("con el tutor ACTIVADO, cobra de los créditos del profesor", async () => {
    await prisma.aICreditWallet.create({
      data: { tenantId, teacherCredits: 100, studentCredits: 0, allowTeacherCreditsForStudents: true, resetAt: new Date() },
    });
    const res = await AICreditEngine.consumeCredits({
      tenantId, userId, operation: AIOperation.AI_TUTOR, idempotencyKey: "k2",
    });
    expect(res.success).toBe(true);
    expect(res.creditType).toBe(AICreditType.TEACHER);

    const w = await prisma.aICreditWallet.findUnique({ where: { tenantId } });
    expect(w?.teacherCredits).toBe(100 - res.creditsUsed);
    expect(w?.studentCredits).toBe(0);
  }, 30000);

  it("las operaciones del profesor siguen cobrándose igual que antes", async () => {
    await prisma.aICreditWallet.create({
      data: { tenantId, teacherCredits: 100, studentCredits: 0, allowTeacherCreditsForStudents: true, resetAt: new Date() },
    });
    const res = await AICreditEngine.consumeCredits({
      tenantId, userId, operation: AIOperation.COURSE_GENERATION, idempotencyKey: "k3",
    });
    expect(res.creditType).toBe(AICreditType.TEACHER);
  }, 30000);
});

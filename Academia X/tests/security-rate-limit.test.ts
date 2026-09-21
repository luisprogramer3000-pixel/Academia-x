import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "@/lib/rate-limit";
import { loginAction } from "@/app/actions/auth.actions";
import { publicRegisterStudentAction } from "@/app/actions/user.actions";

describe("Security Suite — Rate Limiting & Brute Force Protection", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("1. Debe permitir peticiones dentro del límite establecido", async () => {
    const key = "test_rate_limit_ok";
    for (let i = 0; i < 5; i++) {
      const res = await checkRateLimit({ key, limit: 5, windowMs: 60_000 });
      expect(res.success).toBe(true);
    }
  });

  it("2. Debe bloquear peticiones al exceder el límite máximo (Fuerza Bruta)", async () => {
    const key = "test_rate_limit_block";
    for (let i = 0; i < 5; i++) {
      await checkRateLimit({ key, limit: 5, windowMs: 60_000 });
    }
    const blockedRes = await checkRateLimit({ key, limit: 5, windowMs: 60_000 });
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.remaining).toBe(0);
  });

  it("3. loginAction debe aplicar rate limiting tras múltiples intentos erróneos", async () => {
    const formData = new FormData();
    formData.set("email", "attack_user@test.com");
    formData.set("password", "bad_password");

    // Ejecutar 5 veces
    for (let i = 0; i < 5; i++) {
      await loginAction(formData);
    }

    // El 6to intento debe fallar con error de rate limit
    const blockedLogin = await loginAction(formData);
    expect(blockedLogin.success).toBe(false);
    expect(blockedLogin.error).toContain("Demasiados intentos");
  });

  it("4. publicRegisterStudentAction debe limitar peticiones de registro masivo", async () => {
    const formData = new FormData();
    formData.set("tenantId", "tenant_spam_test");
    formData.set("name", "Spam User");
    formData.set("email", "spam@bot.com");

    for (let i = 0; i < 3; i++) {
      await publicRegisterStudentAction(formData);
    }

    const blockedRegister = await publicRegisterStudentAction(formData);
    expect(blockedRegister.success).toBe(false);
    expect(blockedRegister.error).toContain("Demasiadas solicitudes");
  });
});

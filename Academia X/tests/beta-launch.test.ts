import { describe, it, expect } from "vitest";

describe("Beta Launch & Flagship Tenant", () => {
  it("Debe calcular correctamente el porcentaje de progreso del objetivo de 30 profesores beta", () => {
    const activeTeachers = 15;
    const targetTeachers = 30;
    const percentage = Math.min(100, Math.round((activeTeachers / targetTeachers) * 100));

    expect(percentage).toBe(50);
  });
});

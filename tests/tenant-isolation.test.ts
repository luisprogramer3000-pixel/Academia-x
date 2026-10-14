import { describe, it, expect } from "vitest";

// Mock minimal de verificación de aislamiento de tenant
function filterCoursesByTenant(courses: Array<{ id: string; title: string; tenantId: string }>, activeTenantId: string) {
  return courses.filter((c) => c.tenantId === activeTenantId);
}

describe("Tenant Isolation Enforcement", () => {
  const mockCourses = [
    { id: "c1", title: "Español A1 - JL Institute", tenantId: "tenant_jl_global" },
    { id: "c2", title: "Inglés B2 - JL Institute", tenantId: "tenant_jl_global" },
    { id: "c3", title: "Francés A1 - Otra Academia", tenantId: "tenant_otra_academia" },
  ];

  it("Debe devolver únicamente los cursos del tenant activo", () => {
    const tenantId = "tenant_jl_global";
    const result = filterCoursesByTenant(mockCourses, tenantId);

    expect(result).toHaveLength(2);
    expect(result.every((c) => c.tenantId === tenantId)).toBe(true);
  });

  it("NO debe permitir acceso a cursos de otro tenant (Bloqueo de Tenant Leakage)", () => {
    const tenantId = "tenant_jl_global";
    const result = filterCoursesByTenant(mockCourses, tenantId);

    const hasOtherTenantData = result.some((c) => c.tenantId === "tenant_otra_academia");
    expect(hasOtherTenantData).toBe(false);
  });
});

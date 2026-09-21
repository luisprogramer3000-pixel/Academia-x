import { describe, it, expect } from "vitest";
import { SAAS_PLANS } from "@/modules/billing/billing.service";

describe("Billing & SaaS Plans Configuration", () => {
  it("Debe definir correctamente los 3 niveles de planes SaaS (STARTER, PRO, ACADEMY)", () => {
    expect(SAAS_PLANS.STARTER).toBeDefined();
    expect(SAAS_PLANS.PRO).toBeDefined();
    expect(SAAS_PLANS.ACADEMY).toBeDefined();

    expect(SAAS_PLANS.STARTER.price).toBe(29);
    expect(SAAS_PLANS.PRO.price).toBe(79);
    expect(SAAS_PLANS.ACADEMY.price).toBe(199);
  });
});

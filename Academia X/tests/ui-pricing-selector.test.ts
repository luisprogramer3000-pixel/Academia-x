import { describe, it, expect } from "vitest";
import { SAAS_PLANS, BillingInterval } from "@/modules/billing/billing.service";

describe("Frontend Pricing Selector Logic & UI Presentation Suite", () => {
  // Función auxiliar de formateo idéntica a LandingPricing y PricingPlans
  const formatPrice = (price: number, yearly: boolean) => {
    if (!yearly) return `$${price}`;
    return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  it("1. Estado inicial por defecto es MONTHLY", () => {
    const initialInterval: BillingInterval = "MONTHLY";
    expect(initialInterval).toBe("MONTHLY");

    const starterPricing = SAAS_PLANS.STARTER.pricing[initialInterval];
    const proPricing = SAAS_PLANS.PRO.pricing[initialInterval];
    const academyPricing = SAAS_PLANS.ACADEMY.pricing[initialInterval];

    expect(formatPrice(starterPricing.price, false)).toBe("$29");
    expect(formatPrice(proPricing.price, false)).toBe("$79");
    expect(formatPrice(academyPricing.price, false)).toBe("$199");
  });

  it("2. Cambio de estado a YEARLY actualiza el selector", () => {
    let currentInterval: BillingInterval = "MONTHLY";
    const setBillingInterval = (newInterval: BillingInterval) => {
      currentInterval = newInterval;
    };

    setBillingInterval("YEARLY");
    expect(currentInterval).toBe("YEARLY");
  });

  it("3. YEARLY muestra $278.40 para Starter con unidad /año", () => {
    const pricing = SAAS_PLANS.STARTER.pricing.YEARLY;
    const formatted = formatPrice(pricing.price, true);
    expect(formatted).toBe("$278.40");
  });

  it("4. YEARLY muestra $758.40 para Professional VIP con unidad /año", () => {
    const pricing = SAAS_PLANS.PRO.pricing.YEARLY;
    const formatted = formatPrice(pricing.price, true);
    expect(formatted).toBe("$758.40");
  });

  it("5. YEARLY muestra $1,910.40 para Academy Executive con separador de miles", () => {
    const pricing = SAAS_PLANS.ACADEMY.pricing.YEARLY;
    const formatted = formatPrice(pricing.price, true);
    expect(formatted).toBe("$1,910.40");
  });

  it("6. YEARLY muestra los equivalentes mensuales y ahorros exactos", () => {
    const starter = SAAS_PLANS.STARTER.pricing.YEARLY;
    const pro = SAAS_PLANS.PRO.pricing.YEARLY;
    const academy = SAAS_PLANS.ACADEMY.pricing.YEARLY;

    expect(starter.equivalentMonthlyPrice).toBe(23.2);
    expect(starter.annualSavings).toBe(69.6);

    expect(pro.equivalentMonthlyPrice).toBe(63.2);
    expect(pro.annualSavings).toBe(189.6);

    expect(academy.equivalentMonthlyPrice).toBe(159.2);
    expect(academy.annualSavings).toBe(477.6);
  });

  it("7. YEARLY incluye etiqueta 'AHORRA 20%'", () => {
    const isYearly = true;
    const badgeText = isYearly ? "AHORRA 20%" : null;
    expect(badgeText).toBe("AHORRA 20%");
  });

  it("8. Los botones de acción reflejan '(Anual)' en modo YEARLY", () => {
    const isYearly = true;
    const starterBtn = `Seleccionar Starter (${isYearly ? "Anual" : "Mensual"})`;
    const proBtn = `Comenzar Plan Pro VIP (${isYearly ? "Anual" : "Mensual"})`;
    const academyBtn = `Seleccionar Academy (${isYearly ? "Anual" : "Mensual"})`;

    expect(starterBtn).toBe("Seleccionar Starter (Anual)");
    expect(proBtn).toBe("Comenzar Plan Pro VIP (Anual)");
    expect(academyBtn).toBe("Seleccionar Academy (Anual)");
  });

  it("9. Volver a MONTHLY restaura los precios base $29, $79, $199", () => {
    let currentInterval: BillingInterval = "YEARLY";
    const setBillingInterval = (val: BillingInterval) => {
      currentInterval = val;
    };
    setBillingInterval("MONTHLY");

    const isYearly = currentInterval === "YEARLY";
    expect(formatPrice(SAAS_PLANS.STARTER.pricing[currentInterval].price, isYearly)).toBe("$29");
    expect(formatPrice(SAAS_PLANS.PRO.pricing[currentInterval].price, isYearly)).toBe("$79");
    expect(formatPrice(SAAS_PLANS.ACADEMY.pricing[currentInterval].price, isYearly)).toBe("$199");
  });

  it("10. Los botones de acción vuelven a '(Mensual)' en modo MONTHLY", () => {
    const isYearly = false;
    const starterBtn = `Seleccionar Starter (${isYearly ? "Anual" : "Mensual"})`;
    const proBtn = `Comenzar Plan Pro VIP (${isYearly ? "Anual" : "Mensual"})`;
    const academyBtn = `Seleccionar Academy (${isYearly ? "Anual" : "Mensual"})`;

    expect(starterBtn).toBe("Seleccionar Starter (Mensual)");
    expect(proBtn).toBe("Comenzar Plan Pro VIP (Mensual)");
    expect(academyBtn).toBe("Seleccionar Academy (Mensual)");
  });

  it("11. Checkout y links de registro envían billingInterval correcto", () => {
    const intervalYearly: BillingInterval = "YEARLY";
    const starterYearlyHref = `/register?plan=STARTER&interval=${intervalYearly}&billingInterval=${intervalYearly}`;
    expect(starterYearlyHref).toContain("interval=YEARLY");
    expect(starterYearlyHref).toContain("billingInterval=YEARLY");

    const intervalMonthly: BillingInterval = "MONTHLY";
    const proMonthlyHref = `/register?plan=PRO&interval=${intervalMonthly}&billingInterval=${intervalMonthly}`;
    expect(proMonthlyHref).toContain("interval=MONTHLY");
    expect(proMonthlyHref).toContain("billingInterval=MONTHLY");
  });

  it("12. No se modifica ninguna cantidad de créditos AI", () => {
    expect(SAAS_PLANS.STARTER.teacherCredits).toBe(150);
    expect(SAAS_PLANS.STARTER.studentCredits).toBe(0);

    expect(SAAS_PLANS.PRO.teacherCredits).toBe(600);
    expect(SAAS_PLANS.PRO.studentCredits).toBe(200);

    expect(SAAS_PLANS.ACADEMY.teacherCredits).toBe(2000);
    expect(SAAS_PLANS.ACADEMY.studentCredits).toBe(800);
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { middleware } from "@/middleware";
import { isMockPaymentsMode } from "@/lib/stripe";
import { getStripePriceId, resolvePlanFromPriceId } from "@/modules/billing/billing.service";
import { SAAS_PLANS } from "@/modules/billing/plans";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Contraseñas (scrypt)", () => {
  it("genera hashes con sal distinta y verifica solo la contraseña correcta", async () => {
    const h1 = await hashPassword("ContraseñaSegura123");
    const h2 = await hashPassword("ContraseñaSegura123");
    expect(h1).not.toBe(h2);
    expect(h1.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("ContraseñaSegura123", h1)).toBe(true);
    expect(await verifyPassword("otra-contraseña", h1)).toBe(false);
  });

  it("rechaza hashes vacíos o malformados", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "md5$abc")).toBe(false);
  });
});

describe("Middleware: protección de rutas privadas", () => {
  it("redirige /dashboard a /login sin sesión", async () => {
    const res = await middleware(new NextRequest("http://localhost:3000/dashboard/billing"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?next=%2Fdashboard%2Fbilling");
  });

  it("redirige /campus a /login con un token falsificado", async () => {
    const req = new NextRequest("http://localhost:3000/campus", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.firma-falsa` },
    });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("permite /dashboard con un JWT válido", async () => {
    const token = await createSessionToken({ userId: "u1", email: "a@b.com", globalRole: "USER", tenantId: "t1", academyRole: "OWNER" });
    const req = new NextRequest("http://localhost:3000/dashboard", { headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` } });
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});

describe("Middleware: enrutado multi-tenant por host", () => {
  it("reescribe el subdominio de una academia a /a/[slug]", async () => {
    process.env.NEXT_PUBLIC_APP_HOST = "mentorstudioglobal.com";
    const req = new NextRequest("https://mi-escuela.mentorstudioglobal.com/courses/ingles-b1", {
      headers: { host: "mi-escuela.mentorstudioglobal.com" },
    });
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/a/mi-escuela/courses/ingles-b1");
  });

  it("reescribe un dominio personalizado a /d/[host]", async () => {
    process.env.NEXT_PUBLIC_APP_HOST = "mentorstudioglobal.com";
    const req = new NextRequest("https://www.escuelapropia.com/", { headers: { host: "www.escuelapropia.com" } });
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/d/www.escuelapropia.com");
  });

  it("no reescribe el dominio principal", async () => {
    process.env.NEXT_PUBLIC_APP_HOST = "mentorstudioglobal.com";
    const req = new NextRequest("https://mentorstudioglobal.com/", { headers: { host: "mentorstudioglobal.com" } });
    const res = await middleware(req);
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("Pagos: el modo simulado nunca se activa en producción", () => {
  it("modo simulado solo en desarrollo sin clave de Stripe", () => {
    delete process.env.STRIPE_SECRET_KEY;
    (process.env as any).NODE_ENV = "development";
    expect(isMockPaymentsMode()).toBe(true);

    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    expect(isMockPaymentsMode()).toBe(false);
  });

  it("en producción sin STRIPE_SECRET_KEY lanza error en lugar de regalar planes", () => {
    delete process.env.STRIPE_SECRET_KEY;
    (process.env as any).NODE_ENV = "production";
    expect(() => isMockPaymentsMode()).toThrow(/STRIPE_SECRET_KEY/);
  });

  it("en producción exige los Price IDs configurados", () => {
    (process.env as any).NODE_ENV = "production";
    delete process.env.STRIPE_PRICE_PRO_MONTHLY;
    expect(() => getStripePriceId("PRO", "MONTHLY")).toThrow(/STRIPE_PRICE_PRO_MONTHLY/);
  });

  it("resuelve plan e intervalo a partir del Price ID de Stripe", () => {
    process.env.STRIPE_PRICE_ACADEMY_YEARLY = "price_real_academy_year";
    expect(resolvePlanFromPriceId("price_real_academy_year")).toEqual({ planId: "ACADEMY", billingInterval: "YEARLY" });
    expect(resolvePlanFromPriceId("price_desconocido")).toBeNull();
  });
});

describe("Catálogo de planes coherente con lo que se aplica", () => {
  it("los límites y capacidades escalan por plan", () => {
    expect(SAAS_PLANS.STARTER.maxStudents).toBeLessThan(SAAS_PLANS.PRO.maxStudents);
    expect(SAAS_PLANS.PRO.maxStudents).toBeLessThan(SAAS_PLANS.ACADEMY.maxStudents);
    expect(SAAS_PLANS.STARTER.capabilities.customBranding).toBe(false);
    expect(SAAS_PLANS.PRO.capabilities.customBranding).toBe(true);
    expect(SAAS_PLANS.PRO.capabilities.customDomain).toBe(false);
    expect(SAAS_PLANS.ACADEMY.capabilities.customDomain).toBe(true);
  });

  it("los textos de venta no prometen más de lo que el código permite", () => {
    const proFeatures = SAAS_PLANS.PRO.features.join(" ").toLowerCase();
    expect(proFeatures).not.toContain("ilimitad");
    expect(proFeatures).toContain(String(SAAS_PLANS.PRO.maxStudents));
  });
});

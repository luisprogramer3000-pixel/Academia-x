import { describe, it, expect, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { middleware } from "@/middleware";
import { isMockPaymentsMode, encryptCardHolder } from "@/lib/payphone";
import { seal, open } from "@/lib/secret-box";
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
  it("modo simulado solo en desarrollo sin credenciales de Payphone", () => {
    delete process.env.PAYPHONE_TOKEN;
    delete process.env.PAYPHONE_STORE_ID;
    (process.env as any).NODE_ENV = "development";
    expect(isMockPaymentsMode()).toBe(true);

    process.env.PAYPHONE_TOKEN = "token_test";
    process.env.PAYPHONE_STORE_ID = "store_test";
    expect(isMockPaymentsMode()).toBe(false);
  });

  it("en producción sin credenciales de Payphone lanza error en lugar de regalar planes", () => {
    delete process.env.PAYPHONE_TOKEN;
    delete process.env.PAYPHONE_STORE_ID;
    (process.env as any).NODE_ENV = "production";
    expect(() => isMockPaymentsMode()).toThrow(/PAYPHONE_TOKEN/);
  });

  it("el token de la tarjeta se guarda cifrado y no se puede alterar", () => {
    process.env.JWT_SECRET = "x".repeat(40);
    const sealed = seal("ctoken_secreto");
    expect(sealed).not.toContain("ctoken_secreto");
    expect(open(sealed)).toBe("ctoken_secreto");
    const parts = sealed.split(":");
    parts[3] = Buffer.from("otro").toString("base64");
    expect(() => open(parts.join(":"))).toThrow();
  });

  it("el titular se cifra como pide Payphone (AES-256-CBC, IV en ceros, Base64)", () => {
    process.env.PAYPHONE_CODING_PASSWORD = "0123456789abcdef0123456789abcdef";
    const a = encryptCardHolder("Juan Pérez");
    expect(a).toMatch(/^[A-Za-z0-9+/]+=*$/);
    // Sin IV aleatorio: el mismo nombre da siempre el mismo resultado
    expect(encryptCardHolder("Juan Pérez")).toBe(a);
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

import { vi } from "vitest";

/**
 * En los tests no existe un contexto de petición de Next.js.
 * Simulamos `next/headers` con un almacén de cookies en memoria para que
 * el código real de sesión (JWT firmado + validación de membresía en DB) se ejecute tal cual.
 */
const cookieJar = new Map<string, string>();

(globalThis as any).__testCookieJar = cookieJar;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
    has: (name: string) => cookieJar.has(name),
    getAll: () => Array.from(cookieJar.entries()).map(([name, value]) => ({ name, value })),
  }),
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

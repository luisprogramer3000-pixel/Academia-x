import { vi } from "vitest";
import { readFileSync } from "fs";
import { resolve as resolvePath } from "path";

/**
 * ============================================================================
 * GUARDIA DE BASE DE DATOS — NO ELIMINAR
 * ============================================================================
 * Varios tests limpian su estado con `deleteMany({})` SIN filtro, es decir,
 * vacían tablas completas: Tenant, User, Subscription, AICreditWallet...
 * Ejecutar la suite contra la base de producción borra todas las academias,
 * todos los usuarios y todas las suscripciones. Ya ocurrió una vez.
 *
 * Por eso los tests solo arrancan si DATABASE_URL apunta claramente a una base
 * de pruebas (local, o con "test" en el nombre), o si se acepta el riesgo de
 * forma explícita con ALLOW_DESTRUCTIVE_TESTS=true.
 */
/**
 * Vitest no carga los archivos .env: quien lo hace es Prisma Client al arrancar.
 * El guardia se ejecuta antes, así que lee el mismo .env para comprobar contra
 * qué base de datos se va a conectar realmente la suite.
 */
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  for (const file of [".env.local", ".env"]) {
    try {
      const content = readFileSync(resolvePath(process.cwd(), file), "utf8");
      const match = content.match(/^\s*DATABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?\s*$/m);
      if (match) return match[1];
    } catch {
      // El archivo no existe: se prueba con el siguiente
    }
  }

  return "";
}

function assertSafeTestDatabase() {
  const url = resolveDatabaseUrl();

  if (!url) {
    throw new Error("[tests] DATABASE_URL no está definida. Configurá una base de datos de pruebas.");
  }

  if (process.env.ALLOW_DESTRUCTIVE_TESTS === "true") {
    console.warn(
      "\n⚠️  [tests] ALLOW_DESTRUCTIVE_TESTS=true: la suite VACIARÁ tablas completas de esta base de datos.\n"
    );
    return;
  }

  let host = "";
  let database = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase();
    database = parsed.pathname.replace(/^\//, "").toLowerCase();
  } catch {
    throw new Error("[tests] DATABASE_URL no es una URL válida.");
  }

  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "host.docker.internal";
  const looksLikeTestDb = /test/.test(database) || /test/.test(host);

  if (!isLocal && !looksLikeTestDb) {
    throw new Error(
      [
        "",
        "╔════════════════════════════════════════════════════════════════════════╗",
        "║  TESTS BLOQUEADOS: DATABASE_URL no parece una base de datos de pruebas ║",
        "╚════════════════════════════════════════════════════════════════════════╝",
        "",
        `  Servidor: ${host}`,
        `  Base:     ${database}`,
        "",
        "  La suite vacía tablas enteras (Tenant, User, Subscription...) como parte",
        "  de su limpieza. Contra una base real, BORRA TODOS LOS DATOS.",
        "",
        "  Opciones:",
        "    1. Apuntar DATABASE_URL a una Postgres local o a una base con 'test'",
        "       en el nombre (recomendado).",
        "    2. Si de verdad querés vaciar esta base, ejecutar con:",
        "       ALLOW_DESTRUCTIVE_TESTS=true npm test",
        "",
      ].join("\n")
    );
  }
}

assertSafeTestDatabase();

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

import { PrismaClient } from "@prisma/client";

/**
 * Papelera (soft delete) de cursos y recursos: lo borrado tiene deletedAt y se
 * oculta AUTOMÁTICAMENTE en todas las lecturas de estos modelos, para que
 * ninguna pantalla lo muestre por olvidar el filtro.
 *
 * Para ver también lo borrado (la papelera, la comprobación de slugs libres),
 * la consulta debe nombrar deletedAt en su where: { deletedAt: { not: null } }
 * o { deletedAt: undefined } (= cualquiera).
 *
 * Límite: los include/select de relaciones (p. ej. enrollment.course) no pasan
 * por aquí; esas consultas filtran { course: { deletedAt: null } } a mano.
 */
const SOFT_DELETE_MODELS = new Set(["Course", "TeachingResource"]);
const READ_OPERATIONS = new Set([
  "findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy",
]);

/**
 * Supabase a veces tarda más de 5 s en abrir una conexión (el límite por defecto
 * de Prisma) y la operación falla con "Can't reach database server". Si la URL
 * no los trae, se añaden connect_timeout=15 y pool_timeout=20.
 */
function databaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "15");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    return raw;
  }
}

function createClient() {
  const url = databaseUrl();
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined).$extends({
    name: "soft-delete",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (SOFT_DELETE_MODELS.has(model) && READ_OPERATIONS.has(operation)) {
            const a = args as { where?: Record<string, unknown> };
            if (!a.where || !("deletedAt" in a.where)) a.where = { ...a.where, deletedAt: null };
          }
          return query(args);
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ExtendedClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const TENANT_SCOPED_MODELS = [
  "Course",
  "Certificate",
  "AIUsage",
  "Subscription",
  "Invitation",
];

/**
 * Retorna una instancia de Prisma configurada para filtrar automáticamente
 * todas las operaciones por tenantId (Strict Tenant Isolation).
 */
export function getTenantDb(tenantId: string) {
  if (!tenantId) {
    throw new Error("SECURITY ERROR: tenantId is required for Data Access Layer operations.");
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            if (["findMany", "findFirst", "findUnique", "count", "update", "delete", "updateMany", "deleteMany"].includes(operation)) {
              (args as { where?: Record<string, unknown> }).where = {
                ...(args as { where?: Record<string, unknown> }).where,
                tenantId,
              };
            }
          }
          return query(args);
        },
      },
    },
  });
}

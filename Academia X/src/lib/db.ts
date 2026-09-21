import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

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

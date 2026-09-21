import { prisma } from "@/lib/db";

export interface LogAuditInput {
  tenantId?: string;
  userId?: string;
  action: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export class AuditService {
  /**
   * Registra un evento crítico de seguridad o acción administrativa en la tabla AuditLog.
   */
  static async logAuditEvent(input: LogAuditInput) {
    return prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        details: input.details ? JSON.stringify(input.details) : null,
        ipAddress: input.ipAddress || "127.0.0.1",
      },
    });
  }

  /**
   * Consulta el historial de eventos de auditoría de una academia.
   */
  static async getAuditLogs(tenantId: string) {
    try {
      return await prisma.auditLog.findMany({
        where: { tenantId },
        include: {
          user: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    } catch (error) {
      console.warn("Database query failed in getAuditLogs:", error);
      return [];
    }
  }
}

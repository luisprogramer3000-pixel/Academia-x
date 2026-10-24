import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Generaciones con IA en segundo plano.
 *
 * El proxy del Web App de Hostinger corta cualquier petición que pase de ~30 s y
 * devuelve su propia página de error ("An unexpected response was received from
 * the server"). Un plan de clase con imágenes tarda bastante más, así que la
 * acción crea el trabajo, responde al instante y la IA sigue en el servidor con
 * after(); el navegador consulta el estado hasta que termina.
 */

export type AIJobKind = "CLASS_PLAN" | "LESSON_FROM_PLAN" | "PRESENTATION";

export type AIJobState<T> =
  | { status: "RUNNING" }
  | { status: "DONE"; result: T }
  | { status: "FAILED"; error: string };

/** Un trabajo que sigue "RUNNING" pasado este tiempo murió con el proceso (reinicio o despliegue). */
const STALE_AFTER_MS = 20 * 60 * 1000;
/** Los trabajos terminados solo sirven para entregar el resultado: se borran a la semana. */
const KEEP_FOR_MS = 7 * 24 * 60 * 60 * 1000;

export async function startAIJob<T>(
  owner: { tenantId: string; userId: string },
  kind: AIJobKind,
  work: () => Promise<T>,
  formatError: (error: unknown) => string
): Promise<string> {
  const job = await prisma.aIJob.create({ data: { tenantId: owner.tenantId, userId: owner.userId, kind } });

  after(async () => {
    try {
      const result = await work();
      await prisma.aIJob.update({
        where: { id: job.id },
        data: { status: "DONE", result: result as unknown as Prisma.InputJsonValue },
      });
    } catch (error) {
      console.error(`[ai-job:${kind}]`, error);
      await prisma.aIJob
        .update({ where: { id: job.id }, data: { status: "FAILED", error: formatError(error).slice(0, 1000) } })
        .catch((err) => console.error("[ai-job] No se pudo marcar como fallido", err));
    }
    await prisma.aIJob
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - KEEP_FOR_MS) } } })
      .catch(() => {});
  });

  return job.id;
}

export async function getAIJobState<T>(
  owner: { tenantId: string; userId: string },
  jobId: string
): Promise<AIJobState<T> | null> {
  const job = await prisma.aIJob.findFirst({
    where: { id: jobId, tenantId: owner.tenantId, userId: owner.userId },
  });
  if (!job) return null;
  if (job.status === "DONE") return { status: "DONE", result: job.result as T };
  if (job.status === "FAILED") return { status: "FAILED", error: job.error || "Error al procesar la operación con IA" };
  if (Date.now() - job.updatedAt.getTime() > STALE_AFTER_MS) {
    return { status: "FAILED", error: "La generación se interrumpió en el servidor. Revisa \"Mis recursos\" y, si no aparece, inténtalo de nuevo." };
  }
  return { status: "RUNNING" };
}

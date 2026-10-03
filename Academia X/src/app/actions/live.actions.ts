"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { LiveError, LiveService } from "@/modules/live/live.service";
import { collectMultipleChoice, readResourceData } from "@/modules/resources/plan-to-lesson";

function fail(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? fallback };
  if (error instanceof LiveError) return { success: false as const, error: error.message };
  console.error("[live]", error);
  return { success: false as const, error: fallback };
}

export async function createLiveSessionAction(resourceId: string, timeLimitSec: number) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    const r = await prisma.teachingResource.findFirst({ where: { id: resourceId, tenantId } });
    if (!r) throw new LiveError("Recurso no encontrado.");
    const { plan } = readResourceData(r.kind, r.data, r.title);

    const session = await LiveService.createSession({
      tenantId,
      hostUserId: userId,
      title: r.title,
      resourceId: r.id,
      questions: collectMultipleChoice(plan),
      timeLimitSec: z.number().int().min(5).max(120).parse(timeLimitSec),
    });
    return { success: true as const, id: session.id };
  } catch (error) {
    return fail(error, "No se pudo crear el quiz en vivo.");
  }
}

export async function liveControlAction(sessionId: string, action: "next" | "reveal" | "end") {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await LiveService.control(sessionId, tenantId, z.enum(["next", "reveal", "end"]).parse(action));
    return { success: true as const };
  } catch (error) {
    return fail(error, "No se pudo actualizar la partida.");
  }
}

/** Público: el alumno no necesita cuenta. */
export async function joinLiveAction(code: string, nickname: string) {
  try {
    const input = z.object({ code: z.string().max(12), nickname: z.string().max(40) }).parse({ code, nickname });
    const joined = await LiveService.join(input.code, input.nickname);
    return { success: true as const, ...joined };
  } catch (error) {
    return fail(error, "No se pudo entrar en la partida.");
  }
}

/** Público: se valida con el token del participante. */
export async function answerLiveAction(code: string, participantId: string, token: string, questionIndex: number, selected: number) {
  try {
    const input = z
      .object({
        code: z.string().max(12),
        participantId: z.string().min(1).max(40),
        token: z.string().min(10).max(100),
        questionIndex: z.number().int().min(0).max(100),
        selected: z.number().int().min(0).max(10),
      })
      .parse({ code, participantId, token, questionIndex, selected });
    await LiveService.answer(input.code, input.participantId, input.token, input.questionIndex, input.selected);
    return { success: true as const };
  } catch (error) {
    return fail(error, "No se pudo enviar la respuesta.");
  }
}

"use server";

import { z } from "zod";
import { AIService } from "@/modules/ai/ai.service";
import { AICreditEngine, AICreditError } from "@/modules/ai/ai.credit-engine";
import { AI_OPERATION_CATALOG } from "@/modules/ai/ai.catalog";
import { revalidatePath } from "next/cache";
import { requireActiveSubscription, PlanLimitError } from "@/modules/billing/entitlements";
import { requireTenantAccess, STAFF_ROLES, AuthError, assertLessonInTenant, assertCourseInTenant } from "@/lib/session";

const generateCourseAISchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().min(1),
  topic: z.string().min(3, "El tema debe tener al menos 3 caracteres"),
  level: z.string().default("B1"),
  language: z.string().default("es"),
  audience: z.string().optional(),
  modulesCount: z.coerce.number().min(1).max(10).default(3),
  countryStandard: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const generateLessonContentAISchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().min(1),
  lessonId: z.string().min(1, "ID de lección requerido"),
  topic: z.string().min(2, "Tema de lección requerido"),
  level: z.string().default("B1"),
  language: z.string().default("es"),
  lessonTitle: z.string().min(2, "Título de lección requerido"),
  idempotencyKey: z.string().optional(),
});

function formatAIError(error: any): string {
  if (error instanceof z.ZodError) {
    return error.errors[0].message;
  }
  if (error instanceof AuthError || error instanceof PlanLimitError) {
    return error.message;
  }
  const message = error?.message || "";
  if (message === AICreditError.INSUFFICIENT_AI_CREDITS) {
    return "Créditos de IA insuficientes para realizar esta operación. Por favor, actualice su plan.";
  }
  if (message === AICreditError.USER_NOT_IN_TENANT) {
    return "El usuario no pertenece a esta academia.";
  }
  if (message === AICreditError.TENANT_NOT_FOUND) {
    return "Academia no encontrada.";
  }
  if (message === AICreditError.AI_CREDIT_WALLET_NOT_FOUND) {
    return "Billetera de créditos de IA no encontrada.";
  }
  return message || "Error al procesar la operación con IA";
}

export async function generateCourseAIAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(auth.tenantId);
    const rawIdempotencyKey = (formData.get("idempotencyKey") as string) || (formData.get("clientRequestId") as string);
    const rawData = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      topic: (formData.get("topic") as string) || undefined,
      level: (formData.get("level") as string) || "B1",
      language: (formData.get("language") as string) || "es",
      audience: (formData.get("audience") as string) || undefined,
      modulesCount: formData.get("modulesCount") ? Number(formData.get("modulesCount")) : undefined,
      countryStandard: (formData.get("countryStandard") as string) || undefined,
      idempotencyKey: rawIdempotencyKey || crypto.randomUUID(),
    };

    const validated = generateCourseAISchema.parse(rawData);
    const course = await AIService.generateCourseDraft(validated);

    revalidatePath("/dashboard/courses");
    return {
      success: true,
      courseId: course.id,
      redirectUrl: `/dashboard/courses/${course.id}/builder`,
    };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

export async function generateLessonContentAIAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(auth.tenantId);
    const rawIdempotencyKey = (formData.get("idempotencyKey") as string) || (formData.get("clientRequestId") as string);
    const rawData = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      lessonId: (formData.get("lessonId") as string) || undefined,
      topic: (formData.get("topic") as string) || undefined,
      level: (formData.get("level") as string) || "B1",
      language: (formData.get("language") as string) || "es",
      lessonTitle: (formData.get("lessonTitle") as string) || undefined,
      idempotencyKey: rawIdempotencyKey || crypto.randomUUID(),
    };

    const validated = generateLessonContentAISchema.parse(rawData);
    await assertLessonInTenant(validated.lessonId, auth.tenantId);
    const lesson = await AIService.generateLessonContentAI(validated);

    revalidatePath(`/dashboard/courses`);
    return { success: true, lesson };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

const generateActivityAISchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().min(1),
  topic: z.string().min(2, "Tema de actividad requerido"),
  level: z.string().default("B1"),
  language: z.string().default("es"),
  lessonId: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function generateActivityAIAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(auth.tenantId);
    const rawIdempotencyKey = (formData.get("idempotencyKey") as string) || (formData.get("clientRequestId") as string);
    const rawData = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      topic: (formData.get("topic") as string) || undefined,
      level: (formData.get("level") as string) || "B1",
      language: (formData.get("language") as string) || "es",
      lessonId: (formData.get("lessonId") as string) || undefined,
      idempotencyKey: rawIdempotencyKey || crypto.randomUUID(),
    };

    const validated = generateActivityAISchema.parse(rawData);
    if (validated.lessonId) await assertLessonInTenant(validated.lessonId, auth.tenantId);
    const activity = await AIService.generateActivityAI(validated);

    revalidatePath(`/dashboard/courses`);
    return { success: true, activity };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

const generateQuizAISchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().min(1),
  topic: z.string().min(2, "Tema de quiz requerido"),
  level: z.string().default("B1"),
  language: z.string().default("es"),
  questionCount: z.coerce.number().min(1).max(20).optional(),
  idempotencyKey: z.string().optional(),
});

export async function generateQuizAIAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(auth.tenantId);
    const rawIdempotencyKey = (formData.get("idempotencyKey") as string) || (formData.get("clientRequestId") as string);
    const rawData = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      topic: (formData.get("topic") as string) || undefined,
      level: (formData.get("level") as string) || "B1",
      language: (formData.get("language") as string) || "es",
      questionCount: formData.get("questionCount") ? Number(formData.get("questionCount")) : undefined,
      idempotencyKey: rawIdempotencyKey || crypto.randomUUID(),
    };

    const validated = generateQuizAISchema.parse(rawData);
    const quiz = await AIService.generateQuizAI(validated);

    revalidatePath(`/dashboard/courses`);
    return { success: true, quiz };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

const generateLandingPageAISchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().min(1),
  courseTitle: z.string().min(2, "Título de curso requerido"),
  targetAudience: z.string().optional(),
  language: z.string().default("es"),
  idempotencyKey: z.string().optional(),
});

export async function generateLandingPageAIAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(auth.tenantId);
    const rawIdempotencyKey = (formData.get("idempotencyKey") as string) || (formData.get("clientRequestId") as string);
    const rawData = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      courseTitle: (formData.get("courseTitle") as string) || undefined,
      targetAudience: (formData.get("targetAudience") as string) || undefined,
      language: (formData.get("language") as string) || "es",
      idempotencyKey: rawIdempotencyKey || crypto.randomUUID(),
    };

    const validated = generateLandingPageAISchema.parse(rawData);
    const landing = await AIService.generateLandingPageAI(validated);

    revalidatePath(`/dashboard/courses`);
    return { success: true, landing };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

const regenerateLessonContentAISchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().min(1),
  lessonId: z.string().min(1, "ID de lección requerido"),
  topic: z.string().min(2, "Tema requerido"),
  level: z.string().default("B1"),
  language: z.string().default("es"),
  lessonTitle: z.string().min(2, "Título de lección requerido"),
  feedback: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function regenerateLessonContentAIAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(auth.tenantId);
    const rawIdempotencyKey = (formData.get("idempotencyKey") as string) || (formData.get("clientRequestId") as string);
    const rawData = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      lessonId: (formData.get("lessonId") as string) || undefined,
      topic: (formData.get("topic") as string) || undefined,
      level: (formData.get("level") as string) || "B1",
      language: (formData.get("language") as string) || "es",
      lessonTitle: (formData.get("lessonTitle") as string) || undefined,
      feedback: (formData.get("feedback") as string) || undefined,
      idempotencyKey: rawIdempotencyKey || crypto.randomUUID(),
    };

    const validated = regenerateLessonContentAISchema.parse(rawData);
    await assertLessonInTenant(validated.lessonId, auth.tenantId);
    const result = await AIService.regenerateLessonContentAI(validated);

    revalidatePath(`/dashboard/courses`);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

const regenerateCourseStructureAISchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().min(1),
  courseId: z.string().optional(),
  topic: z.string().min(2, "Tema requerido"),
  level: z.string().default("B1"),
  language: z.string().default("es"),
  audience: z.string().optional(),
  feedback: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export async function regenerateCourseStructureAIAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(auth.tenantId);
    const rawIdempotencyKey = (formData.get("idempotencyKey") as string) || (formData.get("clientRequestId") as string);
    const rawData = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      courseId: (formData.get("courseId") as string) || undefined,
      topic: (formData.get("topic") as string) || undefined,
      level: (formData.get("level") as string) || "B1",
      language: (formData.get("language") as string) || "es",
      audience: (formData.get("audience") as string) || undefined,
      feedback: (formData.get("feedback") as string) || undefined,
      idempotencyKey: rawIdempotencyKey || crypto.randomUUID(),
    };

    const validated = regenerateCourseStructureAISchema.parse(rawData);
    if (validated.courseId) await assertCourseInTenant(validated.courseId, auth.tenantId);
    const result = await AIService.regenerateCourseStructureAI(validated);

    revalidatePath(`/dashboard/courses`);
    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

const askAITutorAISchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().min(1),
  question: z.string().min(2, "Pregunta requerida"),
  context: z.string().optional(),
  language: z.string().default("es"),
  idempotencyKey: z.string().optional(),
});

export async function askAITutorAIAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess();
    await requireActiveSubscription(auth.tenantId);
    const rawIdempotencyKey = (formData.get("idempotencyKey") as string) || (formData.get("clientRequestId") as string);
    const rawData = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      question: (formData.get("question") as string) || undefined,
      context: (formData.get("context") as string) || undefined,
      language: (formData.get("language") as string) || "es",
      idempotencyKey: rawIdempotencyKey || crypto.randomUUID(),
    };

    const validated = askAITutorAISchema.parse(rawData);
    const result = await AIService.askAITutorAI(validated);

    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

const getAIFeedbackAISchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().min(1),
  studentSubmission: z.string().min(2, "Respuesta/Entrega requerida"),
  exerciseContext: z.string().min(2, "Contexto de ejercicio requerido"),
  language: z.string().default("es"),
  idempotencyKey: z.string().optional(),
});

export async function getAIFeedbackAIAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess();
    await requireActiveSubscription(auth.tenantId);
    const rawIdempotencyKey = (formData.get("idempotencyKey") as string) || (formData.get("clientRequestId") as string);
    const rawData = {
      tenantId: auth.tenantId,
      userId: auth.userId,
      studentSubmission: (formData.get("studentSubmission") as string) || undefined,
      exerciseContext: (formData.get("exerciseContext") as string) || undefined,
      language: (formData.get("language") as string) || "es",
      idempotencyKey: rawIdempotencyKey || crypto.randomUUID(),
    };

    const validated = getAIFeedbackAISchema.parse(rawData);
    const result = await AIService.getAIFeedbackAI(validated);

    return { success: true, result };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

export async function getAIUsageStatsAction(_clientTenantId?: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const stats = await AIService.getAIUsageStats(tenantId);
    return { success: true, stats };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

export async function getAICreditSummaryAction(_clientTenantId?: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const summary = await AICreditEngine.getTenantWalletSummary(tenantId);
    return { success: true, summary };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

export async function getAICreditHistoryAction(_clientTenantId?: string, limit = 20) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const history = await AICreditEngine.getTenantCreditHistory(tenantId, limit);
    return { success: true, history };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

export async function getAIOperationCatalogAction() {
  try {
    return { success: true, catalog: AI_OPERATION_CATALOG };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

const triggerMonthlyResetSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID requerido"),
  userId: z.string().optional(),
});

export async function triggerMonthlyResetAction(formData: FormData) {
  try {
    const auth = await requireTenantAccess();
    if (!auth.isSuperAdmin) throw new AuthError("FORBIDDEN");

    // Solo SUPER_ADMIN: puede indicar el tenant objetivo explícitamente
    const rawData = {
      tenantId: (formData.get("tenantId") as string) || auth.tenantId,
      userId: (formData.get("userId") as string) || undefined,
    };

    const validated = triggerMonthlyResetSchema.parse(rawData);
    const result = await AICreditEngine.processMonthlyReset(validated.tenantId, undefined, undefined, validated.userId);

    try {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/billing");
    } catch (e) {
      // Ignore revalidation errors in non-Next.js environments
    }

    return {
      success: true,
      alreadyProcessed: result.alreadyProcessed,
      result,
    };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}

export async function triggerMonthlyResetBatchAction(limit: number = 50) {
  try {
    const auth = await requireTenantAccess();
    if (!auth.isSuperAdmin) throw new AuthError("FORBIDDEN");
    const { AICreditJobService } = await import("@/modules/ai/ai.job-service");
    const summary = await AICreditJobService.processMonthlyResetBatch({ limit });
    try {
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/billing");
    } catch (e) {
      // Ignore revalidation errors in non-Next.js environments
    }
    return { success: true, summary };
  } catch (error: any) {
    return { success: false, error: formatAIError(error) };
  }
}





"use server";

import { z } from "zod";
import { CourseService } from "@/modules/course/course.service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireTenantAccess,
  STAFF_ROLES,
  assertCourseInTenant,
  assertModuleInTenant,
  assertLessonInTenant,
} from "@/lib/session";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { safeExternalUrl } from "@/lib/utils";
import { requireActiveSubscription } from "@/modules/billing/entitlements";

/**
 * Enlace externo (pago, clase en vivo, recurso): solo http(s) o rutas internas.
 * Bloquea vectores tipo `javascript:` que terminarían en un href del alumno.
 */
const externalUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => safeExternalUrl(value) !== null, "El enlace debe empezar por http:// o https://")
  .transform((value) => safeExternalUrl(value) as string);

const createCourseSchema = z.object({
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres").max(150),
  slug: z.string().nullable().optional(),
  description: z.string().max(10000, "La descripción no puede superar los 10 000 caracteres.").nullable().optional(),
  level: z.string().max(20).default("A1"),
  language: z.string().max(10).default("es"),
  priceAmount: z.coerce.number().min(0).default(0),
  paymentType: z.enum(["EXTERNAL", "STRIPE_CONNECT"]).default("EXTERNAL"),
  paymentLink: externalUrlSchema.optional(),
});

const createModuleSchema = z.object({
  courseId: z.string().min(1, "Course ID requerido"),
  title: z.string().trim().min(2, "El título del módulo es requerido").max(150),
  description: z.string().max(2000).optional(),
});

const createLessonSchema = z.object({
  moduleId: z.string().min(1, "Module ID requerido"),
  title: z.string().trim().min(2, "El título de la lección es requerido").max(150),
});

const MAX_LESSON_CONTENT_BYTES = 500_000;

export interface CreateCourseState {
  error?: string;
  /** Lo que escribió el profesor, para no perderlo si hay un error */
  values?: Record<string, string>;
}

const COURSE_FIELD_LABELS: Record<string, string> = {
  title: "Título", description: "Descripción", priceAmount: "Precio", paymentLink: "Link de pago", level: "Nivel",
};

/**
 * Crea un curso desde el formulario (useActionState). Los errores de validación
 * vuelven al formulario como mensaje; nunca tumban la página.
 */
export async function createCourseAction(_prev: CreateCourseState, formData: FormData): Promise<CreateCourseState> {
  const values = Object.fromEntries(["title", "description", "level", "priceAmount", "paymentType", "paymentLink", "audience", "generateStructure"].map((k) => [k, String(formData.get(k) ?? "")]));
  let courseId: string;
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(tenantId);

    const parsed = createCourseSchema.safeParse({
      title: formData.get("title") as string,
      slug: (formData.get("slug") as string) || undefined,
      description: (formData.get("description") as string) || undefined,
      // Si el profesor no eligió el nivel a mano, manda el que diga el título ("Español B2 - …")
      level: (formData.get("levelTouched") !== "1" && String(formData.get("title") ?? "").toUpperCase().match(/(?:^|[^A-Z])([ABC][12])(?![0-9])/)?.[1])
        || (formData.get("level") as string) || "A1",
      language: (formData.get("language") as string) || "es",
      priceAmount: formData.get("priceAmount") as string,
      paymentType: (formData.get("paymentType") as string) || "EXTERNAL",
      paymentLink: (formData.get("paymentLink") as string) || undefined,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = COURSE_FIELD_LABELS[String(issue?.path[0])] ?? "Formulario";
      const message = issue?.code === "too_big" && issue.path[0] === "description" ? issue.message : `${field}: ${issue?.message}`;
      return { error: message, values };
    }
    const validated = parsed.data;

    const course = await CourseService.createCourse({
      tenantId,
      title: validated.title,
      slug: validated.slug || undefined,
      description: validated.description || undefined,
      level: validated.level,
      language: validated.language,
      priceAmount: validated.priceAmount,
      paymentType: validated.paymentType,
      paymentLink: validated.paymentLink ?? undefined,
    });
    courseId = course.id;
    revalidatePath("/dashboard/courses");
  } catch (error) {
    console.error("[createCourseAction] Error:", error instanceof Error ? error.message : error);
    return { error: error instanceof Error ? error.message : "No se pudo crear el curso.", values };
  }
  // Fuera del try: redirect() funciona lanzando una señal que no debe capturarse
  const generate = formData.get("generateStructure") === "1";
  const audience = String(formData.get("audience") ?? "").trim().slice(0, 200);
  redirect(`/dashboard/courses/${courseId}/builder${generate ? `?generar=1${audience ? `&publico=${encodeURIComponent(audience)}` : ""}` : ""}`);
}

const createStandaloneLessonSchema = z.object({
  title: z.string().trim().min(2, "El título debe tener al menos 2 caracteres").max(150),
  description: z.string().max(2000).optional(),
  level: z.string().max(20).optional(),
});

export async function createStandaloneLessonAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  await requireActiveSubscription(tenantId);

  const validated = createStandaloneLessonSchema.parse({
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    level: (formData.get("level") as string) || undefined,
  });

  // Crea el contenedor (course) tipo STANDALONE_LESSON + módulo + lección en una transacción
  const result = await prisma.$transaction(async (tx) => {
    const course = await tx.course.create({
      data: {
        tenantId,
        title: validated.title,
        slug: await generateUniqueSlug(tenantId, validated.title),
        description: validated.description || null,
        level: validated.level || "A1",
        language: "es",
        priceAmount: 0,
        currency: "USD",
        paymentType: "EXTERNAL",
        status: "DRAFT",
        contentType: "STANDALONE_LESSON",
      },
    });

    const module = await tx.module.create({
      data: {
        courseId: course.id,
        title: "Clase",
        order: 1,
      },
    });

    const lesson = await tx.lesson.create({
      data: {
        moduleId: module.id,
        title: validated.title,
        order: 1,
        content: JSON.stringify({ blocks: [] }),
      },
    });

    return { course, lesson };
  });

  revalidatePath("/dashboard/courses");
  redirect(`/dashboard/lessons/${result.lesson.id}/editar`);
}

async function generateUniqueSlug(tenantId: string, title: string): Promise<string> {
  const { slugify } = await import("@/modules/academy/academy.service");
  const base = slugify(title);
  let slug = base;
  let counter = 1;
  while (
    // deletedAt: undefined → también cuenta los cursos de la papelera (su slug sigue ocupado)
    await prisma.course.findUnique({ where: { tenantId_slug: { tenantId, slug }, deletedAt: undefined } })
  ) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

export async function createModuleAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);

  const validated = createModuleSchema.parse({
    courseId: formData.get("courseId") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
  });

  await assertCourseInTenant(validated.courseId, tenantId);
  await CourseService.createModule(validated);

  revalidatePath(`/dashboard/courses/${validated.courseId}/builder`);
}

export async function createLessonAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);

  const validated = createLessonSchema.parse({
    moduleId: formData.get("moduleId") as string,
    title: formData.get("title") as string,
  });

  const mod = await assertModuleInTenant(validated.moduleId, tenantId);
  await CourseService.createLesson(validated);

  revalidatePath(`/dashboard/courses/${mod.courseId}/builder`);
}

export async function updateLessonContentAction(lessonId: string, contentJsonString: string): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);

  if (typeof contentJsonString !== "string" || contentJsonString.length > MAX_LESSON_CONTENT_BYTES) {
    throw new Error("El contenido de la lección es demasiado grande.");
  }
  let blocks: unknown;
  try {
    blocks = JSON.parse(contentJsonString);
  } catch {
    throw new Error("El contenido de la lección no es un JSON válido.");
  }

  // Los bloques de video/recurso se renderizan como enlaces para el alumno: solo http(s) o rutas internas.
  const blockList = Array.isArray(blocks) ? blocks : (blocks as { blocks?: unknown })?.blocks;
  if (Array.isArray(blockList)) {
    for (const block of blockList) {
      const url = (block as { url?: unknown })?.url;
      if (url && safeExternalUrl(url) === null) {
        throw new Error("Los enlaces de los bloques deben empezar por http:// o https://");
      }
    }
  }

  const lesson = await assertLessonInTenant(lessonId, tenantId);
  await CourseService.updateLessonContent(lessonId, contentJsonString);
  revalidatePath(`/dashboard/courses/${lesson.module.courseId}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/lessons/${lessonId}`, "layout");
}

export async function updateLessonSettingsAction(lessonId: string, formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const rawLiveUrl = ((formData.get("liveUrl") as string) || "").trim();
  const liveUrl = rawLiveUrl ? externalUrlSchema.parse(rawLiveUrl) : null;
  const lesson = await assertLessonInTenant(lessonId, tenantId);
  await prisma.lesson.update({
    where: { id: lessonId },
    data: { liveUrl },
  });
  revalidatePath(`/dashboard/courses/${lesson.module.courseId}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/lessons/${lessonId}`, "layout");
}

const updateCourseSchema = z.object({
  title: z.string().trim().min(3, "El título debe tener al menos 3 caracteres").max(150),
  description: z.string().max(5000).nullable().optional(),
  level: z.string().max(20).default("A1"),
  language: z.string().max(10).default("es"),
  priceAmount: z.coerce.number().min(0).default(0),
  paymentType: z.enum(["EXTERNAL", "STRIPE_CONNECT"]).default("EXTERNAL"),
  paymentLink: externalUrlSchema.optional(),
  paymentInstructions: z.string().trim().max(2000, "Las instrucciones de pago no pueden superar los 2000 caracteres.").optional(),
  freePreview: z.boolean().default(true),
});

/**
 * Edita los datos de un curso ya creado. Sin esto, un error de tipeo en el
 * precio o en el enlace de pago obligaba a rehacer el curso entero.
 */
export async function updateCourseAction(courseId: string, formData: FormData) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await assertCourseInTenant(courseId, tenantId);

    const validated = updateCourseSchema.parse({
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      level: (formData.get("level") as string) || "A1",
      language: (formData.get("language") as string) || "es",
      priceAmount: formData.get("priceAmount") as string,
      paymentType: (formData.get("paymentType") as string) || "EXTERNAL",
      paymentLink: (formData.get("paymentLink") as string) || undefined,
      paymentInstructions: (formData.get("paymentInstructions") as string) || undefined,
      freePreview: formData.get("freePreview") === "on",
    });

    await CourseService.updateCourse(tenantId, courseId, {
      paymentInstructions: validated.paymentInstructions || null,
      freePreview: validated.freePreview,
      title: validated.title,
      description: validated.description ?? null,
      level: validated.level,
      language: validated.language,
      priceAmount: validated.priceAmount,
      paymentType: validated.paymentType,
      paymentLink: validated.paymentLink ?? null,
    });

    revalidatePath(`/dashboard/courses/${courseId}/builder`);
    revalidatePath("/dashboard/courses");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.errors?.[0]?.message || error.message || "No se pudo actualizar el curso." };
  }
}

const proposedStructureSchema = z.object({
  modules: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(150),
        description: z.string().trim().max(2000).optional().default(""),
        lessons: z
          .array(z.object({ title: z.string().trim().min(2).max(150) }))
          .max(30)
          .optional()
          .default([]),
      })
    )
    .min(1)
    .max(20),
});

/**
 * Añade al curso la estructura propuesta por la IA.
 *
 * Solo AÑADE: los módulos y lecciones existentes no se tocan. Reemplazarlos
 * borraría el contenido que el profesor ya hubiera escrito.
 */
export async function applyCourseStructureAction(courseId: string, proposal: unknown) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await assertCourseInTenant(courseId, tenantId);

    const { modules } = proposedStructureSchema.parse(proposal);

    const lastModule = await prisma.module.findFirst({
      where: { courseId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    let order = (lastModule?.order ?? 0) + 1;

    for (const mod of modules) {
      await prisma.module.create({
        data: {
          courseId,
          title: mod.title,
          description: mod.description || null,
          order: order++,
          lessons: {
            create: mod.lessons.map((lesson, index) => ({
              title: lesson.title,
              order: index + 1,
            })),
          },
        },
      });
    }

    revalidatePath(`/dashboard/courses/${courseId}/builder`);
    return { success: true, addedModules: modules.length };
  } catch (error: any) {
    return { success: false, error: error?.errors?.[0]?.message || error.message || "No se pudo aplicar la estructura." };
  }
}

const landingSchema = z.object({
  template: z.enum(["marca", "impacto", "portada", "minimal", "elegante", "horizonte"]).optional().default("marca"),
  headline: z.string().trim().min(3).max(200),
  subheadline: z.string().trim().max(500).optional().default(""),
  benefits: z.array(z.string().trim().max(300)).max(10).optional().default([]),
  callToAction: z.string().trim().max(120).optional().default("Inscríbete ahora"),
  audience: z.string().trim().max(1000).optional().default(""),
  // Imagen de portada: generada con IA (/api/uploads/...) o un enlace https
  heroImageUrl: z
    .string()
    .trim()
    .max(2048)
    .refine((v) => v === "" || /^\/api\/uploads\/[\w-]+\/[\w.-]+$/.test(v) || safeExternalUrl(v)?.startsWith("https://"), "La imagen debe ser un enlace https")
    .optional()
    .default(""),
});

/**
 * Guarda la landing de venta del curso (la genera el Copiloto IA y la revisa
 * el profesor antes de publicarla).
 */
export async function saveCourseLandingAction(courseId: string, landing: unknown) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await assertCourseInTenant(courseId, tenantId);

    const validated = landingSchema.parse(landing);

    await prisma.course.updateMany({
      where: { id: courseId, tenantId },
      data: { landing: validated },
    });

    revalidatePath(`/dashboard/courses/${courseId}/builder`);
    revalidatePath("/a", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.errors?.[0]?.message || error.message || "No se pudo guardar la landing." };
  }
}

/**
 * Imagen de portada de la landing generada con IA (1 crédito; se devuelve si falla).
 * Devuelve la URL para que el profesor la vea en la vista previa antes de publicar.
 */
export async function generateLandingHeroImageAction(courseId: string, prompt: string) {
  try {
    const { tenantId, userId } = await requireTenantAccess(STAFF_ROLES);
    await requireActiveSubscription(tenantId);
    await assertCourseInTenant(courseId, tenantId);
    const description = z.string().trim().min(5, "Describe la imagen (al menos 5 caracteres)").max(500).parse(prompt);

    const { AIService } = await import("@/modules/ai/ai.service");
    const item: { imagePrompt?: string; imageUrl?: string } = { imagePrompt: description };
    const { imagesGenerated, imageErrors } = await AIService.attachPromptImages([item], {
      tenantId,
      userId,
      count: 1,
      styleSuffix:
        "Fotografía realista y luminosa para la portada de una web de cursos, formato apaisado, composición amplia con espacio limpio en el centro para un titular. Sin texto, letras ni logotipos.",
    });
    if (!imagesGenerated || !item.imageUrl) {
      return { success: false as const, error: imageErrors[0] || "No se pudo generar la imagen." };
    }
    return { success: true as const, url: item.imageUrl };
  } catch (error: any) {
    return { success: false as const, error: error?.errors?.[0]?.message || error.message || "No se pudo generar la imagen." };
  }
}

/** Retira la landing del curso y vuelve a la presentación estándar. */
export async function removeCourseLandingAction(courseId: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await assertCourseInTenant(courseId, tenantId);
    await prisma.course.updateMany({ where: { id: courseId, tenantId }, data: { landing: Prisma.DbNull } });
    revalidatePath(`/dashboard/courses/${courseId}/builder`);
    revalidatePath("/a", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo quitar la landing." };
  }
}

/**
 * Mueve un curso (o una lección suelta) a la papelera: desaparece de la
 * plataforma pero se puede restaurar durante 30 días. Se rechaza si ya emitió
 * certificados: en ese caso la salida correcta es archivarlo.
 */
export async function deleteCourseAction(courseId: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const { TrashService } = await import("@/modules/course/trash.service");
    await TrashService.moveCourseToTrash(tenantId, courseId);
    revalidatePath("/dashboard/courses");
    revalidatePath("/dashboard/lessons");
    revalidatePath("/dashboard/papelera");
    revalidatePath("/a", "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo eliminar el curso." };
  }
}

/**
 * Archiva un curso: deja de aparecer en el catálogo público pero conserva
 * el contenido, las inscripciones y los certificados emitidos.
 */
export async function archiveCourseAction(courseId: string) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    await assertCourseInTenant(courseId, tenantId);
    await CourseService.updateCourseStatus(tenantId, courseId, "ARCHIVED");
    revalidatePath("/dashboard/courses");
    revalidatePath(`/dashboard/courses/${courseId}/builder`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo archivar el curso." };
  }
}

const teacherPlanSchema = z.object({
  objective: z.string().max(1000).optional().default(""),
  prerequisites: z.array(z.string().max(300)).max(10).optional().default([]),
  classFlow: z
    .array(z.object({ minute: z.number(), durationMinutes: z.number(), activity: z.string().max(500) }))
    .max(20)
    .optional()
    .default([]),
  homework: z.string().max(2000).optional().default(""),
  teacherNotes: z.array(z.string().max(500)).max(15).optional().default([]),
});

/**
 * Guarda el plan del profesor de una lección (guion, notas, tarea).
 * NO es contenido del alumno: se queda en el panel docente.
 */
export async function saveTeacherPlanAction(lessonId: string, plan: unknown) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const lesson = await assertLessonInTenant(lessonId, tenantId);
    const validated = teacherPlanSchema.parse(plan);

    await prisma.lesson.update({ where: { id: lessonId }, data: { teacherPlan: validated } });
    revalidatePath(`/dashboard/courses/${lesson.module.courseId}/lessons/${lessonId}`);
  revalidatePath(`/dashboard/lessons/${lessonId}`, "layout");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.errors?.[0]?.message || error.message || "No se pudo guardar el plan." };
  }
}

export async function toggleCourseStatusAction(courseId: string, currentStatus: string): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const newStatus = currentStatus === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
  await CourseService.updateCourseStatus(tenantId, courseId, newStatus);
  revalidatePath(`/dashboard/courses/${courseId}/builder`);
  revalidatePath("/dashboard/courses");
}

export async function deleteModuleAction(moduleId: string): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const mod = await assertModuleInTenant(moduleId, tenantId);
  await CourseService.deleteModule(moduleId);
  revalidatePath(`/dashboard/courses/${mod.courseId}/builder`);
}

export async function deleteLessonAction(lessonId: string): Promise<void> {
  const { tenantId } = await requireTenantAccess(STAFF_ROLES);
  const lesson = await assertLessonInTenant(lessonId, tenantId);
  await CourseService.deleteLesson(lessonId);
  revalidatePath(`/dashboard/courses/${lesson.module.courseId}/builder`);
}

/**
 * Marca/desmarca una lección como completada para el usuario de la sesión.
 * El alumno debe estar inscrito en el curso (o ser staff de la academia).
 */
export async function toggleLessonProgressAction(lessonId: string) {
  const { tenantId, userId, role } = await requireTenantAccess();

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { tenantId, deletedAt: null } } },
    select: { id: true, module: { select: { course: { select: { id: true, slug: true } } } } },
  });
  if (!lesson) throw new Error("Lección no encontrada.");

  const course = lesson.module.course;

  if (role === "STUDENT") {
    const enrollment = await prisma.enrollment.findFirst({
      where: { courseId: course.id, membership: { userId, tenantId } },
      select: { id: true },
    });
    if (!enrollment) throw new Error("No estás inscrito en este curso.");
  }

  const result = await CourseService.toggleLessonProgress(userId, lessonId);
  revalidatePath(`/campus/courses/${course.id}`);
  return result;
}

import { Prisma, type TeachingResource } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ClassPlanOutput } from "@/modules/ai/class-plan.schema";
import { planToLessonBlocks, planToTeacherPlan, readResourceData } from "./plan-to-lesson";

export type LessonDestination = { mode: "standalone" } | { mode: "module"; moduleId: string };

/**
 * Lógica compartida de "Mis recursos". Vive fuera de los archivos "use server"
 * porque recibe el tenantId ya verificado: exponerla como Server Action
 * permitiría a un cliente pasar un tenant ajeno.
 */
export class ResourceService {
  static async saveClassPlan(input: {
    tenantId: string;
    userId: string;
    plan: ClassPlanOutput;
    subject: string;
    grade: string;
    topic: string;
  }) {
    return prisma.teachingResource.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        kind: "CLASS_PLAN",
        title: input.plan.title.slice(0, 200),
        subject: input.subject,
        grade: input.grade,
        topic: input.topic,
        data: input.plan as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Crea una lección del campus a partir de un recurso: contenido y actividades
   * intercaladas para el alumno, y el guion del profesor en la lección.
   */
  static async convertToLesson(resource: TeachingResource, tenantId: string, dest: LessonDestination) {
    const { plan } = readResourceData(resource.kind, resource.data, resource.title);
    const content = JSON.stringify({ blocks: planToLessonBlocks(plan) });
    const teacherPlan = (resource.kind === "CLASS_PLAN" ? planToTeacherPlan(plan) : Prisma.JsonNull) as Prisma.InputJsonValue;

    let moduleId: string | null = null;
    let courseId: string | null = null;
    if (dest.mode === "module") {
      const mod = await prisma.module.findFirst({ where: { id: dest.moduleId, course: { tenantId, deletedAt: null } }, select: { id: true, courseId: true } });
      if (!mod) throw new Error("Módulo no encontrado en tu academia.");
      moduleId = mod.id;
      courseId = mod.courseId;
    }

    return prisma.$transaction(async (tx) => {
      if (!moduleId || !courseId) {
        const { slugify } = await import("@/modules/academy/academy.service");
        const base = slugify(resource.title) || "leccion";
        let slug = base;
        // deletedAt: undefined → también cuenta los cursos de la papelera (su slug sigue ocupado)
        for (let i = 1; await tx.course.findUnique({ where: { tenantId_slug: { tenantId, slug }, deletedAt: undefined } }); i++) slug = `${base}-${i}`;

        const course = await tx.course.create({
          data: {
            tenantId,
            title: resource.title,
            slug,
            description: plan.summary || null,
            level: (resource.grade || "A1").slice(0, 20),
            language: "es",
            priceAmount: 0,
            currency: "USD",
            paymentType: "EXTERNAL",
            status: "DRAFT",
            contentType: "STANDALONE_LESSON",
          },
        });
        const mod = await tx.module.create({ data: { courseId: course.id, title: "Clase", order: 1 } });
        moduleId = mod.id;
        courseId = course.id;
      }

      const order = (await tx.lesson.count({ where: { moduleId } })) + 1;
      const lesson = await tx.lesson.create({
        data: { moduleId, title: resource.title, order, content, teacherPlan },
      });
      await tx.teachingResource.update({ where: { id: resource.id }, data: { lessonId: lesson.id } });
      return { courseId: courseId!, lessonId: lesson.id };
    });
  }
}

import { prisma } from "@/lib/db";
import { slugify } from "@/modules/academy/academy.service";

export interface CreateCourseInput {
  tenantId: string;
  title: string;
  slug?: string;
  description?: string;
  language?: string;
  level?: string;
  priceAmount?: number;
  currency?: string;
  imageUrl?: string;
}

export interface CreateModuleInput {
  courseId: string;
  title: string;
  description?: string;
  order?: number;
}

export interface CreateLessonInput {
  moduleId: string;
  title: string;
  content?: string;
  order?: number;
}

export class CourseService {
  /**
   * Crea un nuevo curso para un tenant específico.
   */
  static async createCourse(input: CreateCourseInput) {
    const validTenantId = input.tenantId;
    const existingTenant = await prisma.tenant.findUnique({ where: { id: validTenantId }, select: { id: true } });
    if (!existingTenant) {
      throw new Error("Academia no encontrada.");
    }

    const baseSlug = input.slug ? slugify(input.slug) : slugify(input.title);
    let finalSlug = baseSlug;
    let counter = 1;

    // Verificar unicidad de slug dentro del mismo tenant
    while (
      await prisma.course.findUnique({
        where: {
          tenantId_slug: {
            tenantId: validTenantId,
            slug: finalSlug,
          },
        },
      })
    ) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    return prisma.course.create({
      data: {
        tenantId: validTenantId,
        title: input.title,
        slug: finalSlug,
        description: input.description || undefined,
        language: input.language || "es",
        level: input.level || "A1",
        priceAmount: input.priceAmount || 0,
        currency: input.currency || "USD",
        imageUrl: input.imageUrl,
        status: "DRAFT",
      },
    });
  }

  /**
   * Obtiene todos los cursos pertenecientes a un tenant.
   */
  static async getCoursesByTenant(tenantId: string) {
    return prisma.course.findMany({
      where: { tenantId },
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Obtiene un curso completo con su currículo (Módulos y Lecciones).
   */
  static async getCourseWithCurriculum(tenantId: string, courseId: string) {
    return prisma.course.findFirst({
      where: { id: courseId, tenantId },
      include: {
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });
  }

  /**
   * Crea un nuevo módulo dentro de un curso.
   */
  static async createModule(input: CreateModuleInput) {
    const existingModulesCount = await prisma.module.count({
      where: { courseId: input.courseId },
    });

    return prisma.module.create({
      data: {
        courseId: input.courseId,
        title: input.title,
        description: input.description,
        order: input.order ?? existingModulesCount + 1,
      },
    });
  }

  /**
   * Crea una nueva lección dentro de un módulo.
   */
  static async createLesson(input: CreateLessonInput) {
    const existingLessonsCount = await prisma.lesson.count({
      where: { moduleId: input.moduleId },
    });

    return prisma.lesson.create({
      data: {
        moduleId: input.moduleId,
        title: input.title,
        content: input.content || JSON.stringify({ blocks: [] }),
        order: input.order ?? existingLessonsCount + 1,
      },
    });
  }

  /**
   * Actualiza el contenido de bloques de una lección.
   */
  static async updateLessonContent(lessonId: string, contentJsonString: string) {
    const existing = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error("Lección no encontrada.");
    }

    return prisma.lesson.update({
      where: { id: lessonId },
      data: { content: contentJsonString },
    });
  }

  /**
   * Cambia el estado de un curso (DRAFT, PUBLISHED, ARCHIVED).
   */
  static async updateCourseStatus(tenantId: string, courseId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    const result = await prisma.course.updateMany({
      where: { id: courseId, tenantId },
      data: { status },
    });
    if (result.count === 0) {
      throw new Error("Curso no encontrado en esta academia.");
    }
    return prisma.course.findFirst({ where: { id: courseId, tenantId } });
  }

  /**
   * Elimina un módulo de un curso.
   */
  static async deleteModule(moduleId: string) {
    return prisma.module.delete({
      where: { id: moduleId },
    });
  }

  /**
   * Elimina una lección de un módulo.
   */
  static async deleteLesson(lessonId: string) {
    return prisma.lesson.delete({
      where: { id: lessonId },
    });
  }

  /**
   * Marca o desmarca una lección como completada por un estudiante.
   */
  static async toggleLessonProgress(userId: string, lessonId: string) {
    const existing = await prisma.progress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId,
        },
      },
    });

    if (existing) {
      return prisma.progress.update({
        where: { id: existing.id },
        data: { completed: !existing.completed },
      });
    }

    return prisma.progress.create({
      data: {
        userId,
        lessonId,
        completed: true,
      },
    });
  }

  /**
   * Obtiene las lecciones completadas por un usuario para un curso específico y calcula el % de avance.
   */
  static async getUserCourseProgress(userId: string, courseId: string) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });

    if (!course) return { completedLessonIds: [], percentage: 0, totalLessons: 0 };

    const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    if (allLessonIds.length === 0) return { completedLessonIds: [], percentage: 0, totalLessons: 0 };

    const completedProgress = await prisma.progress.findMany({
      where: {
        userId,
        lessonId: { in: allLessonIds },
        completed: true,
      },
    });

    const completedLessonIds = completedProgress.map((p) => p.lessonId);
    const percentage = Math.round((completedLessonIds.length / allLessonIds.length) * 100);

    return {
      completedLessonIds,
      percentage,
      totalLessons: allLessonIds.length,
    };
  }

  /**
   * Consulta pública de un curso por su slug dentro de una academia (para el visor del estudiante).
   */
  static async getPublicCourseBySlug(tenantSlug: string, courseSlug: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
    });

    if (!tenant) return null;

    return prisma.course.findFirst({
      where: {
        tenantId: tenant.id,
        slug: courseSlug,
        status: "PUBLISHED",
      },
      include: {
        tenant: true,
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
            },
          },
        },
      },
    });
  }
}

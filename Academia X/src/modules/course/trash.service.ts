import { prisma } from "@/lib/db";

/**
 * Papelera de cursos (incluidas las lecciones sueltas, que son cursos de tipo
 * STANDALONE_LESSON) y de recursos de "Mis recursos".
 *
 * Borrar = poner deletedAt: desaparece de toda la plataforma (ver src/lib/db.ts)
 * pero conserva módulos, lecciones, inscripciones y resultados. Se puede
 * restaurar durante TRASH_DAYS días; después se elimina definitivamente.
 */
export const TRASH_DAYS = 30;

const CERTIFICATES_MESSAGE = (n: number) =>
  `Este curso tiene ${n} certificado(s) emitido(s) y no puede eliminarse. Archívalo para retirarlo del catálogo sin invalidar los certificados de tus alumnos.`;

/** Lo que está en la papelera (nombrar deletedAt hace que la consulta lo vea). */
const inTrash = { deletedAt: { not: null } } as const;

export function purgeDate(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + TRASH_DAYS * 24 * 60 * 60 * 1000);
}

export class TrashService {
  static async moveCourseToTrash(tenantId: string, courseId: string) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, tenantId },
      select: { id: true, _count: { select: { certificates: true } } },
    });
    if (!course) throw new Error("Curso no encontrado en esta academia.");
    if (course._count.certificates > 0) throw new Error(CERTIFICATES_MESSAGE(course._count.certificates));
    await prisma.course.updateMany({ where: { id: courseId, tenantId, deletedAt: null }, data: { deletedAt: new Date() } });
  }

  static async restoreCourse(tenantId: string, courseId: string) {
    const res = await prisma.course.updateMany({ where: { id: courseId, tenantId, ...inTrash }, data: { deletedAt: null } });
    if (res.count === 0) throw new Error("Ese curso ya no está en la papelera.");
  }

  /** Elimina para siempre un curso que ya estaba en la papelera. */
  static async deleteCourseForever(tenantId: string, courseId: string) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, tenantId, ...inTrash },
      select: { id: true, _count: { select: { certificates: true } } },
    });
    if (!course) throw new Error("Ese curso ya no está en la papelera.");
    if (course._count.certificates > 0) throw new Error(CERTIFICATES_MESSAGE(course._count.certificates));
    await prisma.course.delete({ where: { id: course.id } });
  }

  static async moveResourceToTrash(tenantId: string, resourceId: string) {
    const res = await prisma.teachingResource.updateMany({ where: { id: resourceId, tenantId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (res.count === 0) throw new Error("Recurso no encontrado en tu academia.");
  }

  static async restoreResource(tenantId: string, resourceId: string) {
    const res = await prisma.teachingResource.updateMany({ where: { id: resourceId, tenantId, ...inTrash }, data: { deletedAt: null } });
    if (res.count === 0) throw new Error("Ese recurso ya no está en la papelera.");
  }

  static async deleteResourceForever(tenantId: string, resourceId: string) {
    const res = await prisma.teachingResource.deleteMany({ where: { id: resourceId, tenantId, ...inTrash } });
    if (res.count === 0) throw new Error("Ese recurso ya no está en la papelera.");
  }

  static async listTrash(tenantId: string) {
    const [courses, resources] = await Promise.all([
      prisma.course.findMany({
        where: { tenantId, ...inTrash },
        orderBy: { deletedAt: "desc" },
        select: {
          id: true,
          title: true,
          contentType: true,
          deletedAt: true,
          _count: { select: { enrollments: true } },
          modules: { select: { _count: { select: { lessons: true } } } },
        },
      }),
      prisma.teachingResource.findMany({
        where: { tenantId, ...inTrash },
        orderBy: { deletedAt: "desc" },
        select: { id: true, title: true, kind: true, subject: true, deletedAt: true },
      }),
    ]);
    return { courses, resources };
  }

  /**
   * Elimina definitivamente lo que lleva más de TRASH_DAYS días en la papelera.
   * Sin tenantId, de todas las academias (tarea programada). Los cursos con
   * certificados nunca se borran (no deberían estar en la papelera).
   */
  static async purgeExpired(tenantId?: string) {
    const cutoff = new Date(Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000);
    const scope = tenantId ? { tenantId } : {};
    const [courses, resources] = await Promise.all([
      prisma.course.deleteMany({ where: { ...scope, deletedAt: { not: null, lt: cutoff }, certificates: { none: {} } } }),
      prisma.teachingResource.deleteMany({ where: { ...scope, deletedAt: { not: null, lt: cutoff } } }),
    ]);
    return { courses: courses.count, resources: resources.count };
  }
}

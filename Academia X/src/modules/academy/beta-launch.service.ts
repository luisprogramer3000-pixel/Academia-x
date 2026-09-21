import { prisma } from "@/lib/db";
import { AcademyService } from "./academy.service";
import { CourseService } from "@/modules/course/course.service";

export class BetaLaunchService {
  /**
   * Crea y configura el tenant insignia JL Global Institute como el primer cliente real del fundador.
   */
  static async seedJLGlobalInstitute() {
    const slug = "jl-institute";

    let tenant = await prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      const created = await AcademyService.createAcademy({
        name: "JL Global Institute",
        slug,
        language: "es",
        primaryColor: "#2563eb",
        secondaryColor: "#1e293b",
        userEmail: "jorge@jlinstitute.com",
        userName: "Prof. Jorge López",
      });

      tenant = created.tenant;

      // Crear cursos de demostración y laboratorio real
      const course1 = await CourseService.createCourse({
        tenantId: tenant.id,
        title: "Español Profesional B2 - Negocios e Industria",
        slug: "espanol-b2-negocios",
        description: "Curso avanzado de comunicación corporativa, negociación y protocolo de negocios en español.",
        level: "B2",
        priceAmount: 149,
        language: "es",
      });

      await CourseService.updateCourseStatus(tenant.id, course1.id, "PUBLISHED");

      const course2 = await CourseService.createCourse({
        tenantId: tenant.id,
        title: "IA para Profesores de Idiomas: De Cero a Creador de Cursos",
        slug: "ia-para-profesores-de-idiomas",
        description: "Formación especializada para docentes en el uso de Inteligencia Artificial para la enseñanza y creación de contenidos.",
        level: "Todos los niveles",
        priceAmount: 199,
        language: "es",
      });

      await CourseService.updateCourseStatus(tenant.id, course2.id, "PUBLISHED");
    }

    return tenant;
  }

  /**
   * Obtiene analíticas avanzadas del lanzamiento Beta (objetivo: 10-30 profesores independientes).
   */
  static async getBetaAnalytics() {
    const [totalAcademies, totalTeachers, totalStudents, totalCourses, totalAIGenerations] = await Promise.all([
      prisma.tenant.count(),
      prisma.membership.count({
        where: { role: { in: ["OWNER", "TEACHER"] } },
      }),
      prisma.membership.count({
        where: { role: "STUDENT" },
      }),
      prisma.course.count(),
      prisma.aIUsage.count(),
    ]);

    return {
      totalAcademies,
      activeBetaTeachers: totalTeachers,
      targetBetaTeachers: 30,
      totalStudents,
      totalCourses,
      totalAIGenerations,
      progressPercentage: Math.min(100, Math.round((totalTeachers / 30) * 100)),
    };
  }
}

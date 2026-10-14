import { prisma } from "@/lib/db";
import { DEFAULT_BRAND_BACKGROUND } from "@/lib/brand-theme";

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export interface CreateAcademyInput {
  name: string;
  slug?: string;
  language?: string;
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
  userEmail: string;
  userName?: string;
  passwordHash?: string;
}

const RESERVED_SLUGS = new Set(["www", "app", "api", "admin", "dashboard", "login", "register", "campus", "a", "static", "mail"]);

export interface UpdateBrandingInput {
  tenantId: string;
  name?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  language?: string;
}

export class AcademyService {
  /**
   * Crea una nueva Academia (Tenant) y un usuario OWNER nuevo con contraseña.
   * Si el email ya está registrado se rechaza: crear una academia nunca debe
   * otorgar acceso a una cuenta existente.
   */
  static async createAcademy(input: CreateAcademyInput) {
    const email = input.userEmail.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error("Ya existe una cuenta con este email. Inicia sesión para continuar.");
    }

    const baseSlug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (!baseSlug || RESERVED_SLUGS.has(baseSlug)) {
      throw new Error("El subdominio elegido no está disponible.");
    }

    let finalSlug = baseSlug;
    let counter = 1;
    while (await prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name: input.userName || input.name,
          passwordHash: input.passwordHash,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          name: input.name,
          slug: finalSlug,
          language: input.language || "es",
          primaryColor: input.primaryColor || "#3B82F6",
          secondaryColor: input.secondaryColor || DEFAULT_BRAND_BACKGROUND,
          memberships: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });

      return { tenant, user };
    });
  }

  /**
   * Obtiene la información pública de una academia por su slug.
   */
  static async getAcademyBySlug(slug: string) {
    try {
      return await prisma.tenant.findUnique({
        where: { slug },
        include: {
          courses: {
            // Las relaciones no pasan por el filtro automático de la papelera (src/lib/db.ts)
            where: { status: "PUBLISHED", deletedAt: null },
          },
        },
      });
    } catch (error) {
      console.warn("Database query failed in getAcademyBySlug, falling back to mock mode:", error);
      return null;
    }
  }

  /**
   * Actualiza la configuración de branding de una academia.
   */
  static async updateAcademyBranding(input: UpdateBrandingInput) {
    return prisma.tenant.update({
      where: { id: input.tenantId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.logoUrl && { logoUrl: input.logoUrl }),
        ...(input.primaryColor && { primaryColor: input.primaryColor }),
        ...(input.secondaryColor && { secondaryColor: input.secondaryColor }),
        ...(input.language && { language: input.language }),
      },
    });
  }

  /**
   * Asigna (o elimina con null) el dominio personalizado de una academia.
   */
  static async setCustomDomain(tenantId: string, customDomain: string | null) {
    if (customDomain) {
      const taken = await prisma.tenant.findFirst({ where: { customDomain, NOT: { id: tenantId } }, select: { id: true } });
      if (taken) throw new Error("Ese dominio ya está en uso por otra academia.");
    }
    return prisma.tenant.update({ where: { id: tenantId }, data: { customDomain } });
  }

  /**
   * Obtiene una academia por su ID de Tenant.
   */
  static async getAcademyById(tenantId: string) {
    try {
      return await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          courses: { where: { deletedAt: null } },
          memberships: {
            include: {
              user: true,
            },
          },
        },
      });
    } catch (error) {
      console.warn("Database query failed in getAcademyById:", error);
      return null;
    }
  }

  /**
   * Obtiene la lista general de academias registradas en la plataforma.
   */
  static async listAcademia() {
    return prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { courses: { where: { deletedAt: null } }, memberships: true },
        },
      },
    });
  }

  /**
   * Obtiene estadísticas y métricas en tiempo real para el Dashboard de la Academia.
   */
  static async getAcademyDashboardStats(tenantId: string) {
    try {
      const [studentsCount, teachersCount, coursesCount, publishedCoursesCount] = await Promise.all([
        prisma.membership.count({
          where: { tenantId, role: "STUDENT" },
        }),
        prisma.membership.count({
          where: { tenantId, role: "TEACHER" },
        }),
        prisma.course.count({
          where: { tenantId },
        }),
        prisma.course.count({
          where: { tenantId, status: "PUBLISHED" },
        }),
      ]);

      return {
        studentsCount,
        teachersCount: teachersCount + 1, // Incluye al Owner que enseña
        coursesCount,
        publishedCoursesCount,
        monthlyRevenue: 0, // Pendiente: ventas de cursos de la academia
        currency: "USD",
      };
    } catch (error) {
      console.warn("Error calculating dashboard stats, returning fallback stats:", error);
      return {
        studentsCount: 0,
        teachersCount: 1,
        coursesCount: 0,
        publishedCoursesCount: 0,
        monthlyRevenue: 0,
        currency: "USD",
      };
    }
  }
}

import { prisma } from "@/lib/db";
import { cryptoNativeToken } from "@/lib/utils";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { getAppUrl } from "@/lib/stripe";
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { assertCanAddMember } from "@/modules/billing/entitlements";

export interface InviteUserInput {
  tenantId: string;
  email: string;
  role: "STUDENT" | "TEACHER";
}

export interface AcceptInvitationInput {
  token: string;
  name: string;
  password?: string;
}

export class UserService {
  /**
   * Crea una invitación con token único para un estudiante o profesor.
   */
  static async inviteUser(input: InviteUserInput) {
    const token = cryptoNativeToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    // Eliminar invitaciones expiradas previas para este email/tenant
    await prisma.invitation.deleteMany({
      where: {
        tenantId: input.tenantId,
        email: input.email.toLowerCase(),
      },
    });

    const invitation = await prisma.invitation.create({
      data: {
        tenantId: input.tenantId,
        email: input.email.toLowerCase(),
        role: input.role,
        token,
        expiresAt,
      },
      include: { tenant: { select: { name: true } } },
    });

    const email = EmailTemplates.invitation({
      academyName: invitation.tenant.name,
      role: input.role,
      url: `${getAppUrl()}/invite/${token}`,
    });
    const delivery = await sendEmail({ to: invitation.email, ...email });

    return { ...invitation, emailSent: delivery.sent };
  }

  /**
   * Valida y procesa la aceptación de una invitación pública.
   * - Usuario nuevo: se crea con la contraseña indicada.
   * - Usuario existente con contraseña: debe confirmar su contraseña actual.
   */
  static async acceptInvitation(input: AcceptInvitationInput) {
    const invitation = await prisma.invitation.findUnique({
      where: { token: input.token },
      include: { tenant: true },
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      throw new Error("La invitación es inválida o ha expirado.");
    }

    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email }, select: { id: true } });
    const alreadyMember = existingUser
      ? await prisma.membership.findUnique({
          where: { userId_tenantId: { userId: existingUser.id, tenantId: invitation.tenantId } },
          select: { role: true },
        })
      : null;
    if (!alreadyMember || (alreadyMember.role === "STUDENT" && invitation.role === "TEACHER")) {
      // La propia invitación ya reservaba un cupo: no se cuentan invitaciones pendientes
      await assertCanAddMember(invitation.tenantId, invitation.role as "STUDENT" | "TEACHER", { countPendingInvitations: false });
    }

    const user = await UserService.resolveUserWithPassword(invitation.email, input.name, input.password);

    const existingMembership = await prisma.membership.findUnique({
      where: { userId_tenantId: { userId: user.id, tenantId: invitation.tenantId } },
    });

    // Nunca degradar a un OWNER mediante una invitación
    const membership = existingMembership
      ? existingMembership.role === "OWNER"
        ? existingMembership
        : await prisma.membership.update({ where: { id: existingMembership.id }, data: { role: invitation.role } })
      : await prisma.membership.create({
          data: { userId: user.id, tenantId: invitation.tenantId, role: invitation.role },
        });

    await prisma.invitation.delete({
      where: { id: invitation.id },
    });

    return { user, membership, tenant: invitation.tenant };
  }

  /**
   * Obtiene o crea un usuario verificando credenciales:
   * nunca permite tomar el control de una cuenta existente sin su contraseña.
   */
  private static async resolveUserWithPassword(email: string, name: string, password?: string) {
    const normalizedEmail = email.toLowerCase().trim();
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existing) {
      if (existing.passwordHash) {
        const ok = await verifyPassword(password, existing.passwordHash);
        if (!ok) {
          throw new Error("Ya existe una cuenta con este email. Ingresa tu contraseña actual para continuar.");
        }
        return existing;
      }
      // Cuenta heredada sin contraseña: se establece ahora
      return prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash: await hashPassword(password), name: existing.name || name },
      });
    }

    return prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        passwordHash: await hashPassword(password),
      },
    });
  }

  /**
   * Obtiene la lista de estudiantes inscritos en una academia.
   */
  static async getStudentsByTenant(tenantId: string) {
    return prisma.membership.findMany({
      where: {
        tenantId,
        role: "STUDENT",
      },
      include: {
        user: true,
        enrollments: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Obtiene la lista de profesores asignados a una academia.
   */
  static async getTeachersByTenant(tenantId: string) {
    return prisma.membership.findMany({
      where: {
        tenantId,
        role: { in: ["TEACHER", "OWNER"] },
      },
      include: {
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Inscribe a un estudiante directamente en un curso de la academia.
   */
  static async enrollStudentInCourse(membershipId: string, courseId: string) {
    return prisma.enrollment.upsert({
      where: {
        membershipId_courseId: {
          membershipId,
          courseId,
        },
      },
      update: {},
      create: {
        membershipId,
        courseId,
      },
    });
  }

  /**
   * Remueve la inscripción de un alumno de un curso.
   */
  static async unenrollStudentFromCourse(membershipId: string, courseId: string) {
    return prisma.enrollment.deleteMany({
      where: {
        membershipId,
        courseId,
      },
    });
  }

  /**
   * Obtiene la lista de invitaciones pendientes y no expiradas de un tenant.
   */
  static async getPendingInvitations(tenantId: string) {
    return prisma.invitation.findMany({
      where: {
        tenantId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Revoca / elimina una invitación pendiente.
   */
  static async revokeInvitation(id: string, tenantId: string) {
    return prisma.invitation.deleteMany({
      where: {
        id,
        tenantId,
      },
    });
  }

  /**
   * Registra públicamente a un alumno en una academia (p.ej. desde /a/[slug]/join)
   */
  static async registerPublicStudent(tenantId: string, input: { name: string; email: string; password?: string }) {
    const existingUser = await prisma.user.findUnique({ where: { email: input.email.toLowerCase().trim() }, select: { id: true } });
    const alreadyMember = existingUser
      ? await prisma.membership.findUnique({ where: { userId_tenantId: { userId: existingUser.id, tenantId } }, select: { id: true } })
      : null;
    if (!alreadyMember) {
      await assertCanAddMember(tenantId, "STUDENT");
    }

    const user = await UserService.resolveUserWithPassword(input.email, input.name, input.password);

    const membership = await prisma.membership.upsert({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        tenantId,
        role: "STUDENT",
      },
    });

    return { user, membership };
  }
}


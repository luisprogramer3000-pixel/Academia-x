import { describe, it, expect } from "vitest";
import { cryptoNativeToken } from "@/lib/utils";
import { UserService } from "@/modules/user/user.service";
import { prisma } from "@/lib/db";

describe("UserService & User Management Core", () => {
  const createTestTenant = async (name: string, slug: string) => {
    // Limpieza previa si existe
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      await prisma.tenant.delete({ where: { id: existing.id } });
    }
    return prisma.tenant.create({
      data: { name, slug },
    });
  };

  it("Debe generar tokens de invitación aleatorios y únicos de 48 caracteres hexadecimales", () => {
    const token1 = cryptoNativeToken();
    const token2 = cryptoNativeToken();

    expect(token1).toHaveLength(48);
    expect(token2).toHaveLength(48);
    expect(token1).not.toBe(token2);
  });

  it("Debe crear una invitación y permitir listar invitaciones pendientes", async () => {
    const tenant = await createTestTenant("Academia Invitaciones", "tenant-invites-test");
    try {
      const invite = await UserService.inviteUser({
        tenantId: tenant.id,
        email: "alumno.test@ejemplo.com",
        role: "STUDENT",
      });

      expect(invite).toBeDefined();
      expect(invite.email).toBe("alumno.test@ejemplo.com");
      expect(invite.role).toBe("STUDENT");

      const pending = await UserService.getPendingInvitations(tenant.id);
      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending[0].email).toBe("alumno.test@ejemplo.com");
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("Debe permitir revocar una invitación pendiente", async () => {
    const tenant = await createTestTenant("Academia Revocar", "tenant-revoke-test");
    try {
      const invite = await UserService.inviteUser({
        tenantId: tenant.id,
        email: "profesor.revocar@ejemplo.com",
        role: "TEACHER",
      });

      await UserService.revokeInvitation(invite.id, tenant.id);

      const pending = await UserService.getPendingInvitations(tenant.id);
      const found = pending.find((i) => i.id === invite.id);
      expect(found).toBeUndefined();
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("Debe aceptar una invitación y crear usuario con su membresía", async () => {
    const tenant = await createTestTenant("Academia Aceptar", "tenant-accept-test");
    try {
      const invite = await UserService.inviteUser({
        tenantId: tenant.id,
        email: "nuevo.estudiante@ejemplo.com",
        role: "STUDENT",
      });

      const result = await UserService.acceptInvitation({
        token: invite.token,
        name: "Carlos Estudiante",
      });

      expect(result.user.email).toBe("nuevo.estudiante@ejemplo.com");
      expect(result.user.name).toBe("Carlos Estudiante");
      expect(result.membership.role).toBe("STUDENT");

      // Verificar que la invitación fue consumida/eliminada
      const pending = await UserService.getPendingInvitations(tenant.id);
      const found = pending.find((i) => i.id === invite.id);
      expect(found).toBeUndefined();
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("Debe registrar públicamente a un alumno en el tenant", async () => {
    const tenant = await createTestTenant("Academia Publica", "tenant-public-test");
    try {
      const result = await UserService.registerPublicStudent(tenant.id, {
        name: "Lucía Registro Público",
        email: "lucia.publica@ejemplo.com",
      });

      expect(result.user.name).toBe("Lucía Registro Público");
      expect(result.membership.role).toBe("STUDENT");
      expect(result.membership.tenantId).toBe(tenant.id);

      const students = await UserService.getStudentsByTenant(tenant.id);
      expect(students.some((s) => s.user.email === "lucia.publica@ejemplo.com")).toBe(true);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });

  it("Debe permitir inscribir y desinscribir un alumno a un curso", async () => {
    const tenant = await createTestTenant("Academia Cursos", "tenant-courses-test");
    try {
      const course = await prisma.course.create({
        data: {
          tenantId: tenant.id,
          title: "Inglés A1 Básico",
          slug: "ingles-a1-basico-test",
        },
      });

      const studentResult = await UserService.registerPublicStudent(tenant.id, {
        name: "Pedro Curso",
        email: "pedro.curso@ejemplo.com",
      });

      const enrollment = await UserService.enrollStudentInCourse(studentResult.membership.id, course.id);
      expect(enrollment).toBeDefined();
      expect(enrollment.courseId).toBe(course.id);

      // Verificar inscripción en lista de estudiantes
      let students = await UserService.getStudentsByTenant(tenant.id);
      let pedro = students.find((s) => s.id === studentResult.membership.id);
      expect(pedro?.enrollments.length).toBe(1);

      // Desinscribir
      await UserService.unenrollStudentFromCourse(studentResult.membership.id, course.id);
      students = await UserService.getStudentsByTenant(tenant.id);
      pedro = students.find((s) => s.id === studentResult.membership.id);
      expect(pedro?.enrollments.length).toBe(0);
    } finally {
      await prisma.tenant.delete({ where: { id: tenant.id } });
    }
  });
});

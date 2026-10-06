import { prisma } from "@/lib/db";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { getAppUrl } from "@/lib/stripe";

/**
 * Inscripción a cursos de pago: el alumno envía una solicitud (con comprobante
 * si pagó por transferencia) y el profesor la aprueba al confirmar el pago.
 * Solo al aprobar se crea la inscripción que da acceso a las lecciones.
 */
export class EnrollmentRequestService {
  /** Crea o reenvía la solicitud del alumno y avisa al staff de la academia. */
  static async submit(input: {
    tenantId: string;
    courseId: string;
    membershipId: string;
    message?: string | null;
    proofUrl?: string | null;
  }) {
    const existing = await prisma.enrollmentRequest.findUnique({
      where: { membershipId_courseId: { membershipId: input.membershipId, courseId: input.courseId } },
    });
    if (existing?.status === "APPROVED") return existing;

    const request = await prisma.enrollmentRequest.upsert({
      where: { membershipId_courseId: { membershipId: input.membershipId, courseId: input.courseId } },
      create: {
        tenantId: input.tenantId,
        courseId: input.courseId,
        membershipId: input.membershipId,
        message: input.message || null,
        proofUrl: input.proofUrl || null,
      },
      // Un reenvío (tras un rechazo o para añadir el comprobante) vuelve a quedar pendiente
      update: {
        status: "PENDING",
        message: input.message || existing?.message || null,
        proofUrl: input.proofUrl || existing?.proofUrl || null,
        reviewNote: null,
        reviewedAt: null,
        reviewedByUserId: null,
      },
      include: {
        course: { select: { title: true } },
        membership: { include: { user: { select: { name: true, email: true } } } },
      },
    });

    const student = request.membership.user;
    const studentName = student.name || student.email;
    const url = `${getAppUrl()}/dashboard/enrollment-requests`;

    // Campana del panel (una por solicitud y envío, sin duplicar)
    await prisma.notification
      .create({
        data: {
          tenantId: input.tenantId,
          type: "ENROLLMENT_REQUEST",
          title: `Solicitud de inscripción: ${request.course.title}`,
          message: `${studentName} quiere inscribirse${request.proofUrl ? " y adjuntó su comprobante de pago" : ""}.`,
          idempotencyKey: `enroll-request:${request.id}:${request.updatedAt.getTime()}`,
          metadata: { requestId: request.id, courseId: input.courseId },
        },
      })
      .catch((error) => console.warn("[enrollment] Notificación no creada:", error?.message));

    // Correo a los responsables de la academia
    const staff = await prisma.membership.findMany({
      where: { tenantId: input.tenantId, role: { in: ["OWNER", "TEACHER"] } },
      select: { user: { select: { email: true } } },
    });
    const email = EmailTemplates.enrollmentRequested({
      studentName,
      studentEmail: student.email,
      courseTitle: request.course.title,
      hasProof: Boolean(request.proofUrl),
      url,
    });
    await Promise.all(staff.map((s) => sendEmail({ to: s.user.email, ...email })));

    return request;
  }

  /** Aprueba la solicitud: crea la inscripción y avisa al alumno. */
  static async approve(tenantId: string, requestId: string, reviewerUserId: string) {
    const request = await prisma.enrollmentRequest.findFirst({
      // No se aprueban inscripciones a cursos que están en la papelera
      where: { id: requestId, tenantId, course: { deletedAt: null } },
      include: {
        course: { select: { id: true, title: true, tenant: { select: { name: true } } } },
        membership: { include: { user: { select: { email: true } } } },
      },
    });
    if (!request) throw new Error("Solicitud no encontrada.");

    await prisma.$transaction([
      prisma.enrollment.upsert({
        where: { membershipId_courseId: { membershipId: request.membershipId, courseId: request.courseId } },
        update: {},
        create: { membershipId: request.membershipId, courseId: request.courseId },
      }),
      prisma.enrollmentRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", reviewNote: null, reviewedAt: new Date(), reviewedByUserId: reviewerUserId },
      }),
    ]);

    await sendEmail({
      to: request.membership.user.email,
      ...EmailTemplates.enrollmentApproved({
        courseTitle: request.course.title,
        academyName: request.course.tenant.name,
        url: `${getAppUrl()}/campus/courses/${request.course.id}`,
      }),
    });
  }

  /** Rechaza la solicitud con un motivo visible para el alumno, que puede reenviarla. */
  static async reject(tenantId: string, requestId: string, reviewerUserId: string, note: string | null) {
    const request = await prisma.enrollmentRequest.findFirst({
      where: { id: requestId, tenantId },
      include: {
        course: { select: { title: true, slug: true, tenant: { select: { name: true, slug: true } } } },
        membership: { include: { user: { select: { email: true } } } },
      },
    });
    if (!request) throw new Error("Solicitud no encontrada.");
    if (request.status === "APPROVED") throw new Error("La solicitud ya fue aprobada.");

    await prisma.enrollmentRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", reviewNote: note, reviewedAt: new Date(), reviewedByUserId: reviewerUserId },
    });

    await sendEmail({
      to: request.membership.user.email,
      ...EmailTemplates.enrollmentRejected({
        courseTitle: request.course.title,
        academyName: request.course.tenant.name,
        note,
        url: `${getAppUrl()}/a/${request.course.tenant.slug}/courses/${request.course.slug}/inscripcion`,
      }),
    });
  }

  static async listForTenant(tenantId: string) {
    return prisma.enrollmentRequest.findMany({
      // Las solicitudes de cursos en la papelera no se muestran (vuelven si se restaura el curso)
      where: { tenantId, course: { deletedAt: null } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 200,
      include: {
        course: { select: { id: true, title: true, priceAmount: true, currency: true } },
        membership: { include: { user: { select: { name: true, email: true } } } },
      },
    });
  }

  static async countPending(tenantId: string) {
    return prisma.enrollmentRequest.count({ where: { tenantId, status: "PENDING", course: { deletedAt: null } } });
  }
}

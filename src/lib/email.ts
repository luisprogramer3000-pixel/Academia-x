/**
 * Envío de emails transaccionales vía API REST de Resend (https://resend.com).
 * Sin RESEND_API_KEY: en desarrollo se registra en consola; en producción se informa el error.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  sent: boolean;
  id?: string;
  error?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Mentor Studio Global <no-reply@mentorstudioglobal.com>";

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[email] RESEND_API_KEY no configurada: no se pudo enviar el email a", input.to);
      return { sent: false, error: "EMAIL_NOT_CONFIGURED" };
    }
    console.info(`[email:dev] Para: ${input.to}\nAsunto: ${input.subject}\n${input.text || input.html}`);
    return { sent: false, error: "EMAIL_DEV_MODE" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[email] Resend respondió", response.status, body.slice(0, 300));
      return { sent: false, error: `RESEND_${response.status}` };
    }

    const data = (await response.json()) as { id?: string };
    return { sent: true, id: data.id };
  } catch (error: any) {
    console.error("[email] Error enviando email:", error?.message);
    return { sent: false, error: "EMAIL_SEND_FAILED" };
  }
}

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.url}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(cta.label)}</a></p>
       <p style="font-size:12px;color:#64748b">Si el botón no funciona, copia este enlace: <br>${cta.url}</p>`
    : "";
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;padding:24px">
    <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:32px;color:#0f172a">
      <h1 style="font-size:20px;margin-top:0">${escapeHtml(title)}</h1>
      ${bodyHtml}
      ${button}
      <p style="font-size:12px;color:#94a3b8;margin-top:32px">Mentor Studio Global</p>
    </div></body></html>`;
}

export const EmailTemplates = {
  invitation(params: { academyName: string; role: "STUDENT" | "TEACHER"; url: string }) {
    const roleLabel = params.role === "TEACHER" ? "profesor" : "estudiante";
    const title = `Te invitaron a ${params.academyName}`;
    return {
      subject: title,
      html: layout(
        title,
        `<p>Has sido invitado a unirte a <strong>${escapeHtml(params.academyName)}</strong> como ${roleLabel}.</p>
         <p>La invitación caduca en 7 días.</p>`,
        { label: "Aceptar invitación", url: params.url }
      ),
      text: `${title}. Acepta tu invitación como ${roleLabel}: ${params.url}`,
    };
  },

  welcomeOwner(params: { name: string; academyName: string; dashboardUrl: string }) {
    const title = `¡Bienvenido a Mentor Studio Global, ${params.name}!`;
    return {
      subject: `Tu academia ${params.academyName} está lista`,
      html: layout(
        title,
        `<p>Tu academia <strong>${escapeHtml(params.academyName)}</strong> fue creada correctamente.</p>
         <p>Activa tu plan y comienza a crear cursos con Inteligencia Artificial.</p>`,
        { label: "Ir a mi panel", url: params.dashboardUrl }
      ),
      text: `${title} Accede a tu panel: ${params.dashboardUrl}`,
    };
  },

  enrollmentRequested(params: { studentName: string; studentEmail: string; courseTitle: string; hasProof: boolean; url: string }) {
    const title = `Nueva solicitud de inscripción: ${params.courseTitle}`;
    return {
      subject: title,
      html: layout(
        title,
        `<p><strong>${escapeHtml(params.studentName)}</strong> (${escapeHtml(params.studentEmail)}) quiere inscribirse en
         <strong>${escapeHtml(params.courseTitle)}</strong>.</p>
         <p>${params.hasProof ? "Adjuntó un comprobante de pago." : "Todavía no adjuntó comprobante de pago."}
         Revisa el pago y aprueba la solicitud para darle acceso al curso.</p>`,
        { label: "Revisar solicitud", url: params.url }
      ),
      text: `${title}. ${params.studentName} (${params.studentEmail}). Revisa la solicitud: ${params.url}`,
    };
  },

  enrollmentApproved(params: { courseTitle: string; academyName: string; url: string }) {
    const title = `¡Ya tienes acceso a ${params.courseTitle}!`;
    return {
      subject: title,
      html: layout(
        title,
        `<p><strong>${escapeHtml(params.academyName)}</strong> confirmó tu inscripción. Ya puedes ver todas las lecciones del curso.</p>`,
        { label: "Empezar el curso", url: params.url }
      ),
      text: `${title} Entra aquí: ${params.url}`,
    };
  },

  enrollmentRejected(params: { courseTitle: string; academyName: string; note?: string | null; url: string }) {
    const title = `Tu solicitud para ${params.courseTitle} necesita revisión`;
    return {
      subject: title,
      html: layout(
        title,
        `<p><strong>${escapeHtml(params.academyName)}</strong> no pudo confirmar tu inscripción todavía.</p>
         ${params.note ? `<p><strong>Motivo:</strong> ${escapeHtml(params.note)}</p>` : ""}
         <p>Puedes corregirlo y enviar la solicitud de nuevo.</p>`,
        { label: "Ver mi solicitud", url: params.url }
      ),
      text: `${title}.${params.note ? ` Motivo: ${params.note}.` : ""} Revisa tu solicitud: ${params.url}`,
    };
  },

  verifyEmail(params: { url: string; academyName?: string | null }) {
    const title = "Confirma tu correo electrónico";
    const intro = params.academyName
      ? `<p>Gracias por registrarte en <strong>${escapeHtml(params.academyName)}</strong>.</p>`
      : `<p>Gracias por registrarte en Mentor Studio Global.</p>`;
    return {
      subject: title,
      html: layout(
        title,
        `${intro}
         <p>Para activar tu cuenta, confirma que este correo es tuyo. El enlace caduca en 48 horas.</p>
         <p>Si no creaste esta cuenta, ignora este mensaje.</p>`,
        { label: "Confirmar mi correo", url: params.url }
      ),
      text: `${title}: ${params.url} (caduca en 48 horas). Si no creaste esta cuenta, ignora este mensaje.`,
    };
  },

  passwordReset(params: { url: string }) {
    const title = "Restablece tu contraseña";
    return {
      subject: title,
      html: layout(
        title,
        `<p>Recibimos una solicitud para restablecer tu contraseña. El enlace caduca en 1 hora.</p>
         <p>Si no fuiste tú, ignora este mensaje.</p>`,
        { label: "Crear nueva contraseña", url: params.url }
      ),
      text: `${title}: ${params.url} (caduca en 1 hora)`,
    };
  },
};

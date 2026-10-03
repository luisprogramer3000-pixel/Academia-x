import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, CreditCard, ExternalLink, Lock, Upload, UserPlus, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { safeExternalUrl } from "@/lib/utils";
import { BrandScope } from "@/lib/brand-theme";
import { publicRegisterStudentAction } from "@/app/actions/user.actions";
import { freeEnrollAction, openEnrolledCourseAction, submitEnrollmentRequestAction } from "@/app/actions/enrollment.actions";

interface Props {
  params: Promise<{ slug: string; courseSlug: string }>;
  searchParams: Promise<{ error?: string; enviada?: string }>;
}

export const metadata = { title: "Inscripción al curso" };

export default async function CourseEnrollmentPage({ params, searchParams }: Props) {
  const { slug, courseSlug } = await params;
  const { error, enviada } = await searchParams;

  const course = await prisma.course.findFirst({
    where: { slug: courseSlug, status: "PUBLISHED", contentType: "COURSE", tenant: { slug } },
    select: {
      id: true, title: true, description: true, level: true, priceAmount: true, currency: true,
      paymentLink: true, paymentInstructions: true, tenantId: true,
      tenant: { select: { id: true, name: true, primaryColor: true, secondaryColor: true } },
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  });
  if (!course) notFound();

  const self = `/a/${slug}/courses/${courseSlug}/inscripcion`;
  const accent = course.tenant.primaryColor || "#2563eb";
  const price = Number(course.priceAmount);
  const isPaid = price > 0;
  const lessonCount = course.modules.reduce((acc, m) => acc + m._count.lessons, 0);

  // ¿Quién es el visitante en esta academia?
  const session = await getSession();
  const membership = session?.userId
    ? await prisma.membership.findUnique({
        where: { userId_tenantId: { userId: session.userId, tenantId: course.tenantId } },
        select: {
          id: true,
          user: { select: { name: true, email: true } },
          enrollments: { where: { courseId: course.id }, select: { id: true } },
          enrollmentRequests: { where: { courseId: course.id }, select: { status: true, reviewNote: true, proofUrl: true, updatedAt: true } },
        },
      })
    : null;
  const enrolled = Boolean(membership?.enrollments.length);
  const request = membership?.enrollmentRequests[0] ?? null;

  async function register(formData: FormData) {
    "use server";
    const res = await publicRegisterStudentAction(formData);
    redirect(res.success ? self : `${self}?error=${encodeURIComponent(res.error || "No se pudo completar el registro")}`);
  }

  const paymentLink = safeExternalUrl(course.paymentLink);
  const input = "w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500";
  const label = "block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2";

  return (
    <BrandScope color={course.tenant.secondaryColor}>
      <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
        <div className="max-w-xl mx-auto space-y-6">
          <Link href={`/a/${slug}/courses/${courseSlug}`} className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Volver al curso
          </Link>

          {/* Resumen del curso */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: accent }}>{course.tenant.name}</p>
            <h1 className="text-2xl font-black text-white mb-2">{course.title}</h1>
            {course.description && <p className="text-sm text-slate-400 line-clamp-3 mb-4">{course.description}</p>}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="px-2.5 py-1 rounded-lg bg-slate-800">Nivel {course.level}</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-800">{lessonCount} lecciones</span>
              <span className="px-2.5 py-1 rounded-lg font-bold text-white" style={{ backgroundColor: accent }}>
                {isPaid ? `${price} ${course.currency}` : "Gratis"}
              </span>
            </div>
          </div>

          {error && <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

          {!membership ? (
            /* 1. Registro (o acceso con una cuenta existente) */
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Crea tu cuenta de estudiante</h2>
                <p className="text-sm text-slate-400">
                  {isPaid
                    ? "Después verás cómo pagar el curso. El acceso se activa cuando la academia confirme tu pago."
                    : "Después podrás empezar el curso de inmediato."}
                </p>
              </div>
              <form action={register} className="space-y-4">
                <input type="hidden" name="tenantId" value={course.tenantId} />
                <div>
                  <label className={label}>Nombre completo</label>
                  <input type="text" name="name" required minLength={2} placeholder="Ej. Sofía Ramírez" className={input} />
                </div>
                <div>
                  <label className={label}>Correo electrónico</label>
                  <input type="email" name="email" required placeholder="estudiante@ejemplo.com" className={input} />
                </div>
                <div>
                  <label className={label}>Contraseña (mínimo 8 caracteres)</label>
                  <input type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="••••••••" className={input} />
                  <p className="mt-2 text-[11px] text-slate-500">¿Ya tienes cuenta en Mentor Studio Global? Usa tu correo y tu contraseña actual.</p>
                </div>
                <button type="submit" className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2" style={{ backgroundColor: accent }}>
                  <UserPlus className="w-4 h-4" /> Continuar
                </button>
              </form>
            </div>
          ) : enrolled ? (
            /* Ya inscrito */
            <div className="p-6 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-white font-bold">Ya estás inscrito en este curso.</p>
              <form action={openEnrolledCourseAction.bind(null, course.id)}>
                <button type="submit" className="px-6 py-3 rounded-xl text-white font-bold text-sm" style={{ backgroundColor: accent }}>
                  Ir al curso
                </button>
              </form>
            </div>
          ) : !isPaid ? (
            /* Curso gratuito: inscripción inmediata */
            <form action={freeEnrollAction.bind(null, course.id)} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
              <p className="text-sm text-slate-300">Hola {membership.user.name || membership.user.email}, este curso es gratuito.</p>
              <button type="submit" className="w-full py-3.5 rounded-xl text-white font-bold text-sm" style={{ backgroundColor: accent }}>
                Inscribirme y empezar
              </button>
            </form>
          ) : (
            <>
              {/* Estado de la solicitud */}
              {request?.status === "PENDING" && (
                <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                  <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-amber-300">{enviada ? "¡Solicitud enviada!" : "Solicitud pendiente"}</p>
                    <p className="text-amber-200/80">
                      La academia revisará tu pago y te avisará por correo ({membership.user.email}) cuando tengas acceso.
                      {request.proofUrl ? " Tu comprobante fue recibido." : " Si ya pagaste, adjunta tu comprobante abajo para acelerar la revisión."}
                    </p>
                  </div>
                </div>
              )}
              {request?.status === "REJECTED" && (
                <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-bold text-red-300">La academia no pudo confirmar tu inscripción</p>
                    {request.reviewNote && <p className="text-red-200/80">Motivo: {request.reviewNote}</p>}
                    <p className="text-red-200/80">Corrige lo necesario y envía la solicitud de nuevo.</p>
                  </div>
                </div>
              )}

              {/* 2. Cómo pagar */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-5 h-5" style={{ color: accent }} /> 1. Realiza el pago de {price} {course.currency}
                </h2>
                {course.paymentInstructions && (
                  <p className="text-sm text-slate-300 whitespace-pre-line p-4 rounded-2xl bg-slate-950 border border-slate-800">{course.paymentInstructions}</p>
                )}
                {paymentLink && (
                  <a href={paymentLink} target="_blank" rel="noopener noreferrer" className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2" style={{ backgroundColor: accent }}>
                    Pagar en línea <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                {!course.paymentInstructions && !paymentLink && (
                  <p className="text-sm text-slate-400">Envía tu solicitud y la academia te contactará por correo con los datos de pago.</p>
                )}
              </div>

              {/* 3. Solicitud con comprobante */}
              <form action={submitEnrollmentRequestAction.bind(null, course.id)} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5" style={{ color: accent }} /> 2. {request?.status === "PENDING" ? "Actualiza tu solicitud" : "Envía tu solicitud"}
                </h2>
                <div>
                  <label className={label}>Comprobante de pago (opcional)</label>
                  <input type="file" name="proof" accept="image/png,image/jpeg,image/webp,application/pdf" className="w-full text-sm text-slate-300 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-slate-800 file:text-white" />
                  <p className="mt-1 text-[11px] text-slate-500">Foto o PDF de la transferencia o del recibo, máximo 5 MB.</p>
                </div>
                <div>
                  <label className={label}>Mensaje para la academia (opcional)</label>
                  <textarea name="message" rows={3} maxLength={1000} placeholder="Ej. Pagué por transferencia, número de operación 12345." className={input} />
                </div>
                <button type="submit" className="w-full py-3.5 rounded-xl text-white font-bold text-sm" style={{ backgroundColor: accent }}>
                  {request ? "Enviar de nuevo" : "Solicitar inscripción"}
                </button>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3 h-3" /> Solo la academia puede ver tu comprobante.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </BrandScope>
  );
}

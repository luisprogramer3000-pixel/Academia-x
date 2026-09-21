import Link from "next/link";
import { prisma } from "@/lib/db";
import { getDashboardContext } from "@/lib/session";
import { CourseService } from "@/modules/course/course.service";
import { selfEnrollAction, claimCertificateFormAction } from "@/app/actions/campus.actions";
import { logoutAction } from "@/app/actions/auth.actions";
import { BookOpen, Award, LogOut, PlayCircle, LayoutDashboard } from "lucide-react";

interface CampusPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function CampusPage({ searchParams }: CampusPageProps) {
  const { error } = await searchParams;
  const ctx = await getDashboardContext(["OWNER", "TEACHER", "STUDENT"]);
  const { tenant, userId, tenantId, role } = ctx;

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
    include: {
      enrollments: {
        include: { course: { select: { id: true, title: true, level: true, description: true, status: true } } },
        orderBy: { enrolledAt: "desc" },
      },
    },
  });

  const enrolled = (membership?.enrollments || []).filter((e) => e.course.status === "PUBLISHED");
  const enrolledIds = new Set(enrolled.map((e) => e.courseId));

  const [progressList, certificates, availableCourses] = await Promise.all([
    Promise.all(enrolled.map((e) => CourseService.getUserCourseProgress(userId, e.courseId))),
    prisma.certificate.findMany({ where: { tenantId, userId }, select: { courseId: true, code: true } }),
    prisma.course.findMany({
      where: { tenantId, status: "PUBLISHED" },
      select: { id: true, title: true, level: true, priceAmount: true, currency: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const certByCourse = new Map(certificates.map((c) => [c.courseId, c.code]));
  const notEnrolled = availableCourses.filter((c) => !enrolledIds.has(c.id));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            {tenant.name[0]?.toUpperCase()}
          </div>
          <div>
            <span className="block text-sm font-bold text-white">{tenant.name}</span>
            <span className="block text-[11px] text-slate-400">Campus del alumno</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {role !== "STUDENT" && (
            <Link href="/dashboard" className="text-xs text-slate-300 hover:text-white flex items-center gap-1">
              <LayoutDashboard className="w-4 h-4" /> Panel
            </Link>
          )}
          <span className="text-xs text-slate-400 hidden sm:block">{ctx.user.email}</span>
          <form action={logoutAction}>
            <button type="submit" title="Cerrar sesión" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-10">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}

        <section>
          <h1 className="text-2xl font-extrabold text-white mb-1">Hola, {ctx.user.name || "alumno"} 👋</h1>
          <p className="text-sm text-slate-400 mb-6">Continúa donde lo dejaste.</p>

          {enrolled.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400 text-sm">
              Aún no estás inscrito en ningún curso.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {enrolled.map((e, i) => {
                const progress = progressList[i];
                const certCode = certByCourse.get(e.courseId);
                return (
                  <div key={e.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                    <div>
                      <span className="text-[11px] font-mono text-slate-400">Nivel {e.course.level}</span>
                      <h2 className="font-bold text-white">{e.course.title}</h2>
                    </div>
                    <div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full" style={{ width: `${progress.percentage}%`, backgroundColor: tenant.primaryColor }} />
                      </div>
                      <span className="text-xs text-slate-400">{progress.percentage}% completado</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/campus/courses/${e.courseId}`}
                        className="px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1"
                        style={{ backgroundColor: tenant.primaryColor }}
                      >
                        <PlayCircle className="w-4 h-4" /> {progress.percentage > 0 ? "Continuar" : "Empezar"}
                      </Link>
                      {certCode ? (
                        <Link href={`/verify/${certCode}`} className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <Award className="w-4 h-4" /> Ver certificado
                        </Link>
                      ) : progress.percentage === 100 && progress.totalLessons > 0 ? (
                        <form action={claimCertificateFormAction.bind(null, e.courseId)}>
                          <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500/15 text-amber-400 text-xs font-bold flex items-center gap-1">
                            <Award className="w-4 h-4" /> Obtener certificado
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {notEnrolled.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Otros cursos de {tenant.name}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {notEnrolled.map((c) => {
                const isFree = Number(c.priceAmount) === 0;
                return (
                  <div key={c.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-white text-sm">{c.title}</h3>
                      <span className="text-xs text-slate-400">
                        Nivel {c.level} · {isFree ? "Gratis" : `${Number(c.priceAmount)} ${c.currency}`}
                      </span>
                    </div>
                    {isFree ? (
                      <form action={selfEnrollAction.bind(null, c.id)}>
                        <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold">
                          Inscribirme
                        </button>
                      </form>
                    ) : (
                      <span className="text-[11px] text-slate-500 text-right">Solicita tu inscripción a la academia</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

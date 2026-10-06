import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { UserService } from "@/modules/user/user.service";
import { CourseService } from "@/modules/course/course.service";
import { inviteUserAction, enrollStudentAction, unenrollStudentAction, revokeInvitationAction } from "@/app/actions/user.actions";
import { Users, UserPlus, Mail, Trash2, Clock, Link as LinkIcon, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { formatInTimezone } from "@/lib/timezone";

export default async function StudentsPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  const students = academy ? await UserService.getStudentsByTenant(tenantId) : [];
  const pendingInvitations = academy ? await UserService.getPendingInvitations(tenantId) : [];
  const studentInvitations = pendingInvitations.filter((inv) => inv.role === "STUDENT");
  const courses = academy ? await CourseService.getCourseOptions(tenantId) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
                <Users className="w-7 h-7 text-blue-400" /> Gestión de Estudiantes
              </h1>
              <p className="text-slate-400 text-sm">
                Envía invitaciones, inscribe alumnos a cursos y monitorea su avance.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href={`/a/${tenantSlug}/join`}
                target="_blank"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" /> Link de Registro Público
              </Link>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* List of Students */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  Estudiantes Registrados <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">{students.length}</span>
                </h2>

                {students.length > 0 ? (
                  <div className="space-y-4">
                    {students.map((student) => (
                      <div key={student.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-lg">
                            {student.user.name ? student.user.name[0].toUpperCase() : "E"}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-base">{student.user.name || "Estudiante Nuevo"}</h3>
                            <span className="text-xs text-slate-400 font-mono block">{student.user.email}</span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {student.enrollments.map((enr) => (
                                <span key={enr.id} className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-medium flex items-center gap-1.5">
                                  {enr.course.title}
                                  <form action={unenrollStudentAction} className="inline">
                                    <input type="hidden" name="membershipId" value={student.id} />
                                    <input type="hidden" name="courseId" value={enr.courseId} />
                                    <button type="submit" className="hover:text-red-400 transition-colors" title="Desinscribir de este curso">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </form>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Form para inscribir a curso */}
                        {courses.length > 0 && (
                          <form action={enrollStudentAction} className="flex items-center gap-2 w-full sm:w-auto">
                            <input type="hidden" name="membershipId" value={student.id} />
                            <select
                              name="courseId"
                              required
                              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                            >
                              <option value="">+ Inscribir a curso...</option>
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                              ))}
                            </select>
                            <button
                              type="submit"
                              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                            >
                              Asignar
                            </button>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                    No hay estudiantes registrados. Envía una invitación para comenzar.
                  </div>
                )}
              </div>

              {/* Pending Invitations Section */}
              {studentInvitations.length > 0 && (
                <div className="pt-4">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" /> Invitaciones Pendientes <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">{studentInvitations.length}</span>
                  </h2>

                  <div className="space-y-3">
                    {studentInvitations.map((inv) => (
                      <div key={inv.id} className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/20 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-white block">{inv.email}</span>
                            <span className="text-xs text-slate-400 font-mono">
                              Expira: {formatInTimezone(inv.expiresAt, academy.timezone, { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Link
                            href={`/invite/${inv.token}`}
                            target="_blank"
                            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-blue-500 text-xs text-blue-400 flex items-center gap-1.5 transition-all"
                          >
                            <LinkIcon className="w-3 h-3" /> Ver Enlace
                          </Link>

                          <form action={revokeInvitationAction}>
                            <input type="hidden" name="id" value={inv.id} />
                            <button
                              type="submit"
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 transition-colors"
                              title="Revocar invitación"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Form: Invitar Estudiante */}
            <div>
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-blue-400" /> Invitar Nuevo Alumno
                </h3>

                <form action={inviteUserAction} className="space-y-4">
                  <input type="hidden" name="role" value="STUDENT" />

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email del Alumno</label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="alumno@ejemplo.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" /> Generar Enlace de Invitación
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

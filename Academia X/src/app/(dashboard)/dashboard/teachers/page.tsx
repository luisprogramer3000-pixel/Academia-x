import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { UserService } from "@/modules/user/user.service";
import { inviteUserAction, revokeInvitationAction } from "@/app/actions/user.actions";
import { GraduationCap, UserPlus, Mail, ShieldCheck, Clock, Link as LinkIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatInTimezone } from "@/lib/timezone";

export default async function TeachersPage() {
  const ctx = await getDashboardContext(OWNER_ONLY);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  const teachers = academy ? await UserService.getTeachersByTenant(tenantId) : [];
  const pendingInvitations = academy ? await UserService.getPendingInvitations(tenantId) : [];
  const teacherInvitations = pendingInvitations.filter((inv) => inv.role === "TEACHER" || inv.role === "OWNER");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-5xl">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
                <GraduationCap className="w-7 h-7 text-purple-400" /> Equipo de Profesores
              </h1>
              <p className="text-slate-400 text-sm">
                Administra los docentes con acceso de edición a tu escuela de idiomas.
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* List of Teachers */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  Profesores Activos <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">{teachers.length}</span>
                </h2>

                {teachers.length > 0 ? (
                  <div className="space-y-4">
                    {teachers.map((teacher) => (
                      <div key={teacher.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-lg">
                            {teacher.user.name ? teacher.user.name[0].toUpperCase() : "P"}
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-base">{teacher.user.name || "Profesor Docente"}</h3>
                            <span className="text-xs text-slate-400 font-mono block">{teacher.user.email}</span>
                          </div>
                        </div>

                        <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold uppercase font-mono">
                          {teacher.role === "OWNER" ? "Propietario / Admin" : "Profesor Docente"}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                    No hay otros profesores en el equipo. Invita a tu primer colega.
                  </div>
                )}
              </div>

              {/* Pending Teacher Invitations Section */}
              {teacherInvitations.length > 0 && (
                <div className="pt-4">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-400" /> Invitaciones Docentes Pendientes <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">{teacherInvitations.length}</span>
                  </h2>

                  <div className="space-y-3">
                    {teacherInvitations.map((inv) => (
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
                            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-purple-500 text-xs text-purple-400 flex items-center gap-1.5 transition-all"
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

            {/* Form: Invitar Profesor */}
            <div>
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-400" /> Invitar Profesor
                </h3>

                <form action={inviteUserAction} className="space-y-4">
                  <input type="hidden" name="role" value="TEACHER" />

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email del Profesor</label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="colega@ejemplo.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" /> Enviar Invitación Docente
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

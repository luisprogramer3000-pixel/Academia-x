import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { TrashService, TRASH_DAYS, purgeDate } from "@/modules/course/trash.service";
import { Trash2, Layers, FileText, FolderOpen } from "lucide-react";
import { TrashItemActions } from "./TrashItemActions";
import { formatInTimezone } from "@/lib/timezone";

export const metadata = { title: "Papelera" };

function daysLeft(deletedAt: Date) {
  return Math.max(0, Math.ceil((purgeDate(deletedAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

function Expiry({ deletedAt, tz }: { deletedAt: Date; tz: string }) {
  const left = daysLeft(deletedAt);
  return (
    <span className={`text-xs ${left <= 5 ? "text-amber-400" : "text-slate-500"}`}>
      Borrado el {formatInTimezone(deletedAt, tz, { day: "numeric", month: "short" })} · se elimina en {left} día{left === 1 ? "" : "s"}
    </span>
  );
}

export default async function TrashPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  // Lo que ya cumplió los 30 días se elimina al abrir la papelera (además de la tarea programada)
  await TrashService.purgeExpired(ctx.tenantId);
  const { courses, resources } = await TrashService.listTrash(ctx.tenantId);
  const empty = courses.length === 0 && resources.length === 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={ctx.tenant.slug} academyName={ctx.tenant.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={ctx.tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-5xl w-full">
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
            <Trash2 className="w-7 h-7 text-slate-400" /> Papelera
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            Los cursos, lecciones y recursos que borres se quedan aquí {TRASH_DAYS} días con todo su contenido, alumnos y resultados.
            Puedes restaurarlos tal como estaban; pasado ese tiempo se eliminan para siempre.
          </p>

          {empty ? (
            <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center">
              <Trash2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-white font-semibold">La papelera está vacía</p>
            </div>
          ) : (
            <div className="space-y-10">
              {courses.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Cursos y lecciones ({courses.length})</h2>
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
                    {courses.map((c) => {
                      const lessons = c.modules.reduce((acc, m) => acc + m._count.lessons, 0);
                      const isLesson = c.contentType === "STANDALONE_LESSON";
                      return (
                        <div key={c.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {isLesson ? <FileText className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" /> : <Layers className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}
                            <div className="min-w-0">
                              <p className="font-semibold text-white truncate">{c.title}</p>
                              <p className="text-xs text-slate-400">
                                {isLesson ? "Lección" : `Curso · ${lessons} lecciones`}
                                {c._count.enrollments > 0 && ` · ${c._count.enrollments} alumnos inscritos`}
                              </p>
                              <Expiry deletedAt={c.deletedAt!} tz={ctx.tenant.timezone} />
                            </div>
                          </div>
                          <TrashItemActions kind="course" id={c.id} title={c.title} />
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {resources.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Recursos ({resources.length})</h2>
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
                    {resources.map((r) => (
                      <div key={r.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <FolderOpen className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate">{r.title}</p>
                            <p className="text-xs text-slate-400">
                              {r.kind === "CLASS_PLAN" ? "Plan de clase" : "Material"}
                              {r.subject && ` · ${r.subject}`}
                            </p>
                            <Expiry deletedAt={r.deletedAt!} tz={ctx.tenant.timezone} />
                          </div>
                        </div>
                        <TrashItemActions kind="resource" id={r.id} title={r.title} />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

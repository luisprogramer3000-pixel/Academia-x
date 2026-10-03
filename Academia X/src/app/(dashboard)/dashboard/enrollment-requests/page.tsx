import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { EnrollmentRequestService } from "@/modules/course/enrollment-request.service";
import { Inbox, FileText, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { RequestActions } from "./RequestActions";

export const metadata = { title: "Solicitudes de inscripción" };

const fmt = (d: Date) => d.toLocaleDateString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function EnrollmentRequestsPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const requests = await EnrollmentRequestService.listForTenant(ctx.tenantId);
  const pending = requests.filter((r) => r.status === "PENDING");
  const reviewed = requests.filter((r) => r.status !== "PENDING").slice(0, 30);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={ctx.tenant.slug} academyName={ctx.tenant.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={ctx.tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-5xl w-full">
          <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
            <Inbox className="w-7 h-7 text-blue-400" /> Solicitudes de inscripción
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            Alumnos que quieren entrar en un curso de pago. Comprueba el pago y apruébalos: recibirán un correo con el acceso al curso.
          </p>

          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Pendientes ({pending.length})</h2>
          {pending.length === 0 ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400 mb-10">
              No hay solicitudes pendientes.
            </div>
          ) : (
            <div className="space-y-3 mb-10">
              {pending.map((r) => {
                const student = r.membership.user;
                return (
                  <div key={r.id} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <p className="font-bold text-white">{student.name || student.email}</p>
                      <p className="text-xs text-slate-400">{student.email}</p>
                      <p className="text-sm text-slate-300">
                        {r.course.title} · <span className="font-semibold">{Number(r.course.priceAmount)} {r.course.currency}</span>
                      </p>
                      {r.message && (
                        <p className="text-sm text-slate-300 flex gap-2">
                          <MessageSquare className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" /> {r.message}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs">
                        {r.proofUrl ? (
                          <a href={r.proofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-semibold">
                            <FileText className="w-4 h-4" /> Ver comprobante
                          </a>
                        ) : (
                          <span className="text-amber-400">Sin comprobante</span>
                        )}
                        <span className="text-slate-500">{fmt(r.updatedAt)}</span>
                      </div>
                    </div>
                    <RequestActions requestId={r.id} studentName={student.name || student.email} />
                  </div>
                );
              })}
            </div>
          )}

          {reviewed.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Revisadas recientemente</h2>
              <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
                {reviewed.map((r) => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <span className="text-white font-medium">{r.membership.user.name || r.membership.user.email}</span>
                      <span className="text-slate-400"> · {r.course.title}</span>
                      {r.status === "REJECTED" && r.reviewNote && <p className="text-xs text-slate-500 truncate">Motivo: {r.reviewNote}</p>}
                    </div>
                    {r.status === "APPROVED" ? (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 shrink-0"><CheckCircle2 className="w-4 h-4" /> Aprobada</span>
                    ) : (
                      <span className="text-xs font-semibold text-red-400 flex items-center gap-1 shrink-0"><XCircle className="w-4 h-4" /> Rechazada</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

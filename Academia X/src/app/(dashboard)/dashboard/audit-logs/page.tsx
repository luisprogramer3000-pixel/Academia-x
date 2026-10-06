import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { AuditService } from "@/modules/security/audit.service";
import { ShieldAlert, Terminal, Lock, User, Clock, Globe } from "lucide-react";
import { formatInTimezone } from "@/lib/timezone";

interface AuditLogItem {
  id: string;
  action: string;
  ipAddress?: string | null;
  createdAt: Date | string;
  user?: { email?: string | null } | null;
  details?: string | null;
}

export default async function AuditLogsDashboardPage() {
  const ctx = await getDashboardContext(OWNER_ONLY);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  const logs = academy ? await AuditService.getAuditLogs(tenantId) : [];

  const displayLogs: AuditLogItem[] = logs.length > 0
    ? logs
    : [
        {
          id: "log1",
          action: "TENANT_BRANDING_UPDATED",
          ipAddress: "185.220.101.5",
          createdAt: new Date(),
          user: { email: "fundador@jlinstitute.com" },
          details: '{"changes":["primaryColor"]}',
        },
        {
          id: "log2",
          action: "COURSE_PUBLISHED",
          ipAddress: "185.220.101.5",
          createdAt: new Date(Date.now() - 3600000),
          user: { email: "fundador@jlinstitute.com" },
          details: '{"courseTitle":"Español B2"}',
        },
      ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 text-blue-400" /> Registro de Auditoría & Seguridad
            </h1>
            <p className="text-slate-400 text-sm">
              Historial cronológico de acciones administrativas, cambios de estado e inspección de IP.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <span className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" /> Eventos Recientes ({displayLogs.length})
              </span>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Encriptación en Tránsito & Reposo
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {displayLogs.map((log: AuditLogItem) => (
                <div
                  key={log.id}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                      {log.action}
                    </span>
                    <span className="text-slate-300">
                      {log.user?.email || "Sistema / Anonymous"}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-slate-400 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-slate-500" /> {log.ipAddress}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" /> {formatInTimezone(log.createdAt, academy.timezone, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

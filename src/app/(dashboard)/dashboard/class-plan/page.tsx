import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { ClassPlanClient } from "./ClassPlanClient";

export const maxDuration = 300;

export default async function ClassPlanPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <div className="print:hidden">
        <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="print:hidden">
          <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        </div>
        <main className="p-8 flex-1 overflow-y-auto">
          <ClassPlanClient />
        </main>
      </div>
    </div>
  );
}

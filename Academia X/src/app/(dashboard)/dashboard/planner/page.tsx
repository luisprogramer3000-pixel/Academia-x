import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { prisma } from "@/lib/db";
import { PlannerClient, type PlannerEvent } from "./PlannerClient";
import { CalendarDays } from "lucide-react";

const eventSelect = {
  id: true, title: true, startsAt: true, durationMinutes: true, groupName: true, notes: true, resourceId: true,
  resource: { select: { title: true } },
} as const;

type Row = { id: string; title: string; startsAt: Date; durationMinutes: number; groupName: string | null; notes: string | null; resourceId: string | null; resource: { title: string } | null };

const toEvent = (e: Row): PlannerEvent => ({
  id: e.id,
  title: e.title,
  startsAt: e.startsAt.toISOString(),
  durationMinutes: e.durationMinutes,
  groupName: e.groupName,
  notes: e.notes,
  resourceId: e.resourceId,
  resourceTitle: e.resource?.title ?? null,
});

export default async function PlannerPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;

  const now = new Date();
  const match = m?.match(/^(\d{4})-(\d{2})$/);
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Math.min(11, Math.max(0, Number(match[2]) - 1)) : now.getUTCMonth();

  // Margen de una semana a cada lado: la cuadrícula muestra días de meses vecinos
  // y la zona horaria del navegador puede desplazar eventos de un día a otro.
  const from = new Date(Date.UTC(year, month, 1) - 8 * 86400000);
  const to = new Date(Date.UTC(year, month + 1, 1) + 8 * 86400000);

  const [events, upcoming, resources] = await Promise.all([
    prisma.scheduledClass.findMany({ where: { tenantId, startsAt: { gte: from, lt: to } }, orderBy: { startsAt: "asc" }, select: eventSelect }),
    prisma.scheduledClass.findMany({ where: { tenantId, startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 8, select: eventSelect }),
    prisma.teachingResource.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, title: true } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        <main className="p-8 flex-1 overflow-y-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
              <CalendarDays className="w-7 h-7 text-blue-400" /> Planificador
            </h1>
            <p className="text-slate-400 text-sm mt-1">Programa tus clases por día y vincúlalas a tus planes de clase.</p>
          </div>
          <PlannerClient
            year={year}
            month={month}
            events={events.map(toEvent)}
            upcoming={upcoming.map(toEvent)}
            resources={resources}
          />
        </main>
      </div>
    </div>
  );
}

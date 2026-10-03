import { notFound } from "next/navigation";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { LiveService } from "@/modules/live/live.service";
import { LiveHostClient } from "./LiveHostClient";

export default async function LiveHostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId } = await getDashboardContext(STAFF_ROLES);
  const state = await LiveService.hostState(id, tenantId);
  if (!state) notFound();
  return <LiveHostClient initial={state} />;
}

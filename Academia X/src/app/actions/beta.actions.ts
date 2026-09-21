"use server";

import { BetaLaunchService } from "@/modules/academy/beta-launch.service";
import { revalidatePath } from "next/cache";
import { requireTenantAccess, AuthError } from "@/lib/session";

export async function seedJLGlobalAction(): Promise<void> {
  const { isSuperAdmin } = await requireTenantAccess();
  if (!isSuperAdmin) throw new AuthError("FORBIDDEN");

  await BetaLaunchService.seedJLGlobalInstitute();
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/beta-analytics");
}

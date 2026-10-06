"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireTenantAccess, STAFF_ROLES } from "@/lib/session";
import { TrashService } from "@/modules/course/trash.service";

/** Papelera: restaurar o eliminar definitivamente cursos, lecciones sueltas y recursos. */

const inputSchema = z.object({
  kind: z.enum(["course", "resource"]),
  id: z.string().min(1),
});

function refresh() {
  revalidatePath("/dashboard/papelera");
  revalidatePath("/dashboard/courses");
  revalidatePath("/dashboard/lessons");
  revalidatePath("/dashboard/resources");
  revalidatePath("/a", "layout");
}

export async function restoreFromTrashAction(input: { kind: "course" | "resource"; id: string }) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const { kind, id } = inputSchema.parse(input);
    if (kind === "course") await TrashService.restoreCourse(tenantId, id);
    else await TrashService.restoreResource(tenantId, id);
    refresh();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "No se pudo restaurar." };
  }
}

export async function deleteForeverAction(input: { kind: "course" | "resource"; id: string }) {
  try {
    const { tenantId } = await requireTenantAccess(STAFF_ROLES);
    const { kind, id } = inputSchema.parse(input);
    if (kind === "course") await TrashService.deleteCourseForever(tenantId, id);
    else await TrashService.deleteResourceForever(tenantId, id);
    refresh();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "No se pudo eliminar." };
  }
}

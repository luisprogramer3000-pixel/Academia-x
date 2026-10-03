"use server";

import { z } from "zod";
import { AcademyService } from "@/modules/academy/academy.service";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { setSession, requireTenantAccess, OWNER_ONLY, AuthError } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { sendEmail, EmailTemplates } from "@/lib/email";
import { getAppUrl } from "@/lib/stripe";
import { DEFAULT_BRAND_BACKGROUND } from "@/lib/brand-theme";
import { assertPlanCapability, requireActiveSubscription, PlanLimitError } from "@/modules/billing/entitlements";

const hexColor = z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Color hexadecimal no válido");

const createAcademySchema = z.object({
  name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(80),
  slug: z.string().optional(),
  language: z.string().default("es"),
  userEmail: z.string().trim().toLowerCase().email("Email no válido"),
  userName: z.string().trim().max(80).optional(),
  password: z.string().min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`).max(128),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
});

const updateBrandingSchema = z.object({
  name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(80).optional(),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  logoUrl: z.string().url("URL no válida").or(z.literal("")).optional(),
});

export async function createAcademyAction(formData: FormData) {
  try {
    const validated = createAcademySchema.parse({
      name: formData.get("name") as string,
      slug: (formData.get("slug") as string) || undefined,
      language: (formData.get("language") as string) || "es",
      userEmail: formData.get("userEmail") as string,
      userName: (formData.get("userName") as string) || undefined,
      password: (formData.get("password") as string) || "",
      primaryColor: (formData.get("primaryColor") as string) || "#3B82F6",
      secondaryColor: (formData.get("secondaryColor") as string) || DEFAULT_BRAND_BACKGROUND,
    });

    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimit = await checkRateLimit({ key: `create_academy:${ip}`, limit: 5, windowMs: 60 * 60_000 });
    if (!rateLimit.success) {
      return { success: false, error: "Demasiados registros desde esta conexión. Intenta más tarde." };
    }

    const { password, ...academyInput } = validated;
    const result = await AcademyService.createAcademy({
      ...academyInput,
      passwordHash: await hashPassword(password),
    });

    await setSession({
      userId: result.user.id,
      email: result.user.email,
      name: result.user.name,
      globalRole: result.user.globalRole,
      tenantId: result.tenant.id,
      tenantSlug: result.tenant.slug,
      academyRole: "OWNER",
    });

    // Email de bienvenida (no bloquea el alta si falla)
    await sendEmail({
      to: result.user.email,
      ...EmailTemplates.welcomeOwner({
        name: result.user.name || "",
        academyName: result.tenant.name,
        dashboardUrl: `${getAppUrl()}/dashboard/billing`,
      }),
    }).catch(() => undefined);

    return { success: true, data: { tenant: { id: result.tenant.id, slug: result.tenant.slug, name: result.tenant.name } } };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    return { success: false, error: error.message || "Error al crear la academia" };
  }
}

export async function updateBrandingAction(formData: FormData) {
  try {
    const { tenantId } = await requireTenantAccess(OWNER_ONLY);

    const validated = updateBrandingSchema.parse({
      name: (formData.get("name") as string) || undefined,
      primaryColor: (formData.get("primaryColor") as string) || undefined,
      secondaryColor: (formData.get("secondaryColor") as string) || undefined,
      logoUrl: (formData.get("logoUrl") as string) ?? undefined,
    });

    const current = await AcademyService.getAcademyById(tenantId);
    const changesBranding = Boolean(
      (validated.primaryColor && validated.primaryColor.toLowerCase() !== current?.primaryColor?.toLowerCase()) ||
        (validated.secondaryColor && validated.secondaryColor.toLowerCase() !== current?.secondaryColor?.toLowerCase()) ||
        (validated.logoUrl && validated.logoUrl !== (current?.logoUrl || ""))
    );
    if (changesBranding) {
      await assertPlanCapability(tenantId, "customBranding");
    } else {
      await requireActiveSubscription(tenantId);
    }

    const updated = await AcademyService.updateAcademyBranding({ tenantId, ...validated });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
    revalidatePath(`/a/${updated.slug}`, "layout");
    revalidatePath("/campus", "layout");

    return { success: true, data: updated };
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.errors[0].message };
    }
    if (error instanceof AuthError || error instanceof PlanLimitError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: error.message || "Error al actualizar la marca de la academia" };
  }
}

/**
 * Activa o desactiva el Tutor IA para los alumnos de la academia.
 *
 * Los alumnos no tienen cuota propia de créditos: cuando esto se activa, sus
 * consultas se descuentan de la bolsa del profesor. Por eso lo decide el
 * propietario y no un profesor cualquiera.
 */
export async function setStudentAIAccessAction(enabled: boolean) {
  try {
    const { tenantId } = await requireTenantAccess(OWNER_ONLY);
    await requireActiveSubscription(tenantId);

    await prisma.aICreditWallet.upsert({
      where: { tenantId },
      update: { allowTeacherCreditsForStudents: enabled },
      create: {
        tenantId,
        allowTeacherCreditsForStudents: enabled,
        resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    revalidatePath("/dashboard/settings");
    return { success: true, enabled };
  } catch (error: any) {
    return { success: false, error: error.message || "No se pudo actualizar el acceso de los alumnos a la IA." };
  }
}

const customDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(/^(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/, "Dominio no válido (ej. www.miacademia.com)")
  .or(z.literal(""));

/**
 * Configura el dominio personalizado de la academia (solo planes con customDomain).
 * El dominio debe apuntar (CNAME) a la plataforma y añadirse al proyecto en el hosting.
 */
export async function setCustomDomainAction(formData: FormData): Promise<void> {
  const { tenantId } = await requireTenantAccess(OWNER_ONLY);
  await assertPlanCapability(tenantId, "customDomain");

  const domain = customDomainSchema.parse((formData.get("customDomain") as string) || "");
  const appHost = (process.env.NEXT_PUBLIC_APP_HOST || "").toLowerCase();
  if (domain && appHost && (domain === appHost || domain.endsWith(`.${appHost}`))) {
    throw new Error("Usa un dominio propio, no un subdominio de la plataforma.");
  }

  await AcademyService.setCustomDomain(tenantId, domain || null);
  revalidatePath("/dashboard/settings");
}

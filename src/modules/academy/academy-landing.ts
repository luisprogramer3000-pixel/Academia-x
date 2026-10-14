import { z } from "zod";
import { prisma } from "@/lib/db";
import { LANDING_TEMPLATES } from "@/components/landing/course-landing/templates";

/**
 * Página pública de la academia (/a/[slug]): modelo de diseño (los mismos de
 * las landings de curso) y textos. Se guarda en Tenant.landing (JSON).
 *
 * Se lee y escribe con SQL directo: así funciona aunque el cliente de Prisma
 * en memoria aún no conozca la columna (servidor sin reiniciar tras migrar).
 */

const TEMPLATE_IDS = LANDING_TEMPLATES.map((t) => t.id) as [string, ...string[]];

export const AcademyLandingSchema = z.object({
  template: z.enum(TEMPLATE_IDS).default("marca"),
  headline: z.string().trim().max(120).default(""),
  subheadline: z.string().trim().max(300).default(""),
  callToAction: z.string().trim().max(40).default(""),
  /** Imagen de portada (modelo "Con imagen"): subida a la plataforma o https */
  heroImageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((u) => !u || u.startsWith("/api/uploads/") || /^https:\/\//i.test(u), "Imagen no válida.")
    .default(""),
});

export type AcademyLanding = z.infer<typeof AcademyLandingSchema>;

export const DEFAULT_ACADEMY_LANDING: AcademyLanding = { template: "marca", headline: "", subheadline: "", callToAction: "", heroImageUrl: "" };

export async function getAcademyLanding(tenantId: string): Promise<AcademyLanding> {
  try {
    const rows = await prisma.$queryRaw<Array<{ landing: unknown }>>`SELECT "landing" FROM "Tenant" WHERE "id" = ${tenantId}`;
    const parsed = AcademyLandingSchema.safeParse(rows[0]?.landing ?? {});
    return parsed.success ? parsed.data : DEFAULT_ACADEMY_LANDING;
  } catch {
    return DEFAULT_ACADEMY_LANDING;
  }
}

export async function saveAcademyLanding(tenantId: string, input: unknown): Promise<AcademyLanding> {
  const data = AcademyLandingSchema.parse(input);
  await prisma.$executeRaw`UPDATE "Tenant" SET "landing" = ${JSON.stringify(data)}::jsonb, "updatedAt" = NOW() WHERE "id" = ${tenantId}`;
  return data;
}

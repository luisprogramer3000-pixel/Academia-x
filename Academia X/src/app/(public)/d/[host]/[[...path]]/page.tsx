import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BillingService } from "@/modules/billing/billing.service";
import TenantPublicPage from "@/app/(public)/a/[slug]/page";
import PublicCourseViewerPage from "@/app/(public)/a/[slug]/courses/[courseSlug]/page";
import JoinAcademyPage from "@/app/(public)/a/[slug]/join/page";

interface CustomDomainPageProps {
  params: Promise<{ host: string; path?: string[] }>;
  searchParams: Promise<{ error?: string }>;
}

/**
 * Sitio público servido desde un dominio personalizado (solo planes con customDomain).
 * El middleware reescribe  midominio.com/ruta  ->  /d/midominio.com/ruta
 */
export default async function CustomDomainPage({ params, searchParams }: CustomDomainPageProps) {
  const { host, path = [] } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { customDomain: decodeURIComponent(host).toLowerCase() },
    select: { id: true, slug: true },
  });
  if (!tenant) notFound();

  const active = await BillingService.getActiveSubscription(tenant.id);
  if (!active?.plan.capabilities.customDomain) notFound();

  const slug = tenant.slug;

  if (path.length === 0) {
    return TenantPublicPage({ params: Promise.resolve({ slug }) });
  }
  if (path[0] === "join" && path.length === 1) {
    return JoinAcademyPage({ params: Promise.resolve({ slug }), searchParams });
  }
  if (path[0] === "courses" && path[1] && path.length === 2) {
    return PublicCourseViewerPage({ params: Promise.resolve({ slug, courseSlug: path[1] }) });
  }

  notFound();
}

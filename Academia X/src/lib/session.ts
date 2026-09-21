import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  TokenPayload,
} from "@/lib/auth";

export type AcademyRole = "OWNER" | "TEACHER" | "STUDENT";

export const STAFF_ROLES: AcademyRole[] = ["OWNER", "TEACHER"];
export const OWNER_ONLY: AcademyRole[] = ["OWNER"];

export class AuthError extends Error {
  constructor(public code: "UNAUTHORIZED" | "FORBIDDEN", message?: string) {
    super(message || (code === "UNAUTHORIZED" ? "Debes iniciar sesión para continuar." : "No tienes permisos para realizar esta acción."));
    this.name = "AuthError";
  }
}

export interface TenantContext {
  session: TokenPayload;
  userId: string;
  tenantId: string;
  role: AcademyRole;
  isSuperAdmin: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    language: string;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSession(payload: TokenPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Resuelve el contexto del tenant activo validando la membresía contra la base de datos.
 * Nunca confía en tenantId/rol enviados por el cliente: todo se deriva de la sesión.
 */
async function resolveTenantContext(allowedRoles?: AcademyRole[]): Promise<TenantContext> {
  const session = await getSession();
  if (!session?.userId || !session.tenantId) {
    throw new AuthError("UNAUTHORIZED");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.userId, tenantId: session.tenantId } },
    include: {
      tenant: {
        select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, secondaryColor: true, language: true },
      },
      user: { select: { id: true, email: true, name: true, globalRole: true } },
    },
  });

  if (!membership) {
    throw new AuthError("UNAUTHORIZED", "Tu sesión ya no es válida para esta academia.");
  }

  const isSuperAdmin = membership.user.globalRole === "SUPER_ADMIN";
  const role = membership.role as AcademyRole;

  if (allowedRoles && !allowedRoles.includes(role) && !isSuperAdmin) {
    throw new AuthError("FORBIDDEN");
  }

  return {
    session,
    userId: membership.userId,
    tenantId: membership.tenantId,
    role,
    isSuperAdmin,
    tenant: membership.tenant,
    user: { id: membership.user.id, email: membership.user.email, name: membership.user.name },
  };
}

/**
 * Para Server Actions: lanza AuthError si no hay sesión válida o el rol no está permitido.
 */
export async function requireTenantAccess(allowedRoles?: AcademyRole[]): Promise<TenantContext> {
  return resolveTenantContext(allowedRoles);
}

export interface DashboardContext extends TenantContext {
  activePlan: { id: string; name: string; status: string } | null;
}

/**
 * Para Server Components (páginas): redirige a /login o al dashboard según corresponda.
 * Por defecto exige una suscripción activa: el OWNER es enviado a Facturación y el resto
 * de miembros a /inactive. Usa { requirePlan: false } en páginas que deben verse sin plan.
 */
export async function getDashboardContext(
  allowedRoles: AcademyRole[] = STAFF_ROLES,
  options: { requirePlan?: boolean } = {}
): Promise<DashboardContext> {
  let ctx: TenantContext;
  try {
    ctx = await resolveTenantContext(allowedRoles);
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.code === "FORBIDDEN") redirect("/campus");
      redirect("/login");
    }
    throw error;
  }

  const { BillingService } = await import("@/modules/billing/billing.service");
  const active = await BillingService.getActiveSubscription(ctx.tenantId);
  const requirePlan = options.requirePlan ?? true;

  if (requirePlan && !active && !ctx.isSuperAdmin) {
    redirect(ctx.role === "OWNER" ? "/dashboard/billing?inactive=1" : "/inactive");
  }

  return {
    ...ctx,
    activePlan: active ? { id: active.planId, name: active.plan.name, status: active.status } : null,
  };
}

/**
 * Verificaciones de pertenencia de recursos hijos al tenant de la sesión.
 * Lanzan AuthError("FORBIDDEN") si el recurso no existe o pertenece a otro tenant.
 */
export async function assertCourseInTenant(courseId: string, tenantId: string) {
  const course = await prisma.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true, slug: true } });
  if (!course) throw new AuthError("FORBIDDEN", "Curso no encontrado en tu academia.");
  return course;
}

export async function assertModuleInTenant(moduleId: string, tenantId: string) {
  const mod = await prisma.module.findFirst({ where: { id: moduleId, course: { tenantId } }, select: { id: true, courseId: true } });
  if (!mod) throw new AuthError("FORBIDDEN", "Módulo no encontrado en tu academia.");
  return mod;
}

export async function assertLessonInTenant(lessonId: string, tenantId: string) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { tenantId } } },
    select: { id: true, module: { select: { courseId: true } } },
  });
  if (!lesson) throw new AuthError("FORBIDDEN", "Lección no encontrada en tu academia.");
  return lesson;
}

export async function assertMembershipInTenant(membershipId: string, tenantId: string) {
  const membership = await prisma.membership.findFirst({ where: { id: membershipId, tenantId }, select: { id: true, userId: true, role: true } });
  if (!membership) throw new AuthError("FORBIDDEN", "Miembro no encontrado en tu academia.");
  return membership;
}

export async function assertUserInTenant(userId: string, tenantId: string) {
  const membership = await prisma.membership.findUnique({ where: { userId_tenantId: { userId, tenantId } }, select: { id: true } });
  if (!membership) throw new AuthError("FORBIDDEN", "Usuario no pertenece a tu academia.");
  return membership;
}

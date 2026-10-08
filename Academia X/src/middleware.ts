import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/dashboard", "/campus", "/vista-previa"];
const PLATFORM_PREFIXES = [
  "/dashboard", "/campus", "/vista-previa", "/login", "/register", "/forgot-password", "/reset-password", "/create-academy", "/api",
  "/a", "/d", "/invite", "/verify", "/inactive", "/privacy", "/terms", "/_next", "/images", "/live",
];

/** Host oficial de la plataforma según NEXT_PUBLIC_APP_URL (p. ej. "www.mentorstudioglobal.com"). */
function canonicalHost(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "").hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

  // Una sola dirección pública: mentorstudioglobal.com → www.mentorstudioglobal.com.
  // Así la sesión (cookie de un solo dominio) no se parte entre las dos.
  // /api queda fuera: Payphone y los cron no siguen redirecciones.
  const requestHost = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const canonical = canonicalHost();
  if (
    process.env.NODE_ENV === "production" &&
    canonical?.startsWith("www.") &&
    requestHost === canonical.slice(4) &&
    !url.pathname.startsWith("/api/")
  ) {
    const target = new URL(`${url.pathname}${url.search}`, `https://${canonical}`);
    return NextResponse.redirect(target, request.method === "GET" || request.method === "HEAD" ? 301 : 308);
  }

  // Protección de rutas privadas: requiere un JWT de sesión válido
  if (PROTECTED_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", url.pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      if (token) redirectResponse.cookies.delete(SESSION_COOKIE_NAME);
      return redirectResponse;
    }
  }
  const rawHost = request.headers.get("host") || "";
  const hostname = rawHost.split(":")[0].toLowerCase();
  const mainHost = (process.env.NEXT_PUBLIC_APP_HOST || "localhost").toLowerCase();

  // Rutas de la plataforma que nunca se reescriben al sitio público de una academia
  const isPlatformPath = PLATFORM_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));

  const isMainHost =
    hostname === mainHost ||
    hostname === `www.${mainHost}` ||
    hostname === `app.${mainHost}` ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".vercel.app");

  if (!isMainHost && !isPlatformPath) {
    if (hostname.endsWith(`.${mainHost}`)) {
      // Subdominio: mi-academia.mentorstudioglobal.com/ruta -> /a/mi-academia/ruta
      const slug = hostname.slice(0, -(mainHost.length + 1));
      if (slug && !slug.includes(".")) {
        const rewriteUrl = url.clone();
        rewriteUrl.pathname = `/a/${slug}${url.pathname === "/" ? "" : url.pathname}`;
        return NextResponse.rewrite(rewriteUrl);
      }
    } else {
      // Dominio personalizado (plan ACADEMY): se resuelve en servidor contra Tenant.customDomain
      const rewriteUrl = url.clone();
      rewriteUrl.pathname = `/d/${hostname}${url.pathname === "/" ? "" : url.pathname}`;
      return NextResponse.rewrite(rewriteUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

const PROTECTED_PREFIXES = ["/dashboard", "/campus"];
const PLATFORM_PREFIXES = [
  "/dashboard", "/campus", "/login", "/register", "/forgot-password", "/reset-password", "/create-academy", "/api",
  "/a", "/d", "/invite", "/verify", "/inactive", "/privacy", "/terms", "/_next", "/images",
];

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;

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
      // Subdominio: mi-academia.academiax.com/ruta -> /a/mi-academia/ruta
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

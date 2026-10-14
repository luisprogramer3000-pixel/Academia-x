"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Sparkles,
  Settings,
  Globe,
  Award,
  CreditCard,
  Home,
  BarChart3,
  LifeBuoy,
  FileText,
  Layers,
  CalendarClock,
  CalendarDays,
  FolderOpen,
  Wand2,
  Inbox,
  Trash2,
  Library,
  Pencil,
  ShieldCheck,
  BadgeDollarSign,
  Cpu,
} from "lucide-react";
import { useIsPlatformAdmin } from "@/components/dashboard/AdminFlag";

interface SidebarProps {
  tenantSlug: string;
  academyName: string;
}

export function Sidebar({ tenantSlug, academyName }: SidebarProps) {
  const pathname = usePathname();
  const isPlatformAdmin = useIsPlatformAdmin();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Plan de clase IA", href: "/dashboard/class-plan", icon: CalendarClock },
    { label: "Herramientas IA", href: "/dashboard/ai-tools", icon: Wand2 },
    { label: "Mis recursos", href: "/dashboard/resources", icon: FolderOpen },
    { label: "Biblioteca de la plataforma", href: "/dashboard/biblioteca", icon: Library },
    { label: "Planificador", href: "/dashboard/planner", icon: CalendarDays },
    { label: "Cursos", href: "/dashboard/courses", icon: Layers },
    { label: "Lecciones", href: "/dashboard/lessons", icon: FileText },
    { label: "Estudiantes", href: "/dashboard/students", icon: Users },
    { label: "Solicitudes", href: "/dashboard/enrollment-requests", icon: Inbox },
    { label: "Profesores", href: "/dashboard/teachers", icon: GraduationCap },
    { label: "Copiloto IA", href: "/dashboard/ai-copilot", icon: Sparkles },
    { label: "Certificados", href: "/dashboard/certificates", icon: Award },
    { label: "Analíticas (Academy)", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "Facturación & Planes", href: "/dashboard/billing", icon: CreditCard },
    { label: "Configuración & Branding", href: "/dashboard/settings", icon: Settings },
    { label: "Papelera", href: "/dashboard/papelera", icon: Trash2 },
    { label: "Soporte VIP", href: "/dashboard/support", icon: LifeBuoy },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between min-h-screen">
      <div>
        {/* Header Tenant info */}
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
            {academyName.slice(0, 2).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold text-sm text-white truncate">{academyName}</h2>
            <span className="text-[11px] text-blue-400 font-mono truncate block">
              {process.env.NEXT_PUBLIC_APP_HOST || "mentorstudioglobal.com"}/a/{tenantSlug}
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            // "Nueva lección" vive bajo /courses/new/lesson pero pertenece a Lecciones
            const section = pathname.startsWith("/dashboard/courses/new/lesson") ? "/dashboard/lessons" : pathname;
            const isActive = section === item.href ||
              (item.href !== "/dashboard" && section.startsWith(item.href + "/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Administración de la plataforma (solo super admin) */}
          {isPlatformAdmin && (
            <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-1">
              <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Administración
              </p>
              {[
                { label: "Ventas y biblioteca", href: "/dashboard/admin/sales", icon: BadgeDollarSign },
                { label: "Créditos IA (global)", href: "/dashboard/admin/ai-credits", icon: Cpu },
              ].map(({ label, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    pathname.startsWith(href)
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Regresar a la página principal */}
          <div className="pt-3 mt-3 border-t border-slate-800/80">
            <Link
              href="/"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-slate-800/50 hover:border-blue-500/30 transition-all group"
            >
              <Home className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
              <span>Inicio Mentor Studio Global</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* Página pública: verla y editarla */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <Link
          href={`/a/${tenantSlug}`}
          target="_blank"
          className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:border-blue-500/40 transition-all"
        >
          <span className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" /> Ver Página Pública
          </span>
          <span>↗</span>
        </Link>
        <Link
          href="/dashboard/settings#pagina-publica"
          className="flex items-center justify-between p-3 rounded-xl bg-blue-600/10 border border-blue-500/30 text-xs font-semibold text-blue-200 hover:bg-blue-600/20 hover:text-white transition-all"
        >
          <span className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-blue-400" /> Editar página principal
          </span>
        </Link>
      </div>
    </aside>
  );
}

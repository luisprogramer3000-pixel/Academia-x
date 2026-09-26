"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
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
} from "lucide-react";

interface SidebarProps {
  tenantSlug: string;
  academyName: string;
}

export function Sidebar({ tenantSlug, academyName }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Cursos & Lecciones", href: "/dashboard/courses", icon: BookOpen },
    { label: "Estudiantes", href: "/dashboard/students", icon: Users },
    { label: "Profesores", href: "/dashboard/teachers", icon: GraduationCap },
    { label: "Copiloto IA", href: "/dashboard/ai-copilot", icon: Sparkles },
    { label: "Certificados", href: "/dashboard/certificates", icon: Award },
    { label: "Analíticas (Pro)", href: "/dashboard/analytics", icon: BarChart3 },
    { label: "Facturación & Planes", href: "/dashboard/billing", icon: CreditCard },
    { label: "Configuración & Branding", href: "/dashboard/settings", icon: Settings },
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
              {tenantSlug}.{process.env.NEXT_PUBLIC_APP_HOST || "mentorstudioglobal.com"}
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

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

      {/* Footer Public Page Link */}
      <div className="p-4 border-t border-slate-800">
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
      </div>
    </aside>
  );
}

import Link from "next/link";
import { Search } from "lucide-react";
import { NLogoBadge } from "@/components/landing/NLogoBadge";

/**
 * Header limpio compartido por las 3 propuestas de hero. No compite con el
 * hero: logo, 3 enlaces, buscador discreto y dos acciones.
 * `tone="light"` = texto claro sobre fotografía (opción 2).
 */
export function HeroHeader({ tone = "default" }: { tone?: "default" | "light" }) {
  const light = tone === "light";
  const link = light ? "text-white/85 hover:text-white" : "text-slate-600 hover:text-slate-900";
  return (
    <header className="relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <NLogoBadge size="sm" />
          <span className={`font-extrabold text-lg tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
            Mentor Studio <span className={light ? "text-amber-300" : "text-amber-600"}>Global</span>
          </span>
        </Link>

        <nav className={`hidden lg:flex items-center gap-7 text-sm font-medium ${link}`}>
          <a href="#cursos" className="transition-colors">Cursos</a>
          <a href="#profesores" className="transition-colors">Para profesores</a>
          <a href="#planes" className="transition-colors">Planes</a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <label
            className={`hidden md:flex items-center gap-2 h-10 px-3.5 rounded-full text-sm w-56 border ${
              light ? "bg-white/10 border-white/20 text-white/80" : "bg-slate-100 border-transparent text-slate-500"
            }`}
          >
            <Search className="w-4 h-4 shrink-0" />
            <input
              placeholder="Buscar cursos…"
              className={`bg-transparent outline-none w-full ${light ? "placeholder:text-white/70" : "placeholder:text-slate-400"}`}
            />
          </label>
          <Link href="/login" className={`hidden sm:block px-3 py-2 text-sm font-semibold ${link}`}>
            Iniciar sesión
          </Link>
          <Link
            href="/create-academy"
            className={`px-4 py-2.5 rounded-full text-sm font-bold transition-colors ${
              light ? "bg-white text-slate-900 hover:bg-amber-50" : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}

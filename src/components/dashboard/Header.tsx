import Link from "next/link";
import { Sparkles, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { logoutAction } from "@/app/actions/auth.actions";

interface HeaderProps {
  userEmail?: string;
  userName?: string | null;
  tenantId?: string;
  planLabel?: string | null;
}

export function Header({ userEmail, userName, tenantId, planLabel }: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {planLabel ? (
          <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Plan {planLabel}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        {tenantId ? <NotificationBell tenantId={tenantId} /> : null}

        <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
            {(userName || userEmail || "U")[0].toUpperCase()}
          </div>
          <Link href="/campus/cuenta" title="Mi cuenta" className="text-left hidden sm:block hover:opacity-80">
            <span className="block text-xs font-semibold text-white">{userName || "Mi cuenta"}</span>
            <span className="block text-[11px] text-slate-400 font-mono">{userEmail}</span>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Cerrar sesión"
              className="ml-2 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { logoutAction } from "@/app/actions/auth.actions";

export default function InactiveAcademyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md text-center p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h1 className="text-2xl font-bold text-white">Academia temporalmente inactiva</h1>
        <p className="text-sm text-slate-400">
          La suscripción de esta academia no está activa en este momento. Contacta al responsable de tu academia para
          más información.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/" className="px-4 py-2 rounded-xl bg-slate-800 text-sm text-white hover:bg-slate-700">
            Ir al inicio
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-sm text-white hover:bg-blue-500">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

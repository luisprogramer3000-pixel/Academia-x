import Link from "next/link";
import { ArrowLeft, ShieldCheck, LogOut, UserCircle2 } from "lucide-react";
import { getDashboardContext } from "@/lib/session";
import { logoutEverywhereAction } from "@/app/actions/account.actions";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const metadata = { title: "Mi cuenta" };

/** Datos de la cuenta y derechos sobre los datos personales (para alumnos, profesores y dueños). */
export default async function AccountPage() {
  const ctx = await getDashboardContext(["OWNER", "TEACHER", "STUDENT"], { requirePlan: false });
  const isOwner = ctx.role === "OWNER";
  const support = process.env.SUPPORT_EMAIL;
  const back = ctx.role === "STUDENT" ? "/campus" : "/dashboard";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href={back} className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>

        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <UserCircle2 className="w-8 h-8 text-blue-400" /> Mi cuenta
        </h1>

        <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <p className="text-sm text-white font-semibold">{ctx.user.name || "Sin nombre"}</p>
          <p className="text-sm text-slate-400">{ctx.user.email}</p>
          <p className="text-xs text-slate-500">Academia: {ctx.tenant.name}</p>
        </section>

        <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <LogOut className="w-4 h-4 text-blue-400" /> Sesiones
          </h2>
          <p className="text-xs text-slate-400">
            Si usaste tu cuenta en un equipo ajeno o crees que alguien más tiene acceso, cierra la sesión en todos los dispositivos.
            Tendrás que volver a iniciar sesión también aquí.
          </p>
          <form action={logoutEverywhereAction}>
            <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white">
              Cerrar sesión en todos los dispositivos
            </button>
          </form>
        </section>

        <section className="p-6 rounded-2xl bg-slate-900 border border-red-500/30 space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-red-400" /> Eliminar mi cuenta y mis datos
          </h2>
          {isOwner ? (
            <p className="text-xs text-slate-400">
              Eres dueño de <strong>{ctx.tenant.name}</strong>. Para eliminar tu cuenta hay que dar de baja la academia (sus cursos, alumnos y
              facturación). Escríbenos{support ? <> a <a className="text-blue-400 underline" href={`mailto:${support}`}>{support}</a></> : " a soporte"} desde
              este correo y lo haremos en un máximo de 15 días. También puedes pedirnos una copia de tus datos.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                Se borran tus inscripciones, progreso, entregas, resultados, certificados y notificaciones de todas las academias, y se anonimizan tu
                nombre y correo. Solo se conservan, sin datos personales, los registros contables que la ley obliga a guardar. Esta acción no se puede deshacer.
              </p>
              <DeleteAccountForm />
            </>
          )}
          <p className="text-[11px] text-slate-500">
            Más información en la <Link href="/privacy" className="underline">Política de Privacidad</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

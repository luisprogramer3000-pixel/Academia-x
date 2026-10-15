import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { getSession } from "@/lib/session";
import { confirmEmailToken } from "@/modules/user/email-verification";

export const metadata = { title: "Confirmar correo" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

/** Enlace del correo de confirmación. Funciona aunque se abra en otro navegador (sin sesión). */
export default async function ConfirmEmailTokenPage({ params }: Props) {
  const { token } = await params;
  const userId = await confirmEmailToken(token);
  const session = await getSession();
  const sameUser = Boolean(userId && session?.userId === userId);
  const next = session?.academyRole === "STUDENT" ? "/campus" : "/dashboard/billing?welcome=1";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-5">
        {userId ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">¡Correo confirmado!</h1>
            <p className="text-sm text-slate-400">Tu cuenta ya está activa.</p>
            <Link
              href={sameUser ? next : "/login"}
              className="inline-block w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm"
            >
              {sameUser ? "Continuar" : "Iniciar sesión"}
            </Link>
          </>
        ) : (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">El enlace no es válido</h1>
            <p className="text-sm text-slate-400">
              Puede que haya caducado (dura 48 horas) o que ya lo hayas usado. Inicia sesión para pedir uno nuevo.
            </p>
            <Link href={session ? "/confirmar-email" : "/login"} className="inline-block w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm">
              {session ? "Pedir un enlace nuevo" : "Iniciar sesión"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logoutAction } from "@/app/actions/auth.actions";
import { ResendVerificationButton } from "./ResendVerificationButton";

export const metadata = { title: "Confirma tu correo" };

/** Cuenta nueva sin confirmar: el panel y el campus redirigen aquí hasta que se confirme el correo. */
export default async function ConfirmEmailPendingPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, emailVerifiedAt: true } });
  if (!user) redirect("/login");
  if (user.emailVerifiedAt) redirect(session.academyRole === "STUDENT" ? "/campus" : "/dashboard");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
          <MailCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-white">Confirma tu correo</h1>
        <p className="text-sm text-slate-400">
          Te enviamos un enlace a <strong className="text-slate-200">{user.email}</strong>. Ábrelo para activar tu cuenta.
          Si no lo ves, revisa la carpeta de spam.
        </p>
        <ResendVerificationButton />
        <form action={logoutAction}>
          <button type="submit" className="text-xs text-slate-500 hover:text-slate-300 underline">
            ¿Te equivocaste de correo? Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

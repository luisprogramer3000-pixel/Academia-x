import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { getSession } from "@/lib/session";
import { confirmEmailToken } from "@/modules/user/email-verification";
import { getI18n } from "@/i18n/server";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t.auth.confirm.tokenPageTitle };
}
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
  const { t: d } = await getI18n();
  const t = d.auth.confirm;
  const next = session?.academyRole === "STUDENT" ? "/campus" : "/dashboard/billing?welcome=1";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-5">
        {userId ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">{t.confirmedTitle}</h1>
            <p className="text-sm text-slate-400">{t.confirmedBody}</p>
            <Link
              href={sameUser ? next : "/login"}
              className="inline-block w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm"
            >
              {sameUser ? t.continue : d.common.signIn}
            </Link>
          </>
        ) : (
          <>
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h1 className="text-2xl font-bold text-white">{t.invalidTitle}</h1>
            <p className="text-sm text-slate-400">
              {t.invalidBody}
            </p>
            <Link href={session ? "/confirmar-email" : "/login"} className="inline-block w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm">
              {session ? t.requestNew : d.common.signIn}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

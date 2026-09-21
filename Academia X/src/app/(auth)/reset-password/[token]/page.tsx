"use client";

import { use, useState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/app/actions/auth.actions";

interface ResetPasswordPageProps {
  params: Promise<{ token: string }>;
}

export default function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = use(params);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (formData.get("password") !== formData.get("confirm")) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    formData.set("token", token);
    const res = await resetPasswordAction(formData);
    setLoading(false);
    if (res.success) setDone(true);
    else setError(res.error || "No se pudo restablecer la contraseña.");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
        <h1 className="text-2xl font-bold text-white">Crea una nueva contraseña</h1>
        {done ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">
              Tu contraseña fue actualizada.
            </div>
            <Link href="/login" className="block text-center py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold">
              Iniciar sesión
            </Link>
          </div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
            <input type="password" name="password" required minLength={8} autoComplete="new-password" placeholder="Nueva contraseña (mín. 8)"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500" />
            <input type="password" name="confirm" required minLength={8} autoComplete="new-password" placeholder="Repite la contraseña"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500" />
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50">
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

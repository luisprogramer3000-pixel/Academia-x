"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/app/actions/auth.actions";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const res = await requestPasswordResetAction(formData);
    setMessage(res.message);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">¿Olvidaste tu contraseña?</h1>
          <p className="text-sm text-slate-400 mt-1">Te enviaremos un enlace para crear una nueva.</p>
        </div>
        {message ? (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm">{message}</div>
        ) : (
          <form action={handleSubmit} className="space-y-4">
            <input
              type="email"
              name="email"
              required
              placeholder="tu@email.com"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar enlace"}
            </button>
          </form>
        )}
        <Link href="/login" className="block text-center text-xs text-slate-400 hover:text-white">
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}

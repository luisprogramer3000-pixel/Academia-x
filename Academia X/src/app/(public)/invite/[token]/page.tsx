"use client";

import { useState } from "react";
import { acceptInvitationAction } from "@/app/actions/user.actions";
import { useRouter } from "next/navigation";
import { CheckCircle2, School, UserCheck } from "lucide-react";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

export default function ClaimInvitationPage({ params }: InvitePageProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { token } = await params;
    const body = new FormData();
    body.append("token", token);
    body.append("name", name);
    body.append("password", password);

    const res = await acceptInvitationAction(body);

    if (res.success && res.data) {
      setSuccess(true);
      setTimeout(() => {
        router.push(res.data.redirectTo);
        router.refresh();
      }, 1500);
    } else {
      setError(res.error || "No se pudo aceptar la invitación.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 selection:bg-blue-500 selection:text-white">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-4">
            <School className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Aceptar Invitación a la Academia</h1>
          <p className="text-sm text-slate-400">Ingresa tu nombre y crea una contraseña para unirte. Si ya tienes cuenta, usa tu contraseña actual.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {success ? (
          <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto" />
            <h3 className="font-bold text-base">¡Invitación Aceptada!</h3>
            <p className="text-xs text-slate-300">Redirigiendo a tu academia...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Tu Nombre Completo</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. María García"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Contraseña (mínimo 8 caracteres)</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
            >
              {loading ? "Procesando..." : "Confirmar Mi Registro"} <UserCheck className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

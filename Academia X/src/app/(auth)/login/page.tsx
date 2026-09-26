"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth.actions";
import { ArrowRight, ArrowLeft, LogIn, Mail, Lock } from "lucide-react";
import { NLogoBadge } from "@/components/landing/NLogoBadge";
import { ParallaxBackground } from "@/components/landing/ParallaxBackground";
import { ThemeToggle } from "@/components/landing/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    const res = await loginAction(formData);

    if (res.success) {
      router.push(res.redirectTo || "/dashboard");
      router.refresh();
    } else {
      setError(res.error || "Error al iniciar sesión");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 flex items-center justify-center p-6 selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden font-sans transition-colors duration-300">
      {/* 3D Multi-layer Interactive Parallax Background */}
      <ParallaxBackground />

      <div className="w-full max-w-md relative z-10">
        {/* Top bar theme toggle */}
        <div className="flex justify-end mb-4">
          <ThemeToggle />
        </div>

        {/* Header Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <NLogoBadge size="md" />
            <div className="text-left">
              <span className="font-extrabold text-2xl tracking-tight gold-gradient-text">
                Mentor Studio Global
              </span>
              <span className="block text-[10px] text-sky-700 dark:text-sky-400 font-mono tracking-widest uppercase font-semibold">
                Executive EdTech Suite
              </span>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="p-8 rounded-3xl glass-gold-card shadow-2xl border border-amber-500/40">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <LogIn className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              Iniciar Sesión
            </h1>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
              Accede a tu panel de control de academia o campus de alumno.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-sm font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="profesor@miacademia.com"
                  className="w-full pl-11 pr-4 py-3 glass-panel border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <Link href="/forgot-password" className="float-right -mt-6 text-xs text-amber-700 dark:text-amber-400 hover:underline font-semibold">
                ¿Olvidaste tu contraseña?
              </Link>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 glass-panel border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors text-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl gold-gradient-bg text-slate-950 font-bold transition-all shadow-lg shadow-amber-500/25 flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {loading ? (
                "Iniciando sesión..."
              ) : (
                <>
                  <span>Ingresar a mi Cuenta</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-700 dark:text-slate-400 font-medium">
            ¿No tienes una academia aún?{" "}
            <Link href="/create-academy" className="text-amber-700 dark:text-amber-400 hover:underline font-bold">
              Crea tu academia
            </Link>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a la página principal
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, ArrowLeft, School, UserPlus, BookOpen } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RegisterContent() {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const createAcademyHref = queryString ? `/create-academy?${queryString}` : "/create-academy";
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 selection:bg-blue-500 selection:text-white relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-xl relative z-10">
        {/* Header Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            {/* Provisional hasta que esté el logo definitivo de Mentor Studio Global */}
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-xl shadow-blue-500/25 group-hover:scale-105 transition-transform">
              MSG
            </div>
            <div className="text-left">
              <span className="font-bold text-2xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                Mentor Studio Global
              </span>
              <span className="block text-[10px] text-blue-400 font-mono tracking-widest uppercase">
                EdTech Platform
              </span>
            </div>
          </Link>
        </div>

        {/* Options Card */}
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-3">
              ¿Cómo deseas comenzar?
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Selecciona tu tipo de cuenta para continuar con la configuración en Mentor Studio Global.
            </p>
          </div>

          <div className="space-y-4">
            {/* Option 1: Create Academy */}
            <Link
              href={createAcademyHref}
              className="group block p-6 rounded-2xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 hover:from-blue-900/80 hover:to-indigo-900/80 border border-blue-500/30 hover:border-blue-400 transition-all shadow-xl"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <School className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-lg text-white group-hover:text-blue-300 transition-colors">
                      Soy Profesor / Fundador
                    </h2>
                    <ArrowRight className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Quiero crear y lanzar mi propia escuela de idiomas o centro de enseñanza con mi marca.
                  </p>
                </div>
              </div>
            </Link>

            {/* Option 2: Join Demo Academy */}
            <Link
              href="/a/jl-institute"
              className="group block p-6 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors">
                      Explorar Academia de Demo
                    </h2>
                    <ArrowRight className="w-5 h-5 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Ver un portal público de ejemplo (JL Institute) para conocer la experiencia de los alumnos.
                  </p>
                </div>
              </div>
            </Link>
          </div>

          <div className="mt-8 text-center text-xs text-slate-400">
            ¿Ya posees una cuenta?{" "}
            <Link href="/login" className="text-blue-400 hover:underline font-medium">
              Iniciar Sesión
            </Link>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a la página principal
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">Cargando...</div>}>
      <RegisterContent />
    </Suspense>
  );
}

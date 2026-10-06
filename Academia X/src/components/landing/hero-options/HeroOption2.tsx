import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, Video } from "lucide-react";
import { HeroHeader } from "./HeroHeader";

/**
 * OPCIÓN 2 — Immersive Education Hero.
 * Fotografía de aula a todo el ancho, degradado lateral (no un velo plano)
 * para que el texto alineado a la izquierda se lea siempre, y un panel
 * flotante con los 3 pilares que conecta con el catálogo de cursos debajo.
 */
export function HeroOption2() {
  const pillars = [
    { icon: BookOpen, title: "Cursos interactivos", text: "Lecciones, ejercicios y lecturas" },
    { icon: Video, title: "Clases en vivo", text: "Con profesores reales" },
    { icon: Award, title: "Certificaciones", text: "Verificables en línea" },
  ];
  return (
    <div className="bg-white min-h-screen">
      <section className="relative min-h-[640px] lg:min-h-[720px] flex flex-col">
        <Image src="/hero-options/immersive-classroom.jpg" alt="Clase moderna con estudiantes y profesor" fill priority sizes="100vw" className="object-cover object-[65%_center]" />
        {/* Degradado lateral: oscuro tras el texto, la foto respira a la derecha */}
        <div className="absolute inset-0 bg-slate-950/75 lg:bg-transparent lg:bg-gradient-to-r lg:from-slate-950/90 lg:via-slate-950/60 lg:to-slate-950/10" aria-hidden />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-950/50 to-transparent" aria-hidden />

        <HeroHeader tone="light" />

        <div className="relative z-10 flex-1 flex items-center">
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-10 pb-36">
            <div className="max-w-2xl text-white">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Plataforma educativa internacional</p>
              <h1 className="mt-5 text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.05]">
                Aprende nuevas habilidades. Abre nuevas oportunidades.
              </h1>
              <p className="mt-6 text-lg text-white/85 leading-relaxed max-w-xl">
                Cursos y experiencias educativas diseñadas para estudiantes, profesionales y profesores.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link href="/create-academy" className="px-7 py-4 rounded-xl bg-amber-400 text-slate-950 font-bold text-center inline-flex items-center justify-center gap-2 hover:bg-amber-300 transition-colors">
                  Comienza a aprender <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="#cursos" className="px-7 py-4 rounded-xl border border-white/40 text-white font-semibold text-center hover:bg-white/10 transition-colors">
                  Ver cursos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Panel flotante: medio dentro del hero, medio fuera */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 -mt-20">
        <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {pillars.map(({ icon: Icon, title, text }) => (
            <div key={title} className="p-6 flex items-center gap-4">
              <span className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Icon className="w-6 h-6" /></span>
              <div>
                <p className="font-bold text-slate-900">{title}</p>
                <p className="text-sm text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Continuación visual del catálogo (solo maqueta) */}
      <section id="cursos" className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <p className="text-lg font-bold text-slate-900 mb-5">Cursos más populares</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {["Español A1", "Inglés para negocios", "Francés conversacional", "Formación docente"].map((t, i) => (
            <div key={t} className="rounded-xl overflow-hidden ring-1 ring-slate-200">
              <div className={`h-24 ${["bg-amber-200", "bg-sky-200", "bg-rose-200", "bg-emerald-200"][i]}`} />
              <p className="p-3 text-sm font-semibold text-slate-800">{t}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

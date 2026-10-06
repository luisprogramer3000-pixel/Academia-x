import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, Languages, PlayCircle, Star } from "lucide-react";
import { HeroHeader } from "./HeroHeader";

/**
 * OPCIÓN 1 — Premium Education / Split Hero.
 * 50/50: mensaje a la izquierda; a la derecha una composición fotográfica
 * (no un rectángulo): foto con forma orgánica + 3 tarjetas flotantes que
 * cuentan la experiencia (clase en vivo, progreso, certificado).
 */
export function HeroOption1() {
  return (
    <div className="bg-[#FBF8F3] text-slate-900 min-h-screen">
      <HeroHeader />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20 lg:pt-14 lg:pb-28 grid lg:grid-cols-2 gap-14 lg:gap-10 items-center">
        {/* Texto */}
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Aprende. Enseña. Crece.
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Una nueva forma de aprender y enseñar <span className="text-amber-600">online</span>.
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            Cursos, profesores y recursos diseñados para que desarrolles nuevas habilidades —y nuevos idiomas— desde cualquier lugar.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Link href="#cursos" className="px-7 py-4 rounded-xl bg-slate-900 text-white font-bold text-center inline-flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
              Explorar cursos <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#plataforma" className="px-7 py-4 rounded-xl border border-slate-300 font-semibold text-center hover:border-slate-900 transition-colors">
              Conocer la plataforma
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {["bg-amber-300", "bg-sky-300", "bg-emerald-300", "bg-rose-300"].map((c, i) => (
                <span key={c} className={`w-9 h-9 rounded-full border-2 border-[#FBF8F3] ${c} flex items-center justify-center text-[11px] font-bold text-slate-800`}>
                  {["AM", "JL", "SR", "PC"][i]}
                </span>
              ))}
            </div>
            <div>
              <div className="flex text-amber-500">{Array.from({ length: 5 }, (_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}</div>
              <p className="text-sm text-slate-600">Estudiantes y profesores aprendiendo juntos.</p>
            </div>
          </div>
        </div>

        {/* Composición visual */}
        <div className="relative mx-auto w-full max-w-[540px] lg:max-w-none">
          <div className="absolute -inset-4 sm:-inset-6 rounded-[48px] bg-amber-200/50 rotate-3" aria-hidden />
          <div className="relative aspect-[4/4.3] rounded-[40px] rounded-tr-[120px] overflow-hidden shadow-xl">
            <Image src="/hero-options/split-student.jpg" alt="Estudiante en una clase de idiomas online" fill priority sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>

          {/* Clase en vivo */}
          <div className="absolute left-2 sm:-left-8 top-8 bg-white rounded-2xl shadow-lg p-3 pr-5 flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl overflow-hidden">
              <Image src="/hero-options/teacher-videocall.jpg" alt="" fill sizes="44px" className="object-cover" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-rose-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> EN VIVO</p>
              <p className="text-sm font-bold">Conversación B1</p>
            </div>
          </div>

          {/* Progreso */}
          <div className="absolute right-2 sm:-right-6 top-1/2 bg-white rounded-2xl shadow-lg p-4 w-48 hidden sm:block">
            <p className="text-xs text-slate-500 flex items-center gap-1.5"><Languages className="w-3.5 h-3.5" /> Español A2</p>
            <p className="text-sm font-bold mt-1">Lección 8 de 12</p>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full w-2/3 rounded-full bg-amber-500" /></div>
          </div>

          {/* Certificado */}
          <div className="absolute left-6 sm:left-10 -bottom-5 bg-slate-900 text-white rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3">
            <Award className="w-6 h-6 text-amber-400" />
            <div>
              <p className="text-sm font-bold">Certificado obtenido</p>
              <p className="text-[11px] text-white/70 flex items-center gap-1"><PlayCircle className="w-3 h-3" /> 24 videoclases completadas</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

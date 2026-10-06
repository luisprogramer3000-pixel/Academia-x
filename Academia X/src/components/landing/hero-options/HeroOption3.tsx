import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, CalendarClock, CheckCircle2, Languages, Play } from "lucide-react";
import { HeroHeader } from "./HeroHeader";

/**
 * OPCIÓN 3 — Modern LMS / Education SaaS.
 * Fondo blanco con formas suaves; a la derecha una "pantalla" del panel del
 * alumno construida con HTML (progreso, próxima clase, idioma, certificado),
 * no una captura: escala nítida y es fiel a lo que ofrece la plataforma.
 */
export function HeroOption3() {
  return (
    <div className="bg-white text-slate-900 min-h-screen overflow-hidden">
      <HeroHeader />

      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24 lg:pt-16 grid lg:grid-cols-[1fr_1.1fr] gap-14 items-center">
        {/* Formas suaves */}
        <div className="absolute -right-40 -top-24 w-[560px] h-[560px] rounded-full bg-indigo-50" aria-hidden />
        <div className="absolute right-[42%] top-1/3 w-48 h-48 rounded-full bg-amber-50 hidden lg:block" aria-hidden />

        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-xs">NUEVO</span> Clases en vivo integradas
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl xl:text-[56px] font-extrabold tracking-tight leading-[1.05]">
            Todo lo que necesitas para aprender en un solo lugar.
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed">
            Descubre cursos, conecta con profesores y lleva el control de tu aprendizaje desde una plataforma sencilla y moderna.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Link href="/create-academy" className="px-7 py-4 rounded-xl bg-indigo-600 text-white font-bold text-center inline-flex items-center justify-center gap-2 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">
              Empezar ahora <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#cursos" className="px-7 py-4 rounded-xl text-slate-700 font-semibold text-center hover:bg-slate-100 transition-colors">
              Explorar cursos
            </Link>
          </div>
          <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
            {["Sin instalaciones", "Certificados verificables", "En cualquier dispositivo"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {t}</li>
            ))}
          </ul>
        </div>

        {/* Panel del alumno (maqueta HTML) */}
        <div className="relative">
          <div className="relative rounded-2xl bg-white ring-1 ring-slate-200 shadow-2xl shadow-slate-900/10 overflow-hidden">
            <div className="h-9 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 px-4">
              {["bg-rose-300", "bg-amber-300", "bg-emerald-300"].map((c) => <span key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
              <span className="ml-3 text-[11px] text-slate-400 font-mono">Mi aprendizaje</span>
            </div>
            <div className="p-5 sm:p-6 grid sm:grid-cols-[1.4fr_1fr] gap-4">
              {/* Videoclase */}
              <div className="rounded-xl overflow-hidden relative aspect-video sm:aspect-auto sm:row-span-2 min-h-[180px]">
                <Image src="/hero-options/teacher-videocall.jpg" alt="Profesora en una videoclase" fill sizes="(max-width: 640px) 100vw, 30vw" className="object-cover" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow"><Play className="w-5 h-5 text-indigo-600 fill-current ml-0.5" /></span>
                </span>
                <span className="absolute left-3 bottom-3 px-2.5 py-1 rounded-md bg-slate-900/70 text-white text-xs font-semibold">Prof. Laura · Español B1</span>
              </div>
              {/* Progreso */}
              <div className="rounded-xl ring-1 ring-slate-200 p-4">
                <p className="text-xs text-slate-500">Progreso del curso</p>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-3xl font-extrabold">75%</span>
                  <span className="text-xs text-emerald-600 font-semibold mb-1.5">+12% esta semana</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full w-3/4 rounded-full bg-indigo-600" /></div>
              </div>
              {/* Próxima clase */}
              <div className="rounded-xl bg-indigo-50 p-4">
                <p className="text-xs text-indigo-700 font-semibold flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Próxima clase</p>
                <p className="mt-1 font-bold text-sm">Hoy · 18:00</p>
                <p className="text-xs text-slate-500">Conversación en grupo</p>
              </div>
            </div>
          </div>

          {/* Microelementos flotantes */}
          <div className="relative mt-4 sm:mt-0 sm:absolute sm:-left-8 sm:-bottom-6 bg-white rounded-xl shadow-lg ring-1 ring-slate-100 px-4 py-3 inline-flex items-center gap-3">
            <Languages className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-xs text-slate-500">Palabra del día</p>
              <p className="text-sm font-bold">la mariposa · butterfly</p>
            </div>
          </div>
          <div className="absolute -right-2 sm:-right-5 -top-5 bg-white rounded-xl shadow-lg ring-1 ring-slate-100 px-4 py-3 hidden sm:flex items-center gap-2.5">
            <Award className="w-5 h-5 text-emerald-500" />
            <p className="text-sm font-bold">Certificado A2 listo</p>
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  Shield,
  BookOpen,
  Users,
  Award,
  Zap,
  ArrowRight,
  CheckCircle2,
  Star,
  Globe,
  TrendingUp,
  GraduationCap,
  Bot,
  Brain,
  Layers,
  FileCheck,
  Check,
} from "lucide-react";
import { NLogoBadge } from "@/components/landing/NLogoBadge";
import { ParallaxBackground } from "@/components/landing/ParallaxBackground";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { LandingPricing } from "@/components/landing/LandingPricing";

// Landing page for Mentor Studio Global EdTech Platform - Adaptative VIP Executive Style
export default function Home() {
  return (
    <div className="min-h-screen relative text-main selection:bg-amber-500 selection:text-slate-950 font-sans transition-colors duration-300">
      {/* 3D Multi-layer Interactive Parallax Background */}
      <ParallaxBackground />

      {/* Main Content Overlay */}
      <div className="relative z-10">
        {/* Header / Navbar */}
        <header className="sticky top-0 z-50 backdrop-blur-xl glass-panel border-b border-amber-500/30 transition-colors duration-300 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            {/* Logo de Mentor Studio Global (placeholder hasta recibir el definitivo) */}
            <div className="flex items-center gap-3">
              <NLogoBadge size="md" />
              <div>
                <span className="font-extrabold text-xl tracking-tight gold-gradient-text block">
                  Mentor Studio Global
                </span>
                <span className="block text-[10px] text-sky-custom font-mono tracking-widest uppercase font-semibold">
                  Executive EdTech Suite
                </span>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-muted-custom">
              <a
                href="#features"
                className="hover:text-gold-custom transition-colors"
              >
                Características VIP
              </a>
              <a
                href="#ai"
                className="hover:text-gold-custom transition-colors"
              >
                Copiloto IA
              </a>
              <a
                href="#pricing"
                className="hover:text-gold-custom transition-colors"
              >
                Planes
              </a>
              <Link
                href="/a/jl-institute"
                className="text-sky-custom hover:opacity-80 transition-opacity flex items-center gap-1 font-mono text-xs glass-panel px-3 py-1.5 rounded-full border border-amber-500/30 shadow-sm"
              >
                Demo: JL Institute <ArrowRight className="w-3 h-3" />
              </Link>
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-semibold text-muted-custom hover:text-main transition-colors"
              >
                Iniciar Sesión
              </Link>
              <Link
                href="/create-academy"
                className="px-5 py-2.5 text-sm font-bold rounded-xl gold-gradient-bg shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all"
              >
                Crear Academia VIP
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative pt-20 pb-24 overflow-hidden blur-reveal">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-8 items-center">
              {/* Left Copy Column: Inspiring message for teachers */}
              <div className="lg:col-span-6 text-left space-y-8">
                {/* Live Pulse Badge */}
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full glass-panel border border-amber-500/40 text-gold-custom text-xs sm:text-sm font-bold shadow-md">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <Sparkles className="w-4 h-4 text-gold-custom shrink-0" />
                  <span className="tracking-wide">
                    La Plataforma de Élite para Educadores y Creadores de Conocimiento
                  </span>
                </div>

                {/* Main Headline */}
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.15] text-main">
                  Transforma tu Pasión Docente en un{" "}
                  <span className="gold-gradient-text block mt-1">
                    Imperio Educativo Digital.
                  </span>
                </h1>

                {/* Expanded Inspiring Message */}
                <p className="text-base sm:text-lg text-muted-custom leading-relaxed font-normal max-w-2xl">
                  Sin barreras técnicas ni intermediarios. Te brindamos el estándar
                  VIP que mereces: crea tu propia academia de alta reputación,
                  emite diplomas internacionales, multiplica tus ingresos y
                  guía a tus alumnos con Copilotos Pedagógicos impulsados por IA.
                  Tu legado educativo empieza aquí.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
                  <Link
                    href="/create-academy"
                    className="px-8 py-4 rounded-xl gold-gradient-bg font-bold text-base transition-all flex items-center justify-center gap-3 group shadow-xl shadow-amber-500/25"
                  >
                    Comenzar Mi Academia
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/a/jl-institute"
                    className="px-8 py-4 rounded-xl glass-panel border border-amber-500/30 hover:border-amber-500/60 text-main font-semibold text-base transition-all flex items-center justify-center gap-2"
                  >
                    Ver Demostración VIP (JL Institute)
                  </Link>
                </div>

                {/* Micro trust indicators */}
                <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-subtle-custom font-semibold">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-gold-custom" />
                    <span>Sin código requerido</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-custom" />
                    <span>Marca Blanca 100% Tuya</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-custom" />
                    <span>Certificados Automáticos</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Professional Teacher Image with 3D Glass Floating UI */}
              <div className="lg:col-span-6 relative">
                {/* Backlight Ambient Glow */}
                <div className="absolute -inset-4 bg-gradient-to-r from-amber-500/20 to-sky-500/20 rounded-3xl blur-2xl opacity-70 pointer-events-none" />

                {/* Main Image Card Container */}
                <div className="relative rounded-2xl overflow-hidden glass-gold-card p-1.5 border border-amber-500/40">
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-2xl">
                    <Image
                      src="/images/teachers-hero.jpg"
                      alt="Profesores realizando clases en plataforma Mentor Studio Global"
                      fill
                      priority
                      className="object-contain transition-transform duration-700 hover:scale-105"
                    />
                    {/* Inner Vignette Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
                  </div>

                  {/* Floating Glassmorphic Overlay Card 1 (Top Right) */}
                  <div className="absolute -top-3 -right-3 glass-panel p-3.5 rounded-2xl border border-amber-500/50 shadow-2xl flex items-center gap-3 backdrop-blur-md">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-gold-custom font-bold shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-main">
                        +1,200 Estudiantes
                      </div>
                      <div className="text-[11px] text-gold-custom font-bold">
                        Comunidad Activa
                      </div>
                    </div>
                  </div>

                  {/* Floating Glassmorphic Overlay Card 2 (Bottom Left) */}
                  <div className="absolute -bottom-4 -left-3 glass-panel p-4 rounded-2xl border border-sky-500/50 shadow-2xl flex items-center gap-3 backdrop-blur-md">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-custom shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-main">
                        Copiloto IA Pedagógico
                      </div>
                      <div className="text-[11px] text-sky-custom font-bold">
                        Generación MCER A1-C2 Activa
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-24 relative border-t border-amber-500/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-mono tracking-widest text-gold-custom font-bold uppercase glass-panel px-4 py-1.5 rounded-full border border-amber-500/40 shadow-sm">
                Infraestructura Educativa VIP
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-main">
                Todo lo que necesitas para escalar tu enseñanza con prestigio
              </h2>
              <p className="text-muted-custom text-base font-medium">
                Consolida tu presencia digital sin fragmentación. Olvídate de plataformas lentas y hojas de cálculo.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="p-8 rounded-2xl glass-gold-card flex flex-col justify-between group">
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-gold-custom mb-6 group-hover:scale-110 group-hover:bg-amber-500/25 transition-all shadow-sm">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-main">
                    LMS Modular & Cursos Premium
                  </h3>
                  <p className="text-muted-custom leading-relaxed text-sm font-medium">
                    Estructura módulos interactivos, recursos multimedia, ejercicios avanzados y enlaces a material complementario.
                  </p>
                </div>
                <div className="pt-6 mt-6 border-t border-amber-500/20 flex items-center justify-between text-xs text-gold-custom font-mono font-bold">
                  <span>Módulo Académico</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-8 rounded-2xl glass-gold-card flex flex-col justify-between group">
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-custom mb-6 group-hover:scale-110 group-hover:bg-sky-500/25 transition-all shadow-sm">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-main">
                    Copiloto IA Pedagógico
                  </h3>
                  <p className="text-muted-custom leading-relaxed text-sm font-medium">
                    Diseña currículos alineados al estándar europeo (MCER A1-C2), quizes automáticos y planes de estudio personalizados en segundos.
                  </p>
                </div>
                <div className="pt-6 mt-6 border-t border-amber-500/20 flex items-center justify-between text-xs text-sky-custom font-mono font-bold">
                  <span>Inteligencia Docente</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>

              {/* Feature 3 */}
              <div className="p-8 rounded-2xl glass-gold-card flex flex-col justify-between group">
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-custom mb-6 group-hover:scale-110 group-hover:bg-emerald-500/25 transition-all shadow-sm">
                    <Shield className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-main">
                    Multi-Tenancy y Marca Exclusiva
                  </h3>
                  <p className="text-muted-custom leading-relaxed text-sm font-medium">
                    Tu logo, tus colores corporativos y tu dominio personalizado. Aislamiento total de datos con seguridad de nivel institucional.
                  </p>
                </div>
                <div className="pt-6 mt-6 border-t border-amber-500/20 flex items-center justify-between text-xs text-emerald-custom font-mono font-bold">
                  <span>Dominio Propio</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dedicated Copiloto IA Showcase Section */}
        <section id="ai" className="py-24 relative border-t border-amber-500/20 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-12 gap-12 items-center">
              {/* Left Side: Copiloto IA Capabilities */}
              <div className="lg:col-span-6 space-y-6">
                <span className="text-xs font-mono tracking-widest text-sky-custom font-bold uppercase glass-panel px-4 py-1.5 rounded-full border border-sky-500/40 shadow-sm">
                  Copiloto IA Pedagógico Avanzado
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-main">
                  Genera Cursos Completo en Minutos alineados al Marco MCER
                </h2>
                <p className="text-muted-custom leading-relaxed font-medium">
                  Nuestra Inteligencia Artificial comprende las metodologías de enseñanza de idiomas y creación de cursos profesionales. Te ayuda a redactar objetivos de aprendizaje, guiones de lección y quizes adaptativos automáticamente.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-xl glass-panel border border-amber-500/30 flex items-start gap-4 hover:border-amber-500/60 transition-all">
                    <div className="p-2.5 rounded-lg bg-amber-500/20 text-gold-custom font-bold shrink-0">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-main text-sm">Estructuración Automática de Niveles A1 a C2</h4>
                      <p className="text-subtle-custom text-xs font-medium mt-0.5">
                        Establece secuencias didácticas óptimas recomendadas por expertos de la industria.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl glass-panel border border-sky-500/30 flex items-start gap-4 hover:border-sky-500/60 transition-all">
                    <div className="p-2.5 rounded-lg bg-sky-500/20 text-sky-custom font-bold shrink-0">
                      <FileCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-main text-sm">Evaluaciones y Quizes Automatizados</h4>
                      <p className="text-subtle-custom text-xs font-medium mt-0.5">
                        Genera ejercicios de opción múltiple, desarrollo y gramática contextualizada con 1 clic.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side: Interactive AI Copilot Live Preview Box */}
              <div className="lg:col-span-6 relative">
                <div className="p-6 rounded-2xl glass-gold-card border-2 border-sky-500/40 shadow-2xl relative">
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-amber-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-custom font-bold">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-main">Mentor Studio Global AI Copilot</div>
                        <div className="text-[10px] text-emerald-custom font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Listo para asistir
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-gold-custom font-bold glass-panel px-2.5 py-1 rounded-md">
                      Modelo MCER v2.4
                    </span>
                  </div>

                  {/* Simulated AI Chat Box */}
                  <div className="space-y-3 font-mono text-xs">
                    <div className="p-3 rounded-lg glass-panel text-main font-semibold">
                      <span className="text-gold-custom font-bold">Docente: </span>
                      &quot;Genera una lección interactiva de Business English Nivel B2 sobre Negociación Internacional.&quot;
                    </div>

                    <div className="p-3 rounded-lg glass-panel border border-sky-500/40 text-main space-y-2">
                      <div className="flex items-center gap-2 text-sky-custom font-bold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Copiloto IA Generando...</span>
                      </div>
                      <ul className="space-y-1 text-[11px] text-muted-custom font-sans font-medium">
                        <li className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-custom" />
                          <span>Vocabulario clave: High-stakes bargaining, concessions, win-win strategy.</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-custom" />
                          <span>Roleplay Práctico: Caso real de fusión corporativa europea.</span>
                        </li>
                        <li className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-custom" />
                          <span>Quiz interactivo de 5 preguntas generado automáticamente.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Preview */}
        <section id="pricing" className="py-24 relative border-t border-amber-500/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <span className="text-xs font-mono tracking-widest text-sky-custom font-bold uppercase glass-panel px-4 py-1.5 rounded-full border border-sky-500/40 shadow-sm">
                Inversión Transparente
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-main">
                Planes VIP Diseñados para Crecer Contigo
              </h2>
              <p className="text-muted-custom text-base font-medium">
                Sin comisiones por alumno ni costos ocultos. Potencia tu independencia financiera.
              </p>
            </div>

            <LandingPricing />
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-amber-500/20 text-center text-subtle-custom text-sm glass-panel">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <NLogoBadge size="sm" />
              <span className="font-bold gold-gradient-text">Mentor Studio Global</span>
              <span className="text-xs text-subtle-custom">| VIP EdTech Platform</span>
            </div>
            <p className="text-xs text-subtle-custom font-medium">
              © 2026 Mentor Studio Global — Virtual Language & Knowledge Suite. Todos los derechos reservados.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

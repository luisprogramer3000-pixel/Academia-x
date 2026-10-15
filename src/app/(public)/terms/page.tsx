"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, FileText, ScrollText, Scale, Globe } from "lucide-react";
import { NLogoBadge } from "@/components/landing/NLogoBadge";
import { ParallaxBackground } from "@/components/landing/ParallaxBackground";
import { ThemeToggle } from "@/components/landing/ThemeToggle";

export default function TermsPage() {
  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 p-6 sm:p-12 relative overflow-hidden font-sans transition-colors duration-300">
      <ParallaxBackground />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <NLogoBadge size="sm" />
            <div>
              <span className="font-extrabold text-xl tracking-tight gold-gradient-text">
                Mentor Studio Global
              </span>
              <span className="block text-[9px] text-sky-700 dark:text-sky-400 font-mono tracking-widest uppercase font-semibold">
                Executive EdTech Suite
              </span>
            </div>
          </Link>
          <ThemeToggle />
        </div>

        {/* Hero Card */}
        <div className="p-8 sm:p-10 rounded-3xl glass-gold-card shadow-2xl border border-amber-500/40 mb-8">
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-4">
            <ScrollText className="w-8 h-8" />
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Términos y Condiciones de Servicio
            </h1>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            Última actualización: 15 de Octubre de 2026. Al utilizar o registrarte en **Mentor Studio Global**, aceptas estos términos que rigen la relación entre la plataforma, los administradores de academias y los estudiantes.
          </p>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-6">
          {/* Section 1 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              1. Descripción del Servicio y Arquitectura Multi-Tenant
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Mentor Studio Global provee una plataforma EdTech multi-tenant (&quot;Software as a Service&quot; o SaaS) que permite a fundadores, profesores e instituciones crear, alojar y gestionar escuelas de idiomas y centros educativos virtuales independientes con aislamiento seguro de datos por academia.
            </p>
          </div>

          {/* Section 2 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              2. Propiedad Intelectual y Titularidad de Contenidos
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Cada academia mantiene la titularidad absoluta de sus cursos, lecciones, recursos pedagógicos y marcas registradas. Mentor Studio Global no reclama propiedad sobre el material didáctico subido por los creadores. El código fuente, arquitectura, diseño y marca **Mentor Studio Global** son propiedad exclusiva de la plataforma.
            </p>
          </div>

          {/* Section 3 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              3. Facturación, Planes SaaS y Modalidades de Pago
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Mentor Studio Global ofrece planes de suscripción (Starter, Professional VIP y Academy Executive) bajo modalidades de facturación mensual y anual (con 20% de descuento). El procesamiento de pagos se efectúa de forma segura a través de Payphone. Los precios están expresados en dólares e incluyen IVA. Las tarifas se pagan por adelantado y no son reembolsables una vez iniciado el periodo correspondiente, salvo en los casos previstos en nuestra{" "}
              <Link href="/refunds" className="underline font-semibold">Política de Reembolsos</Link>. Si el cliente lo autoriza expresamente al pagar, la tarjeta se guarda de forma tokenizada en Payphone y se cobra automáticamente al vencer cada periodo; el cobro automático puede desactivarse o la tarjeta eliminarse en cualquier momento desde Facturación.
            </p>
          </div>

          {/* Section 4 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              4. Sistema de Créditos de Inteligencia Artificial (AI Credits)
            </h2>
            <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
              <p>
                Cada plan incluye una cuota mensual fija de créditos de IA (separados para Profesor y Estudiante). En los planes anuales, la asignación de créditos se renueva mensualmente conforme al ciclo de 30 días de la billetera virtual.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                <li><strong>Rollover Mensual:</strong> Los créditos no consumidos pueden acumularse hasta el límite máximo estipulado por cada plan (Starter: 30 Teacher, Pro: 100 Teacher / 50 Student, Academy: 300 Teacher / 150 Student). Los créditos excedentes sobre el límite expiran al renovarse el ciclo.</li>
                <li><strong>Paquetes Top-Up:</strong> Los créditos adicionales adquiridos mediante paquetes Top-Up no expiran y se conservan de forma permanente durante cambios de plan o renovaciones.</li>
                <li><strong>Reembolsos Automáticos por Fallo Técnico:</strong> En caso de interrupción en la generación por parte del proveedor de IA, los créditos consumidos son reembolsados automáticamente de forma idempotente.</li>
              </ul>
            </div>
          </div>

          {/* Section 5 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              5. Política de Cancelación y Término de Servicio
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              El usuario puede cancelar su suscripción en cualquier momento desde el panel de facturación. La cancelación surtirá efecto al finalizar el ciclo de facturación en curso, manteniendo el acceso a las funciones del plan hasta dicha fecha. La cancelación no destruye la billetera virtual ni elimina créditos Top-Up adquiridos.
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Los alumnos y profesores pueden eliminar su cuenta en cualquier momento desde <strong>Mi cuenta</strong>. El dueño de una academia puede
              solicitar la baja de la academia y de su cuenta a soporte; la atenderemos en un máximo de 15 días.
            </p>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-10 text-center flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al Inicio
          </Link>
          <Link href="/privacy" className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">
            Política de Privacidad →
          </Link>
        </div>
      </div>
    </div>
  );
}

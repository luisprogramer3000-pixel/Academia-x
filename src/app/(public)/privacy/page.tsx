"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck, Lock, Eye, Database, Mail } from "lucide-react";
import { NLogoBadge } from "@/components/landing/NLogoBadge";
import { ParallaxBackground } from "@/components/landing/ParallaxBackground";
import { ThemeToggle } from "@/components/landing/ThemeToggle";

export default function PrivacyPage() {
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
            <ShieldCheck className="w-8 h-8" />
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Política de Privacidad y Protección de Datos
            </h1>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            Última actualización: 16 de Agosto de 2026. Nos tomamos muy en serio la seguridad y confidencialidad de tu información personal y los datos educativos de tus alumnos.
          </p>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-6">
          {/* Section 1 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              1. Información que Recopilamos y Aislamiento Multi-Tenant
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Recopilamos únicamente la información necesaria para el funcionamiento de la plataforma: datos de registro (nombre, correo electrónico), datos de uso del curso, avances de lecciones y registros de interacción con las herramientas de Inteligencia Artificial. Todos los datos están estrictamente aislados por academia (&quot;Tenant Isolation&quot;).
            </p>
          </div>

          {/* Section 2 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              2. Uso de la Información y Cumplimiento GDPR
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Tus datos se utilizan exclusivamente para personalizar la experiencia de aprendizaje, expedir certificados oficiales y garantizar el correcto funcionamiento del servicio. No vendemos ni compartimos datos personales con terceros para fines publicitarios.
            </p>
          </div>

          {/* Section 3 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              3. Seguridad, Encriptación y Procesamiento de Pagos
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Implementamos encriptación de datos en tránsito (TLS/SSL con HSTS estricto) y en reposo. Todas las transacciones bancarias son procesadas de forma directa por pasarelas certificadas PCI-DSS (Payphone). Mentor Studio Global nunca ve ni guarda el número completo de tu tarjeta: si autorizas los cobros automáticos, solo conservamos cifrado el identificador (token) que entrega Payphone.
            </p>
          </div>

          {/* Section 4 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              4. Procesamiento de Inteligencia Artificial y Privacidad de Modelos
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Las solicitudes de generación pedagógica y asistencia de IA son procesadas a través de endpoints seguros en el servidor con proveedores certificados (OpenAI). Los datos enviados mediante la API empresarial no se utilizan para entrenar modelos públicos de terceros ni se retienen más allá del procesamiento de la solicitud.
            </p>
          </div>

          {/* Section 5 */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              5. Derechos ARCO y Contacto Legal
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Cualquier usuario tiene derecho a acceder, rectificar, cancelar o solicitar la eliminación total de sus datos personales enviando una solicitud a nuestro canal de soporte técnico y privacidad.
            </p>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-10 text-center flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al Inicio
          </Link>
          <Link href="/terms" className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">
            Términos y Condiciones →
          </Link>
        </div>
      </div>
    </div>
  );
}

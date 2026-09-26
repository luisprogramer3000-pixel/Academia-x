import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { SAAS_PLANS } from "@/modules/billing/plans";
import { LifeBuoy, Mail, MessageCircle, Clock, Zap } from "lucide-react";
import Link from "next/link";

export default async function SupportPage() {
  const ctx = await getDashboardContext(OWNER_ONLY);
  const { tenantId, tenant: academy } = ctx;
  const planId = ctx.activePlan?.id as keyof typeof SAAS_PLANS | undefined;

  const isExecutive = planId === "ACADEMY";

  // Datos de contacto reales del soporte. Se configuran por entorno para no
  // publicar nunca un email o un WhatsApp inventado ante un cliente que paga.
  const supportEmail = process.env.SUPPORT_EMAIL || "";
  // Solo dígitos con prefijo de país, sin "+" ni espacios (formato de wa.me)
  const supportWhatsApp = (process.env.SUPPORT_WHATSAPP || "").replace(/[^0-9]/g, "");
  const supportResponseHours = process.env.SUPPORT_RESPONSE_HOURS || "24";

  if (!isExecutive) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
        <div className="flex-1 flex flex-col min-w-0">
          <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
          <main className="p-8 flex-1 flex items-center justify-center">
            <div className="text-center p-8 rounded-3xl bg-slate-900 border border-slate-800 max-w-lg">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto mb-6">
                <LifeBuoy className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Soporte Prioritario VIP</h2>
              <p className="text-slate-400 mb-8">
                El canal de soporte directo por WhatsApp y correo prioritario es exclusivo para clientes del plan <strong className="text-white">Academy Executive</strong>.
              </p>
              <Link href="/dashboard/billing" className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors">
                Mejorar Plan
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        
        <main className="p-8 flex-1 overflow-y-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
              <LifeBuoy className="w-8 h-8 text-blue-400" /> Centro de Soporte VIP
            </h1>
            <p className="text-slate-400 mt-2">
              Como miembro Executive, tienes acceso directo a nuestro equipo técnico 24/7.
            </p>
          </div>

          {!supportEmail && !supportWhatsApp && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
              Los canales de soporte todavía no están configurados. Definí <code className="font-mono">SUPPORT_EMAIL</code> y{" "}
              <code className="font-mono">SUPPORT_WHATSAPP</code> en las variables de entorno del servidor.
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {supportEmail && (
            <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl group-hover:bg-blue-600/20 transition-all" />
              <Mail className="w-10 h-10 text-blue-400 mb-6" />
              <h3 className="text-xl font-bold text-white mb-2">Línea Directa</h3>
              <p className="text-slate-400 text-sm mb-6">
                Para consultas de facturación, configuraciones complejas o dudas generales de la plataforma. Respuesta garantizada en menos de {supportResponseHours} horas.
              </p>
              <a
                href={`mailto:${supportEmail}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
              >
                <Mail className="w-4 h-4" /> {supportEmail}
              </a>
            </div>
            )}

            {supportWhatsApp && (
              <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600/10 rounded-full blur-2xl group-hover:bg-emerald-600/20 transition-all" />
                <MessageCircle className="w-10 h-10 text-emerald-400 mb-6" />
                <h3 className="text-xl font-bold text-white mb-2">WhatsApp de Emergencia</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Canal exclusivo para reportar caídas del servidor o errores críticos que impiden a tus estudiantes acceder a las clases.
                </p>
                <a
                  href={`https://wa.me/${supportWhatsApp}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shadow-lg shadow-emerald-600/20"
                >
                  <MessageCircle className="w-4 h-4" /> Contactar por WhatsApp
                </a>
              </div>
            )}
          </div>

          <div className="mt-8 p-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-white font-bold mb-1">Tu Asesor de Éxito Asignado</h4>
              <p className="text-slate-400 text-sm">
                En breve nos pondremos en contacto contigo para agendar tu sesión inicial de onboarding personalizado (1 a 1).
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

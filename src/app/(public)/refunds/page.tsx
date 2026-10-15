import Link from "next/link";
import { ArrowLeft, Receipt, RefreshCw, Sparkles, AlertTriangle, Mail, Ban } from "lucide-react";
import { NLogoBadge } from "@/components/landing/NLogoBadge";
import { ParallaxBackground } from "@/components/landing/ParallaxBackground";
import { ThemeToggle } from "@/components/landing/ThemeToggle";

export const metadata = { title: "Política de Reembolsos" };

const card = "p-6 rounded-2xl glass-panel border border-slate-300 dark:border-slate-800 space-y-3";
const h2 = "text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2";
const icon = "w-5 h-5 text-amber-600 dark:text-amber-400";
const text = "text-sm text-slate-700 dark:text-slate-300 leading-relaxed";

export default function RefundsPage() {
  const support = process.env.SUPPORT_EMAIL;
  const hours = process.env.SUPPORT_RESPONSE_HOURS;

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 p-6 sm:p-12 relative overflow-hidden font-sans transition-colors duration-300">
      <ParallaxBackground />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <NLogoBadge size="sm" />
            <div>
              <span className="font-extrabold text-xl tracking-tight gold-gradient-text">Mentor Studio Global</span>
              <span className="block text-[9px] text-sky-700 dark:text-sky-400 font-mono tracking-widest uppercase font-semibold">
                Executive EdTech Suite
              </span>
            </div>
          </Link>
          <ThemeToggle />
        </div>

        <div className="p-8 sm:p-10 rounded-3xl glass-gold-card shadow-2xl border border-amber-500/40 mb-8">
          <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-4">
            <Receipt className="w-8 h-8" />
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Política de Reembolsos y Cancelación</h1>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
            Última actualización: 15 de octubre de 2026. Esta política explica cuándo devolvemos un pago hecho a Mentor Studio Global
            (planes de suscripción y paquetes de créditos de IA) y cómo pedirlo. No sustituye los derechos que te reconoce la Ley Orgánica de
            Defensa del Consumidor del Ecuador.
          </p>
        </div>

        <div className="space-y-6">
          <div className={card}>
            <h2 className={h2}><RefreshCw className={icon} /> 1. Planes de suscripción</h2>
            <div className={`${text} space-y-2`}>
              <p>
                Los planes se pagan por adelantado (mensual o anual) y dan acceso inmediato a la plataforma y a los créditos de IA del periodo. Por eso,
                una vez iniciado el periodo, el pago no es reembolsable, salvo en los casos del punto 3.
              </p>
              <p>
                Puedes desactivar el cobro automático o quitar tu tarjeta guardada en cualquier momento desde <strong>Facturación</strong>. Tu plan sigue
                activo hasta el final del periodo pagado y no se cobra el siguiente. No hay reembolsos parciales por los días que no uses.
              </p>
            </div>
          </div>

          <div className={card}>
            <h2 className={h2}><Sparkles className={icon} /> 2. Paquetes de créditos de IA</h2>
            <div className={`${text} space-y-2`}>
              <p>
                Los créditos comprados se acreditan al instante y no caducan. Puedes pedir el reembolso de un paquete dentro de los 7 días siguientes a la
                compra si <strong>no has usado ninguno</strong> de sus créditos. Un paquete ya usado, total o parcialmente, no es reembolsable.
              </p>
              <p>
                Si una generación con IA falla por un problema técnico, los créditos consumidos se devuelven automáticamente a tu saldo.
              </p>
            </div>
          </div>

          <div className={card}>
            <h2 className={h2}><AlertTriangle className={icon} /> 3. Cuándo sí devolvemos el dinero</h2>
            <ul className={`${text} list-disc pl-5 space-y-1`}>
              <li>Cobros duplicados o por un importe distinto al del plan o paquete elegido.</li>
              <li>Cobros automáticos hechos después de que desactivaste la renovación o quitaste tu tarjeta.</li>
              <li>Cuando la plataforma no estuvo disponible por causas atribuibles a nosotros durante una parte importante del periodo pagado.</li>
              <li>Cualquier otro caso en que la ley de defensa del consumidor te reconozca el derecho a la devolución.</li>
            </ul>
          </div>

          <div className={card}>
            <h2 className={h2}><Mail className={icon} /> 4. Cómo pedir un reembolso</h2>
            <div className={`${text} space-y-2`}>
              <p>
                Escríbenos{support ? <> a <a href={`mailto:${support}`} className="underline font-semibold">{support}</a></> : " a nuestro canal de soporte"} desde
                el correo de tu cuenta, indicando el nombre de tu academia, la fecha del cobro y el motivo. Te responderemos
                {hours ? ` en un máximo de ${hours} horas hábiles` : " lo antes posible"}.
              </p>
              <p>
                Si el reembolso procede, lo hacemos a la misma tarjeta con la que pagaste, a través de Payphone. Según tu banco, el dinero puede tardar
                entre 5 y 15 días hábiles en verse en tu estado de cuenta. Al reembolsar un plan se cancela el periodo correspondiente; al reembolsar un
                paquete se retiran sus créditos del saldo.
              </p>
            </div>
          </div>

          <div className={card}>
            <h2 className={h2}><Ban className={icon} /> 5. Cursos que venden las academias</h2>
            <p className={text}>
              Los pagos que un alumno hace a una academia por sus cursos los gestiona y cobra directamente esa academia, no Mentor Studio Global. Para pedir
              un reembolso de un curso, contacta con la academia. Cada academia es responsable de su propia política de reembolsos frente a sus alumnos.
            </p>
          </div>
        </div>

        <div className="mt-10 text-center flex flex-wrap gap-4 items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver al Inicio
          </Link>
          <div className="flex gap-4">
            <Link href="/terms" className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">Términos y Condiciones →</Link>
            <Link href="/privacy" className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline">Política de Privacidad →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

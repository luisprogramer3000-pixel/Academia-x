import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { BookOpen, ArrowLeft, Layers, FileText } from "lucide-react";
import Link from "next/link";

export default async function NewContentPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-3xl">
          <div className="mb-8">
            <Link
              href="/dashboard/courses"
              className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a mis recursos
            </Link>
            <h1 className="text-3xl font-extrabold text-white mb-2">¿Qué quieres crear?</h1>
            <p className="text-slate-400 text-sm">
              Elige el tipo de contenido que mejor se adapta a lo que vas a preparar.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            {/* Opción: Curso */}
            <Link
              href="/dashboard/courses/new/course"
              className="group p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/80 transition-all flex flex-col gap-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Layers className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Curso</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Programa estructurado con módulos, múltiples clases, precio, landing de venta y certificado. Ideal para formaciones completas.
                </p>
              </div>
              <ul className="text-xs text-slate-500 space-y-1.5">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Módulos y lecciones organizadas</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Landing page de venta</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Precio e inscripciones</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Certificado al completar</li>
              </ul>
              <span className="mt-auto text-xs font-semibold text-blue-400 group-hover:underline">
                Crear curso →
              </span>
            </Link>

            {/* Opción: Lección simple */}
            <Link
              href="/dashboard/courses/new/lesson"
              className="group p-8 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900/80 transition-all flex flex-col gap-5"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <FileText className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Lección / Clase</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Clase suelta que queda como recurso interno de tu academia. Sin landing ni inscripciones. Perfecta para clases individuales o materiales de apoyo.
                </p>
              </div>
              <ul className="text-xs text-slate-500 space-y-1.5">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Contenido en bloques (texto, video, quiz…)</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Plan del profesor integrado</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Recurso interno de la academia</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Sin landing ni precio</li>
              </ul>
              <span className="mt-auto text-xs font-semibold text-emerald-400 group-hover:underline">
                Crear lección →
              </span>
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

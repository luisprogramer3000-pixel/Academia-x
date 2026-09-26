import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { createCourseAction } from "@/app/actions/course.actions";
import { Layers, ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";

export default async function NewCoursePage() {
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
          <div className="mb-6">
            <Link
              href="/dashboard/courses/new"
              className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a elegir tipo
            </Link>
            <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
              <Layers className="w-7 h-7 text-blue-400" /> Crear Nuevo Curso
            </h1>
            <p className="text-slate-400 text-sm">
              Programa completo con módulos, landing de venta, precio y certificado.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <form action={createCourseAction} className="space-y-6">

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Título del Curso</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="Ej. Español B2 - Negocios e Industria"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Descripción General</label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Resumen pedagógico de los objetivos del curso..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Nivel MCER</label>
                  <select
                    name="level"
                    defaultValue="B1"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="A1">A1 - Acceso (Principiante)</option>
                    <option value="A2">A2 - Plata (Básico)</option>
                    <option value="B1">B1 - Umbral (Intermedio)</option>
                    <option value="B2">B2 - Avanzado (Intermedio Alto)</option>
                    <option value="C1">C1 - Dominio Eficaz (Avanzado)</option>
                    <option value="C2">C2 - Maestría (Nativo/Profesional)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Precio ($ USD)</label>
                  <input
                    type="number"
                    name="priceAmount"
                    defaultValue={99}
                    min={0}
                    step={1}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Método de Cobro</label>
                  <select
                    name="paymentType"
                    defaultValue="EXTERNAL"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    <option value="EXTERNAL">Enlace Externo (Manual)</option>
                    <option value="STRIPE_CONNECT" disabled>Stripe Integrado (Próximamente)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Link de Pago (Si es Externo)</label>
                  <input
                    type="url"
                    name="paymentLink"
                    placeholder="https://paypal.me/... o link de Stripe"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/30"
                >
                  <Plus className="w-4 h-4" /> Crear y Abrir Constructor
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { Layers, ArrowLeft } from "lucide-react";
import { NewCourseForm } from "./NewCourseForm";
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
              href="/dashboard/courses"
              className="text-xs text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1 mb-4"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Volver a mis cursos
            </Link>
            <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
              <Layers className="w-7 h-7 text-blue-400" /> Crear Nuevo Curso
            </h1>
            <p className="text-slate-400 text-sm">
              Programa completo con módulos, landing de venta, precio y certificado.
            </p>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <NewCourseForm />
          </div>
        </main>
      </div>
    </div>
  );
}

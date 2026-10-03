import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { CertificateService } from "@/modules/certificate/certificate.service";
import { UserService } from "@/modules/user/user.service";
import { CourseService } from "@/modules/course/course.service";
import { issueCertificateAction } from "@/app/actions/certificate.actions";
import { CertificateIssuer } from "@/components/dashboard/CertificateIssuer";
import Link from "next/link";
import { Award, Plus, Globe, CheckCircle2, ShieldCheck, Search } from "lucide-react";

export default async function CertificatesDashboardPage() {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  const certificates: Awaited<ReturnType<typeof CertificateService.getCertificatesByTenant>> = academy
    ? await CertificateService.getCertificatesByTenant(tenantId)
    : [];
  const students: Awaited<ReturnType<typeof UserService.getStudentsByTenant>> = academy
    ? await UserService.getStudentsByTenant(tenantId)
    : [];
  const courses: Awaited<ReturnType<typeof CourseService.getCoursesByTenant>> = academy
    ? await CourseService.getCoursesByTenant(tenantId)
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
                <Award className="w-7 h-7 text-blue-400" /> Certificados y Acreditaciones
              </h1>
              <p className="text-slate-400 text-sm">
                Emite y gestiona certificados digitales con códigos únicos de verificación pública.
              </p>
            </div>
          </div>

          {/* Emisión por curso: plantilla + aprobación alumno a alumno */}
          <div className="mb-10">
            <CertificateIssuer
              academyName={name}
              courses={courses.map((c) => ({ id: c.id, title: c.title }))}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* List of Issued Certificates */}
            <div className="lg:col-span-2 space-y-4">
              <h2 className="text-xl font-bold text-white mb-4">
                Certificados Emitidos ({certificates.length})
              </h2>

              {certificates.length > 0 ? (
                certificates.map((cert: any) => (
                  <div key={cert.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-mono font-bold">
                          {cert.code}
                        </span>
                        <span className="text-xs text-slate-400">
                          Emitido: {new Date(cert.issuedAt).toLocaleDateString("es-ES")}
                        </span>
                      </div>
                      <h3 className="font-bold text-white text-base mb-1">{cert.user.name || cert.user.email}</h3>
                      <p className="text-xs text-slate-400">{cert.course.title}</p>
                    </div>

                    <Link
                      href={`/verify/${cert.code}`}
                      target="_blank"
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Globe className="w-3.5 h-3.5" /> Verificación Pública ↗
                    </Link>
                  </div>
                ))
              ) : (
                <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                  No se han emitido certificados aún. Selecciona un alumno y curso para emitir el primero.
                </div>
              )}
            </div>

            {/* Form: Emitir Certificado */}
            <div>
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-blue-400" /> Emitir Nuevo Certificado
                </h3>

                <form action={issueCertificateAction} className="space-y-4">

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Seleccionar Estudiante</label>
                    <select
                      name="userId"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecciona alumno...</option>
                      {students.map((s: any) => (
                        <option key={s.user.id} value={s.user.id}>{s.user.name || s.user.email}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Seleccionar Curso</label>
                    <select
                      name="courseId"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">Selecciona curso...</option>
                      {courses.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors shadow-md flex items-center justify-center gap-2"
                  >
                    <Award className="w-4 h-4" /> Generar Certificado Digital
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

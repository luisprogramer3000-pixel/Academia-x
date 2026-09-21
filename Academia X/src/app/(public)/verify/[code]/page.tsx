import { CertificateService } from "@/modules/certificate/certificate.service";
import Link from "next/link";
import { ShieldCheck, Award, CheckCircle2, Globe, Calendar, User, School, AlertTriangle } from "lucide-react";

interface VerificationPageProps {
  params: Promise<{ code: string }>;
}

export default async function PublicCertificateVerificationPage({ params }: VerificationPageProps) {
  const { code } = await params;

  const certificate = await CertificateService.getCertificateByCode(code);

  const certData = certificate
    ? {
        code: certificate.code,
        studentName: certificate.user.name || certificate.user.email,
        courseTitle: certificate.course.title,
        courseLevel: certificate.course.level,
        academyName: certificate.tenant.name,
        primaryColor: certificate.tenant.primaryColor || "#2563eb",
        issuedAt: new Date(certificate.issuedAt).toLocaleDateString("es-ES", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      }
    : null;

  if (!certData) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 selection:bg-red-500 selection:text-white">
        <div className="max-w-md text-center p-8 rounded-3xl bg-slate-900 border border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Certificado No Encontrado</h1>
          <p className="text-slate-400 text-sm mb-6">
            El código de verificación <code className="text-red-400 font-mono font-bold">{code}</code> no coincide con ningún registro emitido en el sistema.
          </p>
          <Link href="/" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors">
            Volver a Academia X
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-blue-500 selection:text-white">
      {/* Container */}
      <div className="w-full max-w-2xl">
        {/* Verification Status Badge */}
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="w-5 h-5" /> Certificado Oficial Verificado
          </div>
          <span className="text-xs font-mono font-bold bg-emerald-500/20 px-3 py-1 rounded-md border border-emerald-500/30">
            {certData.code}
          </span>
        </div>

        {/* Certificate Card */}
        <div className="p-10 rounded-3xl bg-slate-900 border-2 border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          {/* Academy Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                style={{ backgroundColor: certData.primaryColor }}
              >
                {certData.academyName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-white text-base">{certData.academyName}</h2>
                <span className="text-xs text-blue-400 font-mono">Institución Emisora Acreditada</span>
              </div>
            </div>

            <Award className="w-8 h-8 text-amber-400" />
          </div>

          {/* Main Body */}
          <div className="text-center space-y-6 my-8">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Acredita que
            </span>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {certData.studentName}
            </h1>

            <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
              ha completado satisfactoriamente los requisitos académicos e instancias de evaluación del programa:
            </p>

            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 inline-block w-full">
              <span className="px-3 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-mono font-semibold uppercase mb-2 inline-block">
                Nivel MCER: {certData.courseLevel}
              </span>
              <h3 className="text-xl font-bold text-white">{certData.courseTitle}</h3>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 font-mono gap-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-500" /> Fecha de Emisión: {certData.issuedAt}
            </div>

            <div className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-400" /> Hash de Verificación Auténtico
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-xs text-slate-500">
          Validado oficialmente por <Link href="/" className="text-slate-400 hover:text-white underline">Academia X Platform Engine</Link>.
        </div>
      </div>
    </div>
  );
}

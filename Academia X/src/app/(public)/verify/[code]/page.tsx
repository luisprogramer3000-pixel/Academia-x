import { CertificateService } from "@/modules/certificate/certificate.service";
import Link from "next/link";
import { ShieldCheck, Calendar, User, AlertTriangle } from "lucide-react";
import { buildCertificateData } from "@/modules/certificate/certificate-view";
import { CertificateView } from "@/components/certificates/registry";
import { CertificatePrintStyles, CertificateSheetViewer, DownloadPdfButton } from "@/components/certificates/CertificateSheetViewer";
import { formatInTimezone } from "@/lib/timezone";

interface VerificationPageProps {
  params: Promise<{ code: string }>;
}

export default async function PublicCertificateVerificationPage({ params }: VerificationPageProps) {
  const { code } = await params;

  const certificate = await CertificateService.getCertificateByCode(code);

  const certData = certificate
    ? {
        code: certificate.code,
        cryptoHash: certificate.cryptoHash,
        studentName: certificate.user.name || certificate.user.email,
        courseTitle: certificate.course.title,
        courseLevel: certificate.course.level,
        academyName: certificate.tenant.name,
        logoUrl: certificate.tenant.logoUrl,
        primaryColor: certificate.tenant.primaryColor || "#2563eb",
        // Fecha en la zona horaria de la academia que emitió el certificado
        issuedAt: formatInTimezone(certificate.issuedAt, certificate.tenant.timezone, {
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
            Volver a Mentor Studio Global
          </Link>
        </div>
      </div>
    );
  }

  const view = await buildCertificateData(certificate!);
  const fileName = `Certificado ${certData.studentName} - ${certData.courseTitle}`.replace(/[\/:*?"<>|]+/g, " ");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-8 sm:px-6 selection:bg-blue-500 selection:text-white">
      <CertificatePrintStyles />
      <div className="w-full max-w-6xl mx-auto">
        {/* Estado de verificación + descarga */}
        <div className="no-print mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
            <ShieldCheck className="w-5 h-5" /> Certificado oficial verificado · emitido por {certData.academyName}
            <span className="text-xs font-mono font-bold bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-500/30">{certData.code}</span>
          </div>
          <DownloadPdfButton fileName={fileName} />
        </div>

        <CertificateSheetViewer>
          <CertificateView templateId={certificate!.template} data={view} />
        </CertificateSheetViewer>

        {/* Datos de autenticidad */}
        <div className="no-print mt-6 grid sm:grid-cols-3 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <p className="text-slate-500 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Titular</p>
            <p className="text-white font-semibold mt-1">{certData.studentName}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
            <p className="text-slate-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Fecha de emisión</p>
            <p className="text-white font-semibold mt-1">{certData.issuedAt}</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 group relative">
            <p className="text-slate-500 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> {certData.cryptoHash ? "Firma criptográfica SHA-256" : "Verificación estándar"}</p>
            <p className="text-slate-300 font-mono mt-1 break-all">{certData.cryptoHash ? `${certData.cryptoHash.slice(0, 32)}…` : "—"}</p>
          </div>
        </div>
        <p className="no-print text-center mt-6 text-xs text-slate-500">
          Para guardarlo, pulsa <strong className="text-slate-300">Descargar PDF</strong> y elige <strong className="text-slate-300">Guardar como PDF</strong> como destino.
          {" "}Validado por <Link href="/" className="text-slate-400 hover:text-white underline">Mentor Studio Global</Link>.
        </p>
      </div>
    </div>
  );
}

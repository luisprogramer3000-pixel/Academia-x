import { CertificateTemplate4 } from "@/components/certificates/CertificateTemplate4";
import { SAMPLE_CERTIFICATE } from "@/components/certificates/certificate-data";
import { CertificatePreview } from "../CertificatePreview";

export const metadata = { title: "Plantilla de certificado 4" };

export default async function Page({ searchParams }: { searchParams: Promise<{ vacio?: string }> }) {
  const placeholders = (await searchParams).vacio === "1";
  return (
    <CertificatePreview current={4} placeholders={placeholders}>
      <CertificateTemplate4 data={placeholders ? {} : SAMPLE_CERTIFICATE} />
    </CertificatePreview>
  );
}

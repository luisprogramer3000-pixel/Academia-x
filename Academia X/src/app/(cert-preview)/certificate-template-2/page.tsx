import { CertificateTemplate2 } from "@/components/certificates/CertificateTemplate2";
import { SAMPLE_CERTIFICATE } from "@/components/certificates/certificate-data";
import { CertificatePreview } from "../CertificatePreview";

export const metadata = { title: "Plantilla de certificado 2" };

export default async function Page({ searchParams }: { searchParams: Promise<{ vacio?: string }> }) {
  const placeholders = (await searchParams).vacio === "1";
  return (
    <CertificatePreview current={2} placeholders={placeholders}>
      <CertificateTemplate2 data={placeholders ? {} : SAMPLE_CERTIFICATE} />
    </CertificatePreview>
  );
}

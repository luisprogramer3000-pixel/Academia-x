import { CertificateTemplate3 } from "@/components/certificates/CertificateTemplate3";
import { SAMPLE_CERTIFICATE } from "@/components/certificates/certificate-data";
import { CertificatePreview } from "../CertificatePreview";

export const metadata = { title: "Plantilla de certificado 3" };

export default async function Page({ searchParams }: { searchParams: Promise<{ vacio?: string }> }) {
  const placeholders = (await searchParams).vacio === "1";
  return (
    <CertificatePreview current={3} placeholders={placeholders}>
      <CertificateTemplate3 data={placeholders ? {} : SAMPLE_CERTIFICATE} />
    </CertificatePreview>
  );
}

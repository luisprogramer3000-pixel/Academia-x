import { CertificateTemplate1 } from "@/components/certificates/CertificateTemplate1";
import { SAMPLE_CERTIFICATE } from "@/components/certificates/certificate-data";
import { CertificatePreview } from "../CertificatePreview";

export const metadata = { title: "Plantilla de certificado 1" };

export default async function Page({ searchParams }: { searchParams: Promise<{ vacio?: string }> }) {
  const placeholders = (await searchParams).vacio === "1";
  return (
    <CertificatePreview current={1} placeholders={placeholders}>
      <CertificateTemplate1 data={placeholders ? {} : SAMPLE_CERTIFICATE} />
    </CertificatePreview>
  );
}

import { joinParts, withPlaceholders, type CertificateData } from "./certificate-data";
import { montserrat, playfair } from "./fonts";
import { A4Sheet, Field, Logo, QrPlaceholder, Signature } from "./parts";

/**
 * PLANTILLA 2 — Diploma institucional moderno (azul marino, sin adornos).
 * Asimétrica: banda vertical azul a la izquierda con logo, sello y QR; el
 * contenido a la derecha con tipografía fuerte y una rejilla de datos clara.
 * Ideal para programas, niveles y cursos online.
 */
const C = { navy: "#0E2A52", navyDeep: "#0A1F3D", accent: "#C9A44C", ink: "#132238", muted: "#5C6B80", line: "#D8DEE8", paper: "#FFFFFF" };

export function CertificateTemplate2({ data }: { data: CertificateData }) {
  const c = withPlaceholders(data);
  return (
    <A4Sheet style={{ background: C.paper, display: "grid", gridTemplateColumns: "72mm 1fr" }} className={montserrat.className}>
      {/* Banda institucional */}
      <aside style={{ background: C.navy, color: "#fff", padding: "16mm 10mm 12mm", display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.07 }} preserveAspectRatio="none" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => <line key={i} x1={-20 + i * 10} y1="100" x2={20 + i * 10} y2="0" stroke="#fff" strokeWidth="0.4" />)}
        </svg>
        <Logo c={c} size={22} color={C.navy} bg="#fff" />
        <div style={{ fontSize: "3.6mm", fontWeight: 700, letterSpacing: "0.18em", textAlign: "center", marginTop: "5mm", textTransform: "uppercase" }}>{c.academyName}</div>
        <div style={{ width: "14mm", height: "0.6mm", background: C.accent, margin: "5mm 0" }} />

        {/* Insignia hexagonal */}
        <svg viewBox="0 0 120 130" style={{ width: "34mm", height: "37mm", marginTop: "6mm" }} aria-label="[SELLO DE VERIFICACIÓN]">
          <polygon points="60,4 114,34 114,96 60,126 6,96 6,34" fill="none" stroke={C.accent} strokeWidth="2.5" />
          <polygon points="60,14 105,39 105,91 60,116 15,91 15,39" fill={C.navyDeep} stroke={C.accent} strokeWidth="0.8" />
          <path d="M42 64 L55 77 L80 50" fill="none" stroke={C.accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <text x="60" y="100" textAnchor="middle" fontSize="8" fill="#fff" fontWeight="700" letterSpacing="1.5">VERIFICADO</text>
        </svg>
        <div style={{ fontSize: "2.6mm", letterSpacing: "0.2em", textTransform: "uppercase", textAlign: "center", color: "#dbe4f3", marginTop: "3mm", lineHeight: 1.5 }}>{c.sealText}</div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "2mm" }}>
          <div style={{ padding: "1.5mm", background: "#fff", borderRadius: "1.5mm" }}><QrPlaceholder size={20} color={C.navy} svg={c.qrSvg} /></div>
          <div style={{ fontSize: "2.2mm", color: "#b9c6dc", textAlign: "center", wordBreak: "break-all" }}>{c.verifyUrl}</div>
        </div>
      </aside>

      {/* Contenido */}
      <section style={{ padding: "18mm 20mm 14mm 18mm", display: "flex", flexDirection: "column", color: C.ink }}>
        <div style={{ fontSize: "3mm", fontWeight: 700, letterSpacing: "0.35em", color: C.accent, textTransform: "uppercase", marginTop: "auto" }}>{c.certificateType}</div>
        <div className={playfair.className} style={{ fontSize: "17mm", fontWeight: 700, lineHeight: 1, color: C.navy, marginTop: "3mm" }}>Diploma</div>
        <div style={{ fontSize: "3.6mm", color: C.muted, marginTop: "7mm" }}>Se otorga el presente a</div>
        <div style={{ fontSize: "12mm", fontWeight: 700, color: C.navy, lineHeight: 1.1, marginTop: "2mm", letterSpacing: "-0.01em" }}>{c.studentName}</div>
        <div style={{ width: "100%", height: "0.5mm", background: C.navy, marginTop: "4mm" }} />

        <p style={{ fontSize: "3.6mm", lineHeight: 1.6, color: C.ink, margin: "6mm 0 0", maxWidth: "175mm" }}>
          {c.achievement}
        </p>
        <div style={{ marginTop: "4mm", marginBottom: "auto", display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: "3mm", padding: "2.5mm 4mm", background: "#F2F5FA", borderLeft: `1mm solid ${C.accent}` }}>
          <span style={{ fontSize: "4mm", fontWeight: 700, color: C.navy }}>{c.courseName}</span>
          <span style={{ fontSize: "3.2mm", color: C.muted }}>{c.level}</span>
        </div>

        <div style={{ marginTop: "8mm", display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: "6mm", alignItems: "end", borderTop: `0.3mm solid ${C.line}`, paddingTop: "6mm" }}>
          <div>
            <Signature c={c} color={C.navy} width={42} />
            <div style={{ height: "0.3mm", background: C.ink, width: "55mm" }} />
            <div style={{ fontSize: "3.6mm", fontWeight: 700, marginTop: "1.5mm" }}>{c.signerName}</div>
            <div style={{ fontSize: "2.4mm", letterSpacing: "0.18em", textTransform: "uppercase", color: C.muted }}>{c.signerRole}</div>
          </div>
          <Field label="Fecha de emisión" value={c.issueDate} labelColor={C.accent} valueColor={C.ink} align="left" />
          <Field label="Carga · Modalidad" value={joinParts(c.hours, c.modality)} labelColor={C.accent} valueColor={C.ink} align="left" />
          <Field label="Código" value={c.code} labelColor={C.accent} valueColor={C.ink} align="left" />
        </div>
      </section>
    </A4Sheet>
  );
}

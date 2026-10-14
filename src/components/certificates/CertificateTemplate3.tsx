import { joinParts, withPlaceholders, type CertificateData } from "./certificate-data";
import { cormorant, greatVibes, montserrat } from "./fonts";
import { A4Sheet, Logo, QrPlaceholder, Signature } from "./parts";

/**
 * PLANTILLA 3 — Lujo minimalista (marfil, oro envejecido y negro cálido).
 * Casi solo tipografía: título en versalitas muy espaciadas, nombre en
 * caligrafía, un filete dorado fino y mucho blanco. El sello es un monograma
 * pequeño y discreto. Para reconocimientos, apreciación y marcas premium.
 */
const C = { paper: "#FBF8F1", gold: "#9C7C3C", goldSoft: "#CDB37A", ink: "#2A2622", muted: "#7A7166" };

export function CertificateTemplate3({ data }: { data: CertificateData }) {
  const c = withPlaceholders(data);
  const spaced = { letterSpacing: "0.42em", textTransform: "uppercase" as const };
  return (
    <A4Sheet style={{ background: C.paper, padding: "11mm" }} className={montserrat.className}>
      {/* Filete fino con esquinas redondeadas y degradado de oro */}
      <div style={{ position: "absolute", inset: "11mm", borderRadius: "4mm", padding: "0.45mm", background: `linear-gradient(120deg, ${C.gold}, ${C.goldSoft} 45%, ${C.gold} 70%, ${C.goldSoft})` }}>
        <div style={{ width: "100%", height: "100%", borderRadius: "3.6mm", background: C.paper }} />
      </div>

      <div style={{ position: "relative", height: "100%", padding: "16mm 28mm 12mm", display: "flex", flexDirection: "column", alignItems: "center", color: C.ink, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3mm", color: C.muted, fontSize: "2.8mm", ...spaced }}>
          <Logo c={c} size={9} color={C.paper} bg={C.gold} /> {c.academyName}
        </div>

        <div className={cormorant.className} style={{ fontSize: "16mm", fontWeight: 500, color: C.gold, marginTop: "9mm", lineHeight: 1, letterSpacing: "0.32em", paddingLeft: "0.32em" }}>CERTIFICADO</div>
        <div style={{ display: "flex", alignItems: "center", gap: "5mm", marginTop: "4mm" }}>
          <span style={{ width: "28mm", height: "0.3mm", background: C.goldSoft }} />
          <span style={{ fontSize: "3.4mm", color: C.gold, fontWeight: 600, ...spaced }}>{c.certificateType.replace(/^Certificado\s+/i, "")}</span>
          <span style={{ width: "28mm", height: "0.3mm", background: C.goldSoft }} />
        </div>

        <div style={{ fontSize: "2.8mm", color: C.muted, marginTop: "11mm", ...spaced }}>Tenemos el honor de otorgar este certificado a</div>
        <div className={greatVibes.className} style={{ fontSize: "19mm", color: C.ink, lineHeight: 1.2, marginTop: "1mm" }}>{c.studentName}</div>
        <p className={cormorant.className} style={{ fontSize: "4.6mm", fontStyle: "italic", color: C.muted, maxWidth: "175mm", lineHeight: 1.4, margin: "2mm 0 0" }}>
          {c.achievement}{c.achievement ? " — " : ""}<span style={{ color: C.ink, fontStyle: "normal", fontWeight: 600 }}>{c.courseName}</span>{c.level ? `, ${c.level}` : ""}.
        </p>

        <div style={{ marginTop: "auto", width: "100%", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end" }}>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: "2.3mm", color: C.gold, ...spaced, letterSpacing: "0.3em" }}>Fecha de emisión</div>
            <div className={cormorant.className} style={{ fontSize: "4.4mm", marginTop: "1mm" }}>{c.issueDate}</div>
            <div style={{ fontSize: "2.3mm", color: C.muted, marginTop: "2.5mm", letterSpacing: "0.12em" }}>{joinParts(c.hours, c.modality, `Nº ${c.code}`)}</div>
          </div>

          {/* Monograma discreto */}
          <svg viewBox="0 0 100 100" style={{ width: "24mm", height: "24mm" }} aria-label="[SELLO DE VERIFICACIÓN]">
            <circle cx="50" cy="50" r="47" fill="none" stroke={C.gold} strokeWidth="0.8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={C.gold} strokeWidth="0.4" strokeDasharray="1 2" />
            <text x="50" y="57" textAnchor="middle" fontSize="22" fill={C.gold} fontFamily="Georgia, serif" letterSpacing="1">{c.initials}</text>
            <text x="50" y="74" textAnchor="middle" fontSize="5.5" fill={C.gold} letterSpacing="1.6">VERIFICADO</text>
          </svg>

          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: "5mm" }}>
            <div style={{ textAlign: "center" }}>
              <Signature c={c} color={C.ink} width={42} />
              <div style={{ width: "52mm", height: "0.3mm", background: C.gold }} />
              <div className={cormorant.className} style={{ fontSize: "4.2mm", fontWeight: 600, marginTop: "1.5mm" }}>{c.signerName}</div>
              <div style={{ fontSize: "2.2mm", color: C.muted, ...spaced, letterSpacing: "0.28em" }}>{c.signerRole}</div>
            </div>
            <QrPlaceholder size={15} color={C.ink} svg={c.qrSvg} />
          </div>
        </div>
      </div>
    </A4Sheet>
  );
}

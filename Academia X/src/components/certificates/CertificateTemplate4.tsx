import { joinParts, withPlaceholders, type CertificateData } from "./certificate-data";
import { cinzel, cormorant, montserrat, playfair } from "./fonts";
import { A4Sheet, Field, Logo, QrPlaceholder, RosetteSeal, Signature } from "./parts";

/**
 * PLANTILLA 4 — Académico premium decorado (azul noche, oro y guilloché).
 * Borde con patrón guilloché (detalle de seguridad tipo documento oficial),
 * birrete en marca de agua, banda de datos inferior y sello dorado grande
 * superpuesto al borde. La más "documento oficial" de las cuatro.
 */
const C = { navy: "#122447", navyMid: "#1C3566", gold: "#B8913E", goldLight: "#E3C77F", ink: "#15213A", muted: "#56627A", paper: "#FFFDF8" };

/** Patrón guilloché (ondas entrelazadas) para el borde, 100 % vectorial. */
function Guilloche() {
  const waves = Array.from({ length: 6 }, (_, k) => {
    let d = "";
    for (let x = 0; x <= 400; x += 2) {
      const y = 10 + Math.sin((x / 400) * Math.PI * 24 + k * 0.9) * 6 * Math.cos((x / 400) * Math.PI * 2 + k);
      d += `${x === 0 ? "M" : "L"}${x},${y.toFixed(2)} `;
    }
    return <path key={k} d={d} fill="none" stroke={C.goldLight} strokeWidth="0.35" opacity={0.55} />;
  });
  return (
    <svg viewBox="0 0 400 20" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }} aria-hidden>
      {waves}
    </svg>
  );
}

export function CertificateTemplate4({ data }: { data: CertificateData }) {
  const c = withPlaceholders(data);
  const band = (style: React.CSSProperties, vertical = false) => (
    <div style={{ position: "absolute", overflow: "hidden", ...style }}>
      <div style={vertical ? { width: "210mm", height: "8mm", transform: "rotate(90deg) translateY(-8mm)", transformOrigin: "0 0" } : { width: "100%", height: "100%" }}>
        <Guilloche />
      </div>
    </div>
  );
  return (
    <A4Sheet style={{ background: C.navy }} className={montserrat.className}>
      {band({ left: 0, right: 0, top: "1mm", height: "8mm" })}
      {band({ left: 0, right: 0, bottom: "1mm", height: "8mm" })}
      {band({ top: 0, bottom: 0, left: "1mm", width: "8mm" }, true)}
      {band({ top: 0, bottom: 0, right: "1mm", width: "8mm" }, true)}

      <div style={{ position: "absolute", inset: "11mm", background: C.paper, border: `0.8mm solid ${C.gold}`, outline: `0.3mm solid ${C.goldLight}`, outlineOffset: "-2.5mm" }}>
        {/* Marca de agua: birrete */}
        <svg viewBox="0 0 200 140" style={{ position: "absolute", left: "50%", top: "52%", width: "120mm", transform: "translate(-50%,-50%)", opacity: 0.045 }} aria-hidden>
          <polygon points="100,10 196,50 100,90 4,50" fill={C.navy} />
          <path d="M44 70 V108 Q100 138 156 108 V70 L100 94 Z" fill={C.navy} />
          <line x1="172" y1="60" x2="172" y2="112" stroke={C.navy} strokeWidth="4" />
        </svg>

        <div style={{ position: "relative", height: "100%", padding: "11mm 22mm 0", display: "flex", flexDirection: "column", alignItems: "center", color: C.ink, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "3.5mm" }}>
            <Logo c={c} size={12} color={C.goldLight} bg={C.navy} />
            <div className={cinzel.className} style={{ fontSize: "4.4mm", letterSpacing: "0.22em", color: C.navy, fontWeight: 700 }}>{c.academyName}</div>
          </div>

          <div className={cinzel.className} style={{ fontSize: "11.5mm", fontWeight: 600, color: C.navy, marginTop: "auto", lineHeight: 1, letterSpacing: "0.04em" }}>{c.certificateType}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "3mm", marginTop: "3.5mm", color: C.gold }}>
            <span style={{ width: "18mm", height: "0.3mm", background: C.gold }} />◆<span style={{ width: "18mm", height: "0.3mm", background: C.gold }} />
          </div>

          <div style={{ fontSize: "3.2mm", color: C.muted, marginTop: "5mm" }}>Se certifica que</div>
          <div className={playfair.className} style={{ fontSize: "12mm", fontStyle: "italic", color: C.navy, lineHeight: 1.2, marginTop: "1mm" }}>{c.studentName}</div>
          <div style={{ width: "170mm", height: "0.3mm", background: C.navy, opacity: 0.6 }} />

          <p className={cormorant.className} style={{ fontSize: "4.6mm", lineHeight: 1.4, maxWidth: "200mm", margin: "4mm 0 0" }}>
            {c.achievement}
          </p>
          <div className={cinzel.className} style={{ fontSize: "4.4mm", color: C.navy, fontWeight: 700, marginTop: "2.5mm", letterSpacing: "0.06em" }}>{c.courseName}</div>
          <div style={{ fontSize: "3mm", color: C.gold, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: "1mm", marginBottom: "auto" }}>{c.level}</div>

          {/* Banda de datos y firma */}
          <div style={{ marginTop: "6mm", width: "calc(100% + 44mm)", background: "#F4F1E8", borderTop: `0.4mm solid ${C.goldLight}`, padding: "5mm 22mm 6mm", display: "grid", gridTemplateColumns: "0.9fr 0.7fr 1.3fr 1.5fr", gap: "6mm", alignItems: "end" }}>
            <Field label="Carga horaria" value={c.hours} labelColor={C.gold} valueColor={C.ink} />
            <Field label="Modalidad" value={c.modality} labelColor={C.gold} valueColor={C.ink} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Signature c={c} color={C.navy} width={40} />
              <div style={{ width: "54mm", height: "0.3mm", background: C.ink }} />
              <div style={{ fontSize: "3.4mm", fontWeight: 700, marginTop: "1.2mm" }}>{c.signerName}</div>
              <div style={{ fontSize: "2.3mm", letterSpacing: "0.2em", textTransform: "uppercase", color: C.muted }}>{c.signerRole}</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "3mm" }}>
              <div style={{ textAlign: "left", display: "grid", gap: "2mm" }}>
                <Field label="Emisión" value={c.issueDate} labelColor={C.gold} valueColor={C.ink} align="left" />
                <Field label="Código" value={c.code} labelColor={C.gold} valueColor={C.ink} align="left" />
              </div>
              <QrPlaceholder size={15} color={C.navy} svg={c.qrSvg} />
            </div>
          </div>
        </div>
      </div>

      {/* Sello grande superpuesto al borde (arriba a la derecha) */}
      <div style={{ position: "absolute", right: "16mm", top: "4mm" }}>
        <RosetteSeal size={34} ring={C.gold} fill={C.navyMid} text={c.sealText} textColor={C.goldLight} label="PREMIUM" ribbons />
      </div>
    </A4Sheet>
  );
}

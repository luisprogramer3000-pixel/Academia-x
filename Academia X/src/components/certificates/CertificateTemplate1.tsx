import { joinParts, withPlaceholders, type CertificateData } from "./certificate-data";
import { cinzel, cormorant, greatVibes, montserrat } from "./fonts";
import { A4Sheet, Field, Logo, QrPlaceholder, RosetteSeal, Signature } from "./parts";

/**
 * PLANTILLA 1 — Clásico premium (borgoña y oro).
 * Ceremonial y sobrio: marco doble con esquinas en ángulo, laurel tenue de
 * marca de agua, sello dentado con cintas como pieza central. Composición
 * simétrica; el nombre en caligrafía es el protagonista.
 */
const C = { wine: "#6B1424", wineDeep: "#4A0E19", gold: "#B08D3C", goldLight: "#D9BE7A", ink: "#2B2024", muted: "#6E5F62", paper: "#FCFAF5" };

function Laurel({ side }: { side: "left" | "right" }) {
  const leaves = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    const x = 40 - Math.sin(t * Math.PI * 0.9) * 26;
    const y = 180 - t * 160;
    const rot = -30 - t * 40;
    return <ellipse key={i} cx={x} cy={y} rx="9" ry="3.6" transform={`rotate(${rot} ${x} ${y})`} />;
  });
  return (
    <svg viewBox="0 0 80 200" style={{ width: "30mm", height: "75mm", transform: side === "right" ? "scaleX(-1)" : undefined }} aria-hidden>
      <path d="M40 195 Q 0 110 38 15" fill="none" stroke={C.gold} strokeWidth="1.4" opacity={0.5} />
      <g fill={C.gold} opacity={0.18}>{leaves}</g>
    </svg>
  );
}

export function CertificateTemplate1({ data }: { data: CertificateData }) {
  const c = withPlaceholders(data);
  const corner = (rot: number, pos: React.CSSProperties) => (
    <svg viewBox="0 0 40 40" style={{ position: "absolute", width: "16mm", height: "16mm", transform: `rotate(${rot}deg)`, ...pos }} aria-hidden>
      <path d="M2 38 V2 H38" fill="none" stroke={C.gold} strokeWidth="2" />
      <path d="M8 38 V8 H38" fill="none" stroke={C.gold} strokeWidth="0.8" />
      <rect x="0" y="0" width="6" height="6" fill={C.gold} />
    </svg>
  );
  return (
    <A4Sheet style={{ background: C.wine, padding: "7mm" }} className={montserrat.className}>
      <div style={{ position: "absolute", inset: "7mm", border: `0.6mm solid ${C.gold}` }} />
      <div style={{ position: "relative", height: "100%", background: C.paper, margin: "2.5mm", padding: "12mm 22mm 10mm", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: `inset 0 0 0 0.3mm ${C.goldLight}` }}>
        {corner(0, { left: "3mm", top: "3mm" })}
        {corner(90, { right: "3mm", top: "3mm" })}
        {corner(270, { left: "3mm", bottom: "3mm" })}
        {corner(180, { right: "3mm", bottom: "3mm" })}
        <div style={{ position: "absolute", left: "8mm", top: "50%", transform: "translateY(-50%)" }}><Laurel side="left" /></div>
        <div style={{ position: "absolute", right: "8mm", top: "50%", transform: "translateY(-50%)" }}><Laurel side="right" /></div>

        <div style={{ display: "flex", alignItems: "center", gap: "4mm" }}>
          <Logo c={c} size={13} color={C.paper} bg={C.wine} />
          <div className={cinzel.className} style={{ fontSize: "4.6mm", letterSpacing: "0.28em", color: C.wine, fontWeight: 700 }}>{c.academyName}</div>
        </div>
        <div style={{ width: "60mm", height: "0.3mm", background: C.gold, margin: "5mm 0 4mm" }} />

        <div className={cinzel.className} style={{ fontSize: "12.5mm", lineHeight: 1, color: C.wine, fontWeight: 700, letterSpacing: "0.06em", marginTop: "auto" }}>{c.certificateType}</div>
        <div className={cormorant.className} style={{ fontSize: "5mm", fontStyle: "italic", color: C.muted, marginTop: "4mm" }}>se otorga con distinción a</div>

        <div className={greatVibes.className} style={{ fontSize: "17mm", color: C.ink, lineHeight: 1.15, marginTop: "1mm", textAlign: "center" }}>{c.studentName}</div>
        <div style={{ width: "150mm", height: "0.3mm", background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)` }} />

        <p className={cormorant.className} style={{ fontSize: "4.8mm", color: C.ink, textAlign: "center", maxWidth: "190mm", margin: "5mm 0 auto", lineHeight: 1.4 }}>
          {c.achievement} <strong style={{ color: C.wine }}>{c.courseName}</strong>{c.level ? ` — ${c.level}` : ""}.
        </p>

        <div style={{ marginTop: "6mm", width: "100%", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "end", gap: "8mm" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Signature c={c} color={C.ink} />
            <div style={{ width: "60mm", height: "0.3mm", background: C.ink }} />
            <div className={cormorant.className} style={{ fontSize: "4.4mm", fontWeight: 700, color: C.ink, marginTop: "1.5mm" }}>{c.signerName}</div>
            <div style={{ fontSize: "2.4mm", letterSpacing: "0.22em", textTransform: "uppercase", color: C.muted }}>{c.signerRole}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "-4mm" }}>
            <RosetteSeal size={30} ring={C.gold} fill={C.wine} text={c.sealText} textColor={C.goldLight} label="VERIFICADO" ribbons />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "5mm" }}>
            <div style={{ display: "grid", gap: "2.5mm" }}>
              <Field label="Fecha de emisión" value={c.issueDate} labelColor={C.gold} valueColor={C.ink} align="left" />
              <Field label="Carga horaria · Modalidad" value={joinParts(c.hours, c.modality)} labelColor={C.gold} valueColor={C.ink} align="left" />
              <Field label="Código" value={c.code} labelColor={C.gold} valueColor={C.ink} align="left" />
            </div>
            <QrPlaceholder size={18} color={C.wineDeep} svg={c.qrSvg} />
          </div>
        </div>
      </div>
    </A4Sheet>
  );
}

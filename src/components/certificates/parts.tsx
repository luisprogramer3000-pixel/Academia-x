import type { CSSProperties, ReactNode } from "react";
import type { ResolvedCertificate } from "./certificate-data";

/** Hoja A4 horizontal (297 × 210 mm): se imprime 1:1 y en pantalla se escala con CertificateFrame. */
export function A4Sheet({ children, style, className = "" }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div
      className={`certificate-sheet relative overflow-hidden ${className}`}
      style={{ width: "297mm", height: "210mm", boxSizing: "border-box", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", ...style }}
    >
      {children}
    </div>
  );
}

/** Logo de la academia o sus iniciales en un círculo. */
export function Logo({ c, size = 16, color, bg }: { c: ResolvedCertificate; size?: number; color: string; bg: string }) {
  const s = `${size}mm`;
  if (c.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={c.logoUrl} alt={c.academyName} style={{ width: s, height: s, objectFit: "contain" }} />;
  }
  return (
    <div style={{ width: s, height: s, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: `${size * 0.36}mm`, letterSpacing: "0.05em" }}>
      {c.initials}
    </div>
  );
}

/** Firma: imagen si existe; si no, un trazo manuscrito de ejemplo (SVG). */
export function Signature({ c, color, width = 46 }: { c: ResolvedCertificate; color: string; width?: number }) {
  // Certificado real sin firma escaneada: espacio en blanco (nunca una firma inventada)
  if (!c.signatureUrl && c.real) return <div style={{ width: `${width}mm`, height: `${width * 0.35}mm` }} />;
  if (c.signatureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={c.signatureUrl} alt={`Firma de ${c.signerName}`} style={{ width: `${width}mm`, height: `${width * 0.35}mm`, objectFit: "contain" }} />;
  }
  return (
    <svg viewBox="0 0 200 70" style={{ width: `${width}mm`, height: `${width * 0.35}mm` }} aria-label="[FIRMA]">
      <path d="M12 52 C 30 10, 48 8, 44 40 S 60 70, 78 30 S 96 18, 100 44 C 104 60, 118 22, 132 34 S 150 52, 168 26 M 120 50 L 190 30" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Sello dentado con texto circular (insignia de verificación), totalmente vectorial. */
export function RosetteSeal({ size = 34, ring, fill, text, textColor, label, ribbons = false }: { size?: number; ring: string; fill: string; text: string; textColor: string; label: string; ribbons?: boolean }) {
  const teeth = 32;
  const pts = Array.from({ length: teeth * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 98 : 90;
    const a = (Math.PI * i) / teeth;
    return `${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`;
  }).join(" ");
  const id = `arc-${label.replace(/\W+/g, "")}-${size}`;
  return (
    <svg viewBox="0 0 200 240" style={{ width: `${size}mm`, height: `${size * 1.2}mm` }} aria-label="[SELLO DE VERIFICACIÓN]">
      {ribbons && (
        <g>
          <path d="M70 150 L52 236 L74 222 L88 240 L100 160 Z" fill={ring} />
          <path d="M130 150 L148 236 L126 222 L112 240 L100 160 Z" fill={ring} opacity={0.85} />
        </g>
      )}
      <polygon points={pts} fill={ring} />
      <circle cx="100" cy="100" r="80" fill={fill} />
      <circle cx="100" cy="100" r="74" fill="none" stroke={ring} strokeWidth="1.5" />
      <circle cx="100" cy="100" r="50" fill="none" stroke={ring} strokeWidth="1" opacity={0.7} />
      <defs>
        <path id={id} d="M 100,100 m -62,0 a 62,62 0 1,1 124,0 a 62,62 0 1,1 -124,0" />
      </defs>
      <text fontSize="11" fill={textColor} fontWeight={600}>
        <textPath href={`#${id}`} startOffset="0" textLength="384" lengthAdjust="spacing">{`${text.toUpperCase()} · `.repeat(text.length > 22 ? 1 : 2)}</textPath>
      </text>
      <text x="100" y="96" textAnchor="middle" fontSize="15" fill={textColor} fontWeight={700} letterSpacing="1">★ ★ ★</text>
      <text x="100" y="118" textAnchor="middle" fontSize="13" fill={textColor} fontWeight={700} letterSpacing="2">{label}</text>
    </svg>
  );
}

/**
 * Espacio para el QR de validación. Patrón ilustrativo (no escaneable):
 * al conectar datos reales se sustituye por un QR generado con verifyUrl.
 */
export function QrPlaceholder({ size = 20, color, bg = "transparent", svg }: { size?: number; color: string; bg?: string; svg?: string | null }) {
  if (svg) {
    // QR real generado en el servidor (SVG de la librería qrcode, sin scripts)
    return <div aria-label="QR de verificación" style={{ width: `${size}mm`, height: `${size}mm`, background: "#fff", lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", '<svg width="100%" height="100%" ') }} />;
  }
  const n = 21;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const finder = (x: number, y: number) => x < 7 && y < 7 ? true : x >= n - 7 && y < 7 ? true : x < 7 && y >= n - 7;
  const cells: ReactNode[] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue;
    if (rnd() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
  }
  const eye = (x: number, y: number) => (
    <g key={`e${x}${y}`}>
      <rect x={x} y={y} width="7" height="7" fill={color} />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill={bg === "transparent" ? "#fff" : bg} />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill={color} />
    </g>
  );
  return (
    <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} style={{ width: `${size}mm`, height: `${size}mm`, background: bg === "transparent" ? "#fff" : bg }} aria-label="[QR]" shapeRendering="crispEdges">
      <g fill={color}>{cells}</g>
      {eye(0, 0)}{eye(n - 7, 0)}{eye(0, n - 7)}
    </svg>
  );
}

/** Dato con etiqueta (Carga horaria, Modalidad, Código…). */
export function Field({ label, value, labelColor, valueColor, align = "center", font }: { label: string; value: string; labelColor: string; valueColor: string; align?: "left" | "center" | "right"; font?: string }) {
  if (!value || !value.trim()) return null;
  return (
    <div style={{ textAlign: align }}>
      <div style={{ fontSize: "2.3mm", letterSpacing: "0.22em", textTransform: "uppercase", color: labelColor, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: "3.4mm", color: valueColor, marginTop: "1mm", fontWeight: 500, fontFamily: font }}>{value}</div>
    </div>
  );
}

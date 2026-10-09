"use client";

import { useEffect, useRef, useState } from "react";
import type { ScriptSlide } from "@/modules/presentation/photo-deck/script";
import {
  INK, MUTED, PHOTO_X, SLIDE_H, SLIDE_W, TEXT_W, TEXT_X, contentLayout, coverTitleSize, splitHighlights, type DeckColors,
} from "@/modules/presentation/photo-deck/layout";

/** 100 px por pulgada: la diapositiva mide 1333 × 750 px antes de escalarla. */
const PX = 100;
const pt = (n: number) => (n * PX) / 72;
const FONT_STACK = "'Segoe UI', 'Segoe UI Web', system-ui, -apple-system, sans-serif";

function Highlighted({ text, accent }: { text: string; accent: string }) {
  return (
    <>
      {splitHighlights(text).map((p, i) =>
        p.hl ? <strong key={i} style={{ color: `#${accent}`, fontWeight: 700 }}>{p.text}</strong> : <span key={i}>{p.text}</span>
      )}
    </>
  );
}

/**
 * Vista previa de una diapositiva con el mismo diseño que el PowerPoint
 * (mismas medidas, colores y tamaños de letra: src/modules/presentation/photo-deck/layout.ts).
 */
export function SlidePreview({ slide, index, colors, academyName }: { slide: ScriptSlide; index: number; colors: DeckColors; academyName: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const fit = () => setScale((box.current?.clientWidth ?? SLIDE_W * PX) / (SLIDE_W * PX));
    fit();
    const ro = new ResizeObserver(fit);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const W = SLIDE_W * PX;
  const H = SLIDE_H * PX;

  return (
    <div ref={box} className="w-full rounded-xl overflow-hidden shadow-lg border border-slate-800" style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}` }}>
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative", fontFamily: FONT_STACK, background: "#FFFFFF" }}>
        {slide.type === "cover" ? <Cover slide={slide} colors={colors} academyName={academyName} /> : <Content slide={slide} index={index} colors={colors} academyName={academyName} />}
      </div>
    </div>
  );
}

function Photo({ url, left, width, tint }: { url?: string; left: number; width: number; tint: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" style={{ position: "absolute", left, top: 0, width, height: SLIDE_H * PX, objectFit: "cover" }} />
  ) : (
    <div style={{ position: "absolute", left, top: 0, width, height: SLIDE_H * PX, background: `#${tint}` }} />
  );
}

function Cover({ slide, colors, academyName }: { slide: ScriptSlide; colors: DeckColors; academyName: string }) {
  const x = TEXT_X * PX;
  return (
    <>
      <Photo url={slide.imageUrl} left={0} width={SLIDE_W * PX} tint={colors.title} />
      {slide.imageUrl && (
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(11,18,32,.82) 0%, rgba(11,18,32,.6) 45%, rgba(11,18,32,.12) 75%, rgba(11,18,32,0) 100%)" }} />
      )}
      <div style={{ position: "absolute", left: x, top: 0.55 * PX, color: "#fff", fontSize: pt(13), fontWeight: 700, letterSpacing: "0.2em" }}>{academyName.toUpperCase()}</div>
      <div style={{ position: "absolute", left: x, top: 2.35 * PX, width: 1.1 * PX, height: 0.09 * PX, background: `#${colors.accent}` }} />
      <div style={{ position: "absolute", left: x, top: 2.6 * PX, width: 7.4 * PX, color: "#fff", fontSize: pt(coverTitleSize(slide.title)), fontWeight: 700, lineHeight: 1.12 }}>{slide.title}</div>
      {slide.text && (
        <div style={{ position: "absolute", left: x, top: 5.35 * PX, width: 7.2 * PX, color: "#E5E7EB", fontSize: pt(20) }}>{slide.text.replace(/\*\*/g, "")}</div>
      )}
    </>
  );
}

function Content({ slide, index, colors, academyName }: { slide: ScriptSlide; index: number; colors: DeckColors; academyName: string }) {
  const L = contentLayout(slide);
  const x = TEXT_X * PX;
  const w = TEXT_W * PX;
  const fs = pt(L.size);
  return (
    <>
      <Photo url={slide.imageUrl} left={PHOTO_X * PX} width={(SLIDE_W - PHOTO_X) * PX} tint={colors.tint} />
      <div style={{ position: "absolute", left: x, top: 0.5 * PX, width: w, color: `#${colors.title}`, fontSize: pt(L.titleSize), fontWeight: 700, lineHeight: 1.12 }}>{slide.title}</div>
      <div style={{ position: "absolute", left: x, top: L.bodyY * PX, width: w, height: L.bodyH * PX, overflow: "hidden", color: `#${INK}`, fontSize: fs, lineHeight: 1.3 }}>
        {L.paragraphs.map((p, i) => (
          <p key={i} style={{ margin: 0, marginBottom: pt(L.size * 0.45) }}><Highlighted text={p} accent={colors.accent} /></p>
        ))}
        {L.listHeading && <p style={{ margin: 0, marginBottom: pt(L.size * 0.3), fontWeight: 700, color: `#${colors.title}`, fontSize: pt(L.size + 1) }}>{L.listHeading}</p>}
        {slide.items.length > 0 &&
          (L.numbered ? (
            <ol style={{ margin: 0, paddingLeft: fs * 1.4 }}>
              {slide.items.map((it, i) => <li key={i} style={{ marginBottom: pt(L.size * 0.3) }}><Highlighted text={it} accent={colors.accent} /></li>)}
            </ol>
          ) : (
            <ul style={{ margin: 0, paddingLeft: fs * 1.25, listStyle: "disc" }}>
              {slide.items.map((it, i) => <li key={i} style={{ marginBottom: pt(L.size * 0.3) }}><Highlighted text={it} accent={colors.accent} /></li>)}
            </ul>
          ))}
      </div>
      <div style={{ position: "absolute", left: x, top: (SLIDE_H - 0.5) * PX, color: `#${MUTED}`, fontSize: pt(9) }}>{academyName} · {index}</div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Highlighter, MousePointer2, Pencil, Trash2, Type, Undo2 } from "lucide-react";

export type AnnotationTool = "pointer" | "pen" | "highlighter" | "text" | "eraser";

/**
 * Anotación con coordenadas normalizadas (0-1): se adapta a cualquier tamaño de pantalla.
 * Los textos usan `points[0]` como esquina superior izquierda.
 */
export interface Stroke {
  tool: "pen" | "highlighter" | "text";
  color: string;
  points: Array<[number, number]>;
  text?: string;
}

/** Tamaño de letra de los textos, relativo al ancho de la diapositiva */
const TEXT_SIZE = 0.03;

export const ANNOTATION_COLORS = ["#ef4444", "#2563eb", "#16a34a", "#f59e0b", "#a855f7", "#111827"];
const HIGHLIGHTER_DEFAULT = "#facc15";

/** Grosor relativo al ancho de la diapositiva */
const WIDTH = { pen: 0.0035, highlighter: 0.022, text: 0 };

/** Lienzo transparente sobre la diapositiva para dibujar en vivo. */
export function AnnotationCanvas({
  tool,
  color,
  strokes,
  onChange,
}: {
  tool: AnnotationTool;
  color: string;
  strokes: Stroke[];
  onChange: (next: Stroke[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    const all = drawing.current ? [...strokesRef.current, drawing.current] : strokesRef.current;
    for (const s of all) {
      if (!s.points.length) continue;
      if (s.tool === "text") {
        ctx.save();
        ctx.font = `700 ${TEXT_SIZE * width}px system-ui, "Segoe UI", sans-serif`;
        ctx.fillStyle = s.color;
        ctx.textBaseline = "top";
        ctx.fillText(s.text ?? "", s.points[0][0] * width, s.points[0][1] * height);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.lineCap = s.tool === "highlighter" ? "butt" : "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = s.color;
      ctx.lineWidth = WIDTH[s.tool] * width;
      // Fluorescente: semitransparente y "multiplicado" para que el texto de debajo se siga leyendo
      ctx.globalAlpha = s.tool === "highlighter" ? 0.4 : 1;
      ctx.globalCompositeOperation = s.tool === "highlighter" ? "multiply" : "source-over";
      ctx.beginPath();
      s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * width, y * height) : ctx.moveTo(x * width, y * height)));
      if (s.points.length === 1) ctx.lineTo(s.points[0][0] * width + 0.1, s.points[0][1] * height);
      ctx.stroke();
      ctx.restore();
    }
  };

  // Tamaño real del lienzo (nitidez en pantallas de alta densidad) y redibujado al cambiar de tamaño
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      redraw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(redraw, [strokes]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  const eraseAt = ([x, y]: [number, number]) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const radius = 14 / r.width;
    const aspect = r.height / r.width;
    const ctx = canvasRef.current!.getContext("2d")!;
    const next = strokesRef.current.filter((s) => {
      if (s.tool === "text") {
        // Caja del texto (ancho medido con la misma fuente con la que se dibuja)
        ctx.font = `700 ${TEXT_SIZE * r.width}px system-ui, "Segoe UI", sans-serif`;
        const w = ctx.measureText(s.text ?? "").width / r.width;
        const h = (TEXT_SIZE * 1.2 * r.width) / r.height;
        const [tx, ty] = s.points[0];
        return !(x >= tx - radius && x <= tx + w + radius && y >= ty - radius && y <= ty + h + radius);
      }
      return !s.points.some(([px, py]) => Math.hypot(px - x, (py - y) * aspect) < radius + WIDTH[s.tool] / 2);
    });
    if (next.length !== strokesRef.current.length) onChange(next);
  };

  // Texto en edición: posición normalizada y lo escrito
  const [editing, setEditing] = useState<{ x: number; y: number; value: string } | null>(null);
  const commitText = () => {
    if (editing?.value.trim()) onChange([...strokesRef.current, { tool: "text", color, points: [[editing.x, editing.y]], text: editing.value.trim() }]);
    setEditing(null);
  };

  const active = tool !== "pointer";

  return (
    <>
    {editing && (
      <input
        autoFocus
        value={editing.value}
        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commitText();
          if (e.key === "Escape") setEditing(null);
        }}
        onBlur={commitText}
        onClick={(e) => e.stopPropagation()}
        placeholder="Escribe…"
        className="absolute z-20 bg-white/80 border-b-2 outline-none font-bold px-0.5 min-w-[12cqw]"
        style={{
          left: `${editing.x * 100}%`,
          top: `${editing.y * 100}%`,
          fontSize: `${TEXT_SIZE * 100}cqw`,
          lineHeight: 1.1,
          color,
          borderColor: color,
          fontFamily: 'system-ui, "Segoe UI", sans-serif',
          width: `${Math.max(12, editing.value.length * TEXT_SIZE * 60 + 4)}cqw`,
          maxWidth: `${(1 - editing.x) * 100}%`,
        }}
      />
    )}
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-10"
      style={{
        pointerEvents: active ? "auto" : "none",
        touchAction: active ? "none" : "auto",
        cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : active ? "crosshair" : "default",
      }}
      onClick={(e) => active && e.stopPropagation()}
      onPointerDown={(e) => {
        if (!active) return;
        e.stopPropagation();
        if (tool === "text") {
          // Evita que el lienzo robe el foco al cuadro de texto que se va a abrir
          e.preventDefault();
          if (editing) commitText();
          const [x, y] = pos(e);
          setEditing({ x, y, value: "" });
          return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        if (tool === "eraser") {
          eraseAt(pos(e));
          drawing.current = { tool: "pen", color: "", points: [] };
          return;
        }
        drawing.current = { tool, color: tool === "highlighter" && !color ? HIGHLIGHTER_DEFAULT : color, points: [pos(e)] };
        redraw();
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        if (tool === "eraser") return eraseAt(pos(e));
        drawing.current.points.push(pos(e));
        redraw();
      }}
      onPointerUp={() => {
        const s = drawing.current;
        drawing.current = null;
        if (s && tool !== "eraser" && s.points.length) onChange([...strokesRef.current, s]);
      }}
      onPointerCancel={() => {
        drawing.current = null;
        redraw();
      }}
    />
    </>
  );
}

/** Barra vertical de herramientas junto a la diapositiva. */
export function AnnotationToolbar({
  tool,
  color,
  canUndo,
  onTool,
  onColor,
  onUndo,
  onClear,
}: {
  tool: AnnotationTool;
  color: string;
  canUndo: boolean;
  onTool: (t: AnnotationTool) => void;
  onColor: (c: string) => void;
  onUndo: () => void;
  onClear: () => void;
}) {
  const btn = (active: boolean) =>
    `w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-700 hover:text-white"}`;
  const tools: Array<{ id: AnnotationTool; label: string; icon: typeof Pencil; key: string }> = [
    { id: "pointer", label: "Cursor (navegar)", icon: MousePointer2, key: "V" },
    { id: "pen", label: "Lápiz", icon: Pencil, key: "P" },
    { id: "highlighter", label: "Marcador fluorescente", icon: Highlighter, key: "M" },
    { id: "text", label: "Añadir texto", icon: Type, key: "T" },
    { id: "eraser", label: "Borrador", icon: Eraser, key: "B" },
  ];
  const palette = tool === "highlighter" ? ["#facc15", "#4ade80", "#38bdf8", "#f472b6", "#fb923c", "#c084fc"] : ANNOTATION_COLORS;

  return (
    <div className="flex flex-col items-center gap-1.5 p-1.5 rounded-2xl bg-slate-800/95 border border-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
      {tools.map((t) => (
        <button key={t.id} type="button" onClick={() => onTool(t.id)} className={btn(tool === t.id)} title={`${t.label} (${t.key})`} aria-label={t.label} aria-pressed={tool === t.id}>
          <t.icon className="w-5 h-5" />
        </button>
      ))}

      {(tool === "pen" || tool === "highlighter" || tool === "text") && (
        <div className="flex flex-col gap-1.5 py-1.5 border-y border-slate-700 my-0.5">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColor(c)}
              className={`w-6 h-6 rounded-full mx-auto transition-transform ${color === c ? "ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110" : "hover:scale-110"}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      )}

      <button type="button" onClick={onUndo} disabled={!canUndo} className={`${btn(false)} disabled:opacity-30`} title="Deshacer (Ctrl+Z)" aria-label="Deshacer">
        <Undo2 className="w-5 h-5" />
      </button>
      <button type="button" onClick={onClear} disabled={!canUndo} className={`${btn(false)} disabled:opacity-30 hover:!text-rose-300`} title="Borrar todo en esta diapositiva" aria-label="Borrar todo">
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}

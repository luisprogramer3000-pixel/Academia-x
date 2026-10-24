import type { ImageElement, LineElement, NormBox, ResolvedAsset, ResolvedDesignSystem, ResolvedImage, ShapeElement, SlideElement, TextElement, TextRun } from "../types";
import { blend, readableOn } from "../design/color";
import { fitImageContain, inset, rectIntersects, TITLE_ZONE } from "./geometry";
import { fitText } from "./text-fit";
import { vectorIconFor } from "../vector-icons";

/**
 * Biblioteca de componentes: cada método añade elementos validables (no
 * escribe en PowerPoint). El tamaño de letra sale del motor de ajuste y el
 * color del texto se elige legible sobre su fondo inmediato.
 */

export interface TextOpts {
  max?: number;
  min?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: TextElement["align"];
  valign?: TextElement["valign"];
  font?: string;
  bullets?: boolean;
  /** Color del fondo inmediato (tarjeta); por defecto el fondo de la diapositiva */
  on?: string;
  group?: string;
  decorative?: boolean;
  runs?: TextRun[];
  lineSpacing?: number;
}

export class SlideBuilder {
  readonly elements: SlideElement[] = [];
  private groupSeq = 0;

  constructor(readonly d: ResolvedDesignSystem, readonly cover = false) {}

  get slideBg(): string {
    return this.cover && this.d.coverBackground ? this.d.coverBackground : this.d.colors.background;
  }

  newGroup(prefix = "g"): string {
    return `${prefix}${++this.groupSeq}`;
  }

  text(role: TextElement["role"], rawText: string, b: NormBox, o: TextOpts = {}): TextElement {
    // **x** resalta una parte (terminación, palabra clave) con el color principal
    const marked = !o.runs && rawText.includes("**");
    const text = marked ? rawText.replace(/\*\*/g, "") : rawText;
    if (marked) {
      const accent = readableOn(o.on ?? this.slideBg, [this.d.colors.primary, this.d.colors.text], 3);
      o = { ...o, runs: rawText.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => (p.startsWith("**") ? { text: p.slice(2, -2), bold: true, color: accent } : { text: p })) };
    }
    const font = o.font ?? (role === "title" || role === "subtitle" ? this.d.fonts.heading : this.d.fonts.body);
    const bg = o.on ?? this.slideBg;
    const defaults = {
      title: { max: this.d.sizes.title, min: Math.max(24, this.d.sizes.title - 10) },
      subtitle: { max: this.d.sizes.subtitle, min: 18 },
      body: { max: this.d.sizes.body, min: 16 },
      label: { max: this.d.sizes.small + 4, min: 14 },
      caption: { max: this.d.sizes.small, min: 12 },
      icon: { max: 60, min: 18 },
    }[role];
    const max = o.max ?? defaults.max;
    const min = Math.min(max, o.min ?? defaults.min);
    const fit = fitText(text, b.w * this.d.slide.widthIn, b.h * this.d.slide.heightIn, { font, max, min, bold: o.bold, bullets: o.bullets, lineSpacing: o.lineSpacing });
    const preferred = o.color ?? (role === "title" ? this.d.colors.title : this.d.colors.text);
    const el: TextElement = {
      kind: "text",
      role,
      text,
      runs: o.runs,
      box: b,
      fontSize: fit.fontSize,
      font,
      color: role === "icon" ? preferred : readableOn(bg, [preferred], role === "title" || fit.fontSize >= 24 ? 3 : 4.5),
      bold: o.bold,
      italic: o.italic,
      align: o.align ?? "left",
      valign: o.valign ?? "top",
      bullets: o.bullets,
      lineSpacing: o.lineSpacing,
      backgroundColor: bg,
      overflow: !fit.fits,
      group: o.group,
      decorative: o.decorative,
    };
    this.elements.push(el);
    return el;
  }

  /** Título de la diapositiva en la zona superior. */
  title(text: string, o: { box?: NormBox; align?: TextElement["align"]; color?: string; max?: number } = {}): TextElement {
    const align = o.align ?? this.d.titleAlign;
    return this.text("title", text, o.box ?? TITLE_ZONE, { bold: true, align, valign: "middle", color: o.color, max: o.max });
  }

  shape(shape: ShapeElement["shape"], b: NormBox, fill: string, o: Partial<Omit<ShapeElement, "kind" | "box" | "shape" | "fill">> = {}): ShapeElement {
    const el: ShapeElement = { kind: "shape", shape, box: b, fill, ...o };
    this.elements.push(el);
    return el;
  }

  /** Tarjeta: superficie redondeada. Devuelve el color efectivo (para el texto que lleve encima). */
  card(b: NormBox, o: { fill?: string; line?: string; group?: string; shadow?: boolean; radius?: number; transparency?: number } = {}): string {
    const fill = o.fill ?? this.d.colors.surface;
    const transparency = o.transparency ?? (fill === this.d.colors.surface ? this.d.surfaceTransparency : 0);
    this.shape("roundRect", b, fill, {
      radius: o.radius ?? this.d.radius.medium,
      transparency,
      line: o.line ? { color: o.line, width: 1.25 } : undefined,
      shadow: o.shadow ?? true,
      group: o.group,
    });
    return transparency ? blend(fill, this.slideBg, transparency) : fill;
  }

  /** Píldora con texto (etiquetas, categorías, palabras de un banco). */
  pill(text: string, b: NormBox, o: { fill?: string; color?: string; bold?: boolean; group?: string; max?: number } = {}): TextElement {
    const fill = o.fill ?? this.d.colors.primary;
    const group = o.group ?? this.newGroup("pill");
    this.shape("roundRect", b, fill, { radius: Math.min(b.h * this.d.slide.heightIn, 0.5) / 2, group });
    return this.text("label", text, inset(b, 0.006, 0), {
      on: fill, color: o.color ?? readableOn(fill, ["FFFFFF", this.d.colors.text]), bold: o.bold ?? true, align: "center", valign: "middle", group, max: o.max ?? this.d.sizes.small + 3,
    });
  }

  /**
   * Icono de un concepto, opcionalmente dentro de un círculo de color. Si hay
   * dibujo vectorial para el emoji se exporta ese (en el color de la academia);
   * si no, el propio emoji.
   */
  icon(emoji: string, area: NormBox, o: { circle?: string; group?: string } = {}): void {
    const group = o.group ?? this.newGroup("icon");
    // Cuadrado centrado en el área: el círculo nunca sale ovalado
    const side = Math.min(area.w * this.d.slide.widthIn, area.h * this.d.slide.heightIn);
    const w = side / this.d.slide.widthIn;
    const h = side / this.d.slide.heightIn;
    const b = { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
    if (o.circle) this.shape("ellipse", b, o.circle, { group });
    const bg = o.circle ?? this.slideBg;
    const sizePt = Math.min(b.w * this.d.slide.widthIn, b.h * this.d.slide.heightIn) * 72 * (o.circle ? 0.5 : 0.75);
    const svg = vectorIconFor(emoji);
    this.elements.push({
      kind: "text", role: "icon", text: emoji, box: b, fontSize: Math.max(14, Math.round(sizePt)), font: this.d.fonts.emoji,
      color: this.d.colors.text, align: "center", valign: "middle", group, backgroundColor: bg,
      vector: svg ? { svg, color: readableOn(bg, [this.d.colors.primary, this.d.colors.text], 3) } : undefined,
    });
  }

  /** Número o letra en un círculo. */
  badge(label: string, b: NormBox, fill: string, groupId?: string): void {
    const group = groupId ?? this.newGroup("badge");
    this.shape("ellipse", b, fill, { group });
    this.text("label", label, b, { on: fill, color: readableOn(fill, ["FFFFFF", "111827"]), bold: true, align: "center", valign: "middle", group, max: Math.round(b.h * this.d.slide.heightIn * 72 * 0.55), min: 12 });
  }

  image(img: ResolvedImage, area: NormBox, o: { fit?: "contain" | "cover"; relevance?: number; rounding?: boolean; group?: string; decorative?: boolean; alt?: string } = {}): ImageElement {
    const fit = o.fit ?? "contain";
    const placed = fit === "contain" ? fitImageContain(area, img.width, img.height, this.d) : area;
    const el: ImageElement = { kind: "image", image: img, box: placed, fit, rounding: o.rounding, relevance: o.relevance ?? 0.5, group: o.group, decorative: o.decorative, altText: o.alt };
    this.elements.push(el);
    return el;
  }

  /**
   * Visual de un recurso: imagen (si la hay) o su emoji en un círculo suave.
   * Devuelve false si no hay nada que mostrar (el layout puede reorganizarse).
   */
  visual(asset: ResolvedAsset | undefined, area: NormBox, o: { fit?: "contain" | "cover"; circle?: string; group?: string; rounding?: boolean } = {}): boolean {
    if (asset?.kind === "image" && asset.image) {
      this.image(asset.image, area, { fit: o.fit ?? "cover", relevance: asset.relevance, rounding: o.rounding ?? true, group: o.group, alt: asset.request.semanticQuery });
      return true;
    }
    if (asset?.emoji) {
      const side = Math.min(area.w * this.d.slide.widthIn, area.h * this.d.slide.heightIn);
      const w = side / this.d.slide.widthIn;
      const h = side / this.d.slide.heightIn;
      this.icon(asset.emoji, { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h }, { circle: o.circle ?? this.d.colors.surfaceAlt, group: o.group });
      return true;
    }
    return false;
  }

  line(from: { x: number; y: number }, to: { x: number; y: number }, color: string, width = 2, arrow = false): void {
    const el: LineElement = {
      kind: "line",
      from, to, color, width, arrow,
      box: { x: Math.min(from.x, to.x), y: Math.min(from.y, to.y), w: Math.abs(to.x - from.x), h: Math.abs(to.y - from.y) },
      decorative: true,
    };
    this.elements.push(el);
  }

  /** Pie discreto con el nombre de la academia (decorativo: puede ir fuera del área segura). */
  footer(text: string): void {
    const area = { x: 0.05, y: 0.94, w: 0.5, h: 0.05 };
    // No se pone sobre imágenes ni tarjetas
    if (!text || this.elements.some((e) => (e.kind === "image" || e.kind === "shape") && rectIntersects(e.box, area))) return;
    this.text("caption", text, area, { max: 11, min: 9, color: this.d.colors.mutedText, decorative: true });
  }
}

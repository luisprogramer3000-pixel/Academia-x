import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import type { DeckInput } from "./presentation.deck";
import type { LessonImage } from "./presentation.images";
import { splitInlineList } from "@/lib/inline-list";

/**
 * PDF de la lección como DOCUMENTO DE ESTUDIO (A4 vertical), no como diapositivas:
 * portada con ruta de aprendizaje y Nombre/Fecha, una sección por capítulo con
 * banda "01 / SECCIÓN", foto + frase clave, subtítulos, tablas con cabecera
 * oscura y filas alternas, recuadros de aviso, ejercicios con huecos y la clave
 * de respuestas al final de cada sección; pie con número de página.
 */

const W = 595.28;
const H = 841.89;
const M = 50;
const CW = W - M * 2;
const TOP = H - 50;
const BOTTOM = 62;

const NAVY = rgb(0.09, 0.2, 0.3);
const TEAL = rgb(0.07, 0.49, 0.5);
const TEXT = rgb(0.16, 0.2, 0.26);
const MUTED = rgb(0.4, 0.45, 0.52);
const ZEBRA = rgb(0.93, 0.96, 0.97);
const NOTE_BG = rgb(1, 0.965, 0.9);
const NOTE_BORDER = rgb(0.94, 0.79, 0.42);
const WHITE = rgb(1, 1, 1);

type Run = { text: string; bold: boolean };
type Node =
  | { kind: "heading"; text: string }
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[]; ordered: boolean }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "note"; text: string };

/** Las fuentes estándar solo admiten WinAnsi: se sustituyen símbolos y se quitan emojis. */
function clean(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/✓/g, "(v)")
    .replace(/[✕✗]/g, "(x)")
    .replace(/[^\x00-\xFF•·€]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function runsOf(text: string): Run[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith("**") && part.endsWith("**") ? { text: part.slice(2, -2), bold: true } : { text: part.replace(/\*([^*]+)\*/g, "$1"), bold: false }));
}

/** Recuadro de aviso: párrafo que empieza por un emoji (💡 ⚠️ 📌 ✨…) o por una etiqueta como "Recuerda:" */
const CALLOUT = /^(\p{Extended_Pictographic}|(consejo|atención|atencion|recuerda|nota|importante|pregunta clave|cuidado|tip)\s*:)/iu;

/** Texto de lección (formato ligero) → nodos de documento. */
function parse(text: string): Node[] {
  const nodes: Node[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  const isTable = (l: string) => (l.match(/\|/g) || []).length >= 2;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) { nodes.push({ kind: "heading", text: h[1] }); i++; continue; }
    if (isTable(line)) {
      const rows: string[][] = [];
      while (i < lines.length && isTable(lines[i].trim())) {
        const l = lines[i++].trim();
        if (/^\|?\s*:?-{2,}/.test(l)) continue;
        rows.push(l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
      }
      if (rows.length) nodes.push({ kind: "table", header: rows[0], rows: rows.slice(1) });
      continue;
    }
    if (/^([-*•]|\d+[.)])\s+/.test(line)) {
      let ordered = /^\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^([-*•]|\d+[.)])\s+/.test(lines[i].trim())) {
        // "- - texto" (viñeta duplicada por la IA) → "texto"
        const content = lines[i++].trim().replace(/^([-*•]|\d+[.)])\s+/, "").replace(/^[-*•]\s+/, "");
        // "1. Uno. 2. Dos. 3. Tres." en una sola línea → un punto por línea
        const inline = splitInlineList(content);
        if (inline) ordered = true;
        items.push(...(inline ?? [content]));
      }
      nodes.push({ kind: "list", items, ordered });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^#{1,4}\s/.test(l) || isTable(l) || /^([-*•]|\d+[.)])\s+/.test(l)) break;
      if (para.length && CALLOUT.test(l)) break;
      para.push(l);
      i++;
    }
    // Párrafo que en realidad es una enumeración ("1. … 2. … 3. …"): lista vertical
    const inline = splitInlineList(para.join(" "));
    if (inline) {
      nodes.push({ kind: "list", items: inline, ordered: true });
      continue;
    }
    // Cada línea se conserva (frases de ejemplo una debajo de otra, como en el texto original)
    const joined = para.join("\n");
    nodes.push(CALLOUT.test(joined) ? { kind: "note", text: joined.replace(/^\p{Extended_Pictographic}️?\s*/u, "").replace(/\n/g, " ") } : { kind: "p", text: joined });
  }
  return nodes;
}

interface Section {
  label: string;
  title: string;
  description?: string;
  blocks: DeckInput["blocks"];
}

export async function renderLessonDocument(
  input: { lessonTitle: string; courseTitle: string; academyName: string; level?: string | null; blocks: DeckInput["blocks"] },
  images: Map<string, LessonImage> = new Map()
): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(input.lessonTitle));
  pdf.setAuthor(clean(input.academyName));
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const embedded = new Map<string, PDFImage>();
  const embed = async (url?: string) => {
    if (!url) return null;
    const img = images.get(url);
    if (!img) return null;
    if (!embedded.has(url)) embedded.set(url, img.mime === "image/png" ? await pdf.embedPng(img.data) : await pdf.embedJpg(img.data));
    return embedded.get(url)!;
  };

  // ── Secciones: cada capítulo empieza en página nueva ──
  const intro: DeckInput["blocks"] = [];
  const sections: Section[] = [];
  for (const b of input.blocks) {
    if (b.type === "chapter") sections.push({ label: b.label || "Sección", title: b.title || "", description: b.content, blocks: [] });
    else if (sections.length) sections[sections.length - 1].blocks.push(b);
    else intro.push(b);
  }
  // Lecciones sin capítulos: el primer bloque con título es la introducción y el resto una sección
  if (!sections.length) {
    const first = intro.findIndex((b) => b.type === "text");
    const rest = intro.splice(first >= 0 ? first + 1 : 0);
    sections.push({ label: "Contenido", title: input.lessonTitle, blocks: rest });
  }
  const coverImageUrl = input.blocks.find((b) => b.type === "image" && b.url && images.has(b.url))?.url;

  // ── Motor de maquetación con saltos de página ──
  const cover = pdf.addPage([W, H]);
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y - h < BOTTOM) newPage();
  };

  /** Texto con negritas (**...**) repartido en líneas; devuelve la altura usada. */
  const drawRich = (text: string, opts: { x?: number; width?: number; size?: number; color?: RGB; font?: PDFFont; lineGap?: number; dryRun?: boolean; at?: { page: PDFPage; y: number } } = {}) => {
    const x0 = opts.x ?? M;
    const width = opts.width ?? CW;
    const size = opts.size ?? 11;
    const lh = size * (opts.lineGap ?? 1.45);
    // `glue`: la palabra va pegada a la anterior (p. ej. el punto tras una negrita: "**Hoy llueve**.")
    const words: Array<{ text: string; font: PDFFont; glue: boolean }> = [];
    let prevEndsWithSpace = true;
    for (const r of runsOf(text)) {
      const font = opts.font ?? (r.bold ? bold : regular);
      const parts = clean(r.text).split(" ").filter(Boolean);
      parts.forEach((w, i) => words.push({ text: w, font, glue: i === 0 && !prevEndsWithSpace && !/^\s/.test(r.text) && words.length > 0 }));
      if (parts.length) prevEndsWithSpace = /\s$/.test(r.text);
    }
    const spaceW = regular.widthOfTextAtSize(" ", size);
    const lines: Array<typeof words> = [];
    let line: typeof words = [];
    let lineW = 0;
    for (const w of words) {
      const ww = w.font.widthOfTextAtSize(w.text, size);
      const space = line.length && !w.glue ? spaceW : 0;
      if (line.length && !w.glue && lineW + space + ww > width) {
        lines.push(line);
        line = [];
        lineW = 0;
      }
      lineW += (line.length && !w.glue ? spaceW : 0) + ww;
      line.push(w);
    }
    if (line.length) lines.push(line);
    if (opts.dryRun) return lines.length * lh;

    for (const l of lines) {
      let target = opts.at?.page ?? page;
      let ly = opts.at ? opts.at.y : y;
      if (!opts.at) {
        ensure(lh);
        target = page;
        ly = y;
      }
      let x = x0;
      l.forEach((w, i) => {
        if (i > 0 && !w.glue) x += spaceW;
        target.drawText(w.text, { x, y: ly - size, size, font: w.font, color: opts.color ?? TEXT });
        x += w.font.widthOfTextAtSize(w.text, size);
      });
      if (opts.at) opts.at.y -= lh;
      else y -= lh;
    }
    return lines.length * lh;
  };

  const heading = (text: string, size = 13, color: RGB = TEAL) => {
    ensure(size * 3.2);
    y -= size * 0.6;
    drawRich(`**${text}**`, { size, color });
    y -= 4;
  };

  const note = (text: string) => {
    const pad = 10;
    const h = drawRich(text, { width: CW - pad * 2, size: 10, dryRun: true }) + pad * 2;
    ensure(h + 8);
    page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: NOTE_BG, borderColor: NOTE_BORDER, borderWidth: 0.8 });
    const at = { page, y: y - pad };
    const labelled = text.replace(/^([^:]{2,40}):/, "**$1:**");
    drawRich(labelled, { x: M + pad, width: CW - pad * 2, size: 10, at });
    y -= h + 10;
  };

  const table = (header: string[], rows: string[][]) => {
    const cols = header.length;
    const lens = header.map((h, c) => Math.max(clean(h).length, ...rows.map((r) => clean(r[c] ?? "").length)));
    const total = lens.reduce((a, b) => a + Math.max(b, 8), 0);
    const widths = lens.map((l) => Math.max(0.15, Math.max(l, 8) / total));
    const norm = widths.reduce((a, b) => a + b, 0);
    const colW = widths.map((w) => (w / norm) * CW);
    const pad = 7;
    const rowHeight = (cells: string[], size: number, font?: PDFFont) =>
      Math.max(...cells.map((c, i) => drawRich(c, { width: colW[i] - pad * 2, size, font, lineGap: 1.3, dryRun: true }))) + pad * 2;
    const drawRow = (cells: string[], isHeader: boolean, zebra: boolean) => {
      const size = isHeader ? 9.5 : 10;
      const h = rowHeight(cells, size, isHeader ? bold : undefined);
      ensure(h + (isHeader ? 30 : 0));
      if (isHeader) page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: NAVY });
      else if (zebra) page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: ZEBRA });
      let x = M;
      cells.forEach((c, i) => {
        drawRich(c, { x: x + pad, width: colW[i] - pad * 2, size, font: isHeader ? bold : undefined, color: isHeader ? WHITE : TEXT, lineGap: 1.3, at: { page, y: y - pad } });
        x += colW[i];
      });
      y -= h;
    };
    y -= 4;
    drawRow(header.map((h) => h.replace(/\*\*/g, "")), true, false);
    rows.forEach((r, i) => {
      const cells = Array.from({ length: cols }, (_, c) => r[c] ?? "");
      if (y - rowHeight(cells, 10) < BOTTOM) {
        newPage();
        drawRow(header.map((h) => h.replace(/\*\*/g, "")), true, false);
      }
      drawRow(cells, false, i % 2 === 0);
    });
    page.drawLine({ start: { x: M, y }, end: { x: M + CW, y }, thickness: 0.6, color: rgb(0.8, 0.84, 0.88) });
    y -= 14;
  };

  const renderText = (text: string) => {
    for (const n of parse(text)) {
      if (n.kind === "heading") heading(n.text, 12, NAVY);
      else if (n.kind === "p") { n.text.split("\n").forEach((line) => drawRich(line)); y -= 5; }
      else if (n.kind === "note") note(n.text);
      else if (n.kind === "table") table(n.header, n.rows);
      else if (n.kind === "list") {
        n.items.forEach((item, i) => {
          const marker = n.ordered ? `${i + 1}.` : "•";
          ensure(16);
          page.drawText(marker, { x: M + 2, y: y - 11, size: 11, font: n.ordered ? bold : regular, color: TEAL });
          drawRich(item, { x: M + 18, width: CW - 18 });
          y -= 2;
        });
        y -= 4;
      }
    }
  };

  /** Diálogo: burbujas alternadas con el nombre del personaje en su color */
  const DIALOGUE_COLORS = [
    { bg: rgb(0.86, 0.92, 1), border: rgb(0.38, 0.65, 0.98), name: rgb(0.15, 0.39, 0.92) },
    { bg: rgb(0.99, 0.91, 0.95), border: rgb(0.96, 0.45, 0.71), name: rgb(0.86, 0.15, 0.47) },
    { bg: rgb(0.86, 0.99, 0.91), border: rgb(0.29, 0.87, 0.5), name: rgb(0.09, 0.64, 0.29) },
    { bg: rgb(1, 0.95, 0.78), border: rgb(0.98, 0.75, 0.14), name: rgb(0.85, 0.47, 0.02) },
  ];
  const drawDialogue = (lines: Array<{ speaker: string; text: string; translation?: string }>) => {
    const speakers = [...new Set(lines.map((l) => l.speaker))];
    const bubbleW = CW * 0.78;
    const pad = 9;
    y -= 4;
    for (const l of lines) {
      const idx = speakers.indexOf(l.speaker);
      const c = DIALOGUE_COLORS[idx % DIALOGUE_COLORS.length];
      const x = idx % 2 === 1 ? M + CW - bubbleW : M;
      const inner = bubbleW - pad * 2;
      const hText = drawRich(l.text, { width: inner, size: 10.5, lineGap: 1.35, dryRun: true });
      const hTr = l.translation ? drawRich(l.translation, { width: inner, size: 9.5, font: italic, lineGap: 1.3, dryRun: true }) : 0;
      const h = 12 + hText + hTr + pad * 2;
      ensure(h + 8);
      page.drawRectangle({ x, y: y - h, width: bubbleW, height: h, color: c.bg, borderColor: c.border, borderWidth: 1 });
      page.drawText(clean(l.speaker), { x: x + pad, y: y - pad - 9, size: 9, font: bold, color: c.name });
      const at = { page, y: y - pad - 13 };
      drawRich(l.text, { x: x + pad, width: inner, size: 10.5, lineGap: 1.35, at });
      if (l.translation) drawRich(l.translation, { x: x + pad, width: inner, size: 9.5, font: italic, color: MUTED, lineGap: 1.3, at });
      y -= h + 6;
    }
    y -= 8;
  };

  const drawImage = async (url: string | undefined, caption?: string) => {
    const img = await embed(url);
    if (!img) return;
    const scale = Math.min(CW / img.width, 230 / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ensure(h + 24);
    page.drawImage(img, { x: M + (CW - w) / 2, y: y - h, width: w, height: h });
    y -= h + 6;
    if (caption) {
      drawRich(caption, { size: 9, color: MUTED, font: italic });
    }
    y -= 8;
  };

  // ── Secciones ──
  const sectionPages: Array<{ label: string; title: string; from: number; to: number }> = [];
  for (const [si, section] of sections.entries()) {
    newPage();
    const from = pdf.getPageCount();
    // Banda superior "01 / SECCIÓN"
    page.drawRectangle({ x: 0, y: H - 44, width: W, height: 44, color: NAVY });
    page.drawText(clean(`${String(si + 1).padStart(2, "0")} / ${section.label}`).toUpperCase(), { x: M, y: H - 28, size: 10, font: bold, color: WHITE });
    y = H - 62;
    drawRich(`**${section.title}**`, { size: 22, color: NAVY, lineGap: 1.2 });
    y -= 10;

    // Foto de la sección a la izquierda + frase clave a la derecha
    const firstImageIdx = section.blocks.findIndex((b) => b.type === "image" && b.url && images.has(b.url));
    const firstText = section.blocks.find((b) => b.type === "text");
    const img = firstImageIdx >= 0 ? await embed(section.blocks[firstImageIdx].url) : null;
    if (img) {
      const boxW = 200;
      const boxH = 128;
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, { x: M, y: y - h, width: w, height: h });
      const at = { page, y: y - 12 };
      // Frase clave junto a la foto: la descripción de la sección (o el primer párrafo)
      const lead = section.description || firstText?.content?.split(/\n{2,}/)[0] || section.blocks[firstImageIdx].title || "";
      if (lead) {
        const [first, ...rest] = lead.split(/(?<=[.!?])\s+/);
        drawRich(first.includes("**") ? first : `**${first}**`, { x: M + w + 18, width: CW - w - 18, size: 11.5, color: NAVY, at });
        if (rest.length) drawRich(rest.join(" "), { x: M + w + 18, width: CW - w - 18, size: 11, at });
      }
      y -= Math.max(h, y - at.y) + 18;
    } else if (section.description) {
      drawRich(section.description, { size: 11.5, color: NAVY });
      y -= 8;
    }

    // Contenido. Sin clave de respuestas: el PDF se reparte a los alumnos como tarea
    let exercise = 0;
    const L = ["a", "b", "c", "d", "e", "f"];
    for (const [bi, b] of section.blocks.entries()) {
      if (b.type === "image") {
        if (bi !== firstImageIdx) await drawImage(b.url, b.title);
      } else if (b.type === "text") {
        if (b.title) heading(b.title);
        if (b.content) renderText(b.content);
      } else if (b.type === "quiz" && b.question) {
        exercise++;
        const opts = b.options ?? [];
        ensure(40);
        drawRich(`**${exercise}.** ${b.question}`);
        // Una opción por línea, con casilla para marcar
        opts.forEach((o, i) => drawRich(`[   ]  ${L[i]}) ${o}`, { x: M + 16, width: CW - 16, size: 10.5, color: TEXT }));
        y -= 8;
      } else if (b.type === "practice" && b.question) {
        exercise++;
        // Producción ("Escribe tres oraciones…"): más líneas para escribir
        const lines = /\b(tres|3|varias|párrafo|texto|oraciones|frases)\b/i.test(b.question) ? 4 : 2;
        ensure(28 + lines * 18);
        drawRich(`**${exercise}.** ${b.question}`);
        for (let l = 0; l < lines; l++) {
          y -= 20;
          page.drawLine({ start: { x: M + 16, y }, end: { x: M + CW, y }, thickness: 0.6, color: rgb(0.55, 0.6, 0.66) });
        }
        y -= 14;
      } else if (b.type === "dialogue" && b.lines?.length) {
        drawDialogue(b.lines);
      } else if (b.type === "flashcards" && b.cards?.length) {
        table(["Término", "Significado"], b.cards.map((c) => [c.front, c.back]));
      } else if (b.type === "mindmap" && b.mindMap) {
        heading(b.title || b.mindMap.center);
        renderText(b.mindMap.branches.map((x) => `- **${x.label}:** ${x.children.join(", ")}`).join("\n"));
      }
    }
    sectionPages.push({ label: section.label, title: section.title, from, to: pdf.getPageCount() });
  }

  // ── Portada (se dibuja al final: necesita las páginas de cada sección) ──
  let cy = TOP + 8;
  cover.drawText(clean(`${input.academyName}  /  ${input.courseTitle || "Lección"}`).toUpperCase().slice(0, 90), { x: M, y: cy - 10, size: 9.5, font: bold, color: NAVY });
  cy -= 22;
  cover.drawRectangle({ x: M, y: cy, width: CW, height: 2.5, color: TEAL });
  cy -= 16;
  const at = { page: cover, y: cy };
  drawRich(`**${input.lessonTitle.toUpperCase()}**`, { size: 30, color: NAVY, lineGap: 1.15, at });
  const tags = [input.level, sections.length ? `${sections.length} secciones` : null, input.academyName].filter(Boolean).join("  •  ");
  at.y -= 4;
  drawRich(`**${tags.toUpperCase()}**`, { size: 9.5, color: TEAL, at });
  at.y -= 12;
  const heroImg = await embed(coverImageUrl);
  if (heroImg) {
    const scale = Math.min(CW / heroImg.width, 250 / heroImg.height);
    const w = heroImg.width * scale;
    const h = heroImg.height * scale;
    cover.drawImage(heroImg, { x: M + (CW - w) / 2, y: at.y - h, width: w, height: h });
    at.y -= h + 16;
  }
  const introText = intro.find((b) => b.type === "text");
  if (introText) {
    drawRich(`**${introText.title || "Lo que vas a aprender"}**`, { size: 15, color: NAVY, at });
    at.y -= 2;
    for (const n of parse(introText.content || "")) {
      if (n.kind === "p") drawRich(n.text, { size: 10.5, at });
      else if (n.kind === "list") n.items.forEach((it) => drawRich(`• ${it}`, { size: 10.5, x: M + 6, width: CW - 6, at }));
      if (at.y < 230) break;
    }
    at.y -= 8;
  }
  drawRich("**Tu ruta de aprendizaje**", { size: 12, color: TEAL, at });
  for (const s of sectionPages) {
    if (at.y < 130) break;
    const range = s.to > s.from ? `${String(s.from).padStart(2, "0")}-${String(s.to).padStart(2, "0")}` : String(s.from).padStart(2, "0");
    drawRich(`**${range}** ${s.label}: ${s.title}`, { size: 10.5, at });
  }
  at.y -= 10;
  cover.drawText("Nombre: __________________________   Fecha: ______________", { x: M, y: Math.min(at.y, 110), size: 10, font: bold, color: TEXT });
  cover.drawRectangle({ x: M, y: 52, width: CW, height: 2.5, color: TEAL });

  // ── Pie de página en las páginas interiores ──
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => {
    if (i === 0) return;
    p.drawLine({ start: { x: M, y: 44 }, end: { x: M + CW, y: 44 }, thickness: 0.8, color: TEAL });
    p.drawText(clean(`${input.academyName}  |  ${input.lessonTitle}`).toUpperCase().slice(0, 95), { x: M, y: 30, size: 7.5, font: regular, color: MUTED });
    const label = `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    p.drawText(label, { x: M + CW - regular.widthOfTextAtSize(label, 7.5), y: 30, size: 7.5, font: regular, color: MUTED });
  });

  return Buffer.from(await pdf.save());
}

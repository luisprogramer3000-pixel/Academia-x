import type { TextDensity } from "./presentation.themes";
import { splitInlineList } from "@/lib/inline-list";

/**
 * Guion de diapositivas de una lección: convierte sus bloques en diapositivas
 * según la densidad de texto elegida. Es código puro (sin librerías de
 * PowerPoint ni PDF) para poder usarlo también en la presentación en pantalla.
 */
export interface DeckSlide {
  kind: "cover" | "section" | "content" | "quiz" | "answer";
  title: string;
  body?: string;
  bullets?: string[];
  footnote?: string;
  /** URL de una imagen de la lección que acompaña a esta diapositiva */
  image?: string;
  /** Las viñetas eran una lista numerada en la lección */
  numbered?: boolean;
  /** Diálogo tipo libro de idiomas (en PowerPoint se muestra como viñetas "Nombre: texto") */
  dialogue?: Array<{ speaker: string; text: string; translation?: string }>;
  /** Pregunta de opción múltiple: opciones y (en la respuesta) la correcta, para dibujarlas como cajas */
  options?: string[];
  correct?: number;
  /** Tipo de diapositiva para decidir cuáles se quitan primero al ajustar el número total */
  role?: "teacher" | "practice" | "practice-answer" | "cards" | "image-only" | "link";
}

export interface DeckInput {
  lessonTitle: string;
  courseTitle: string;
  academyName: string;
  primaryColor: string;
  blocks: Array<{
    type: string;
    title?: string;
    content?: string;
    url?: string;
    question?: string;
    options?: string[];
    correctOptionIndex?: number;
    answer?: string;
    label?: string;
    cards?: Array<{ front: string; back: string }>;
    lines?: Array<{ speaker: string; text: string; translation?: string }>;
    mindMap?: { center: string; branches: Array<{ label: string; children: string[] }> };
  }>;
  /** Plan del profesor: se añade al final, solo en su copia */
  teacherPlan?: {
    objective?: string;
    prerequisites?: string[];
    classFlow?: Array<{ minute: number; durationMinutes: number; activity: string }>;
    homework?: string;
    teacherNotes?: string[];
  } | null;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export const DENSITY = {
  minimo: { maxChars: 240, maxBullets: 4, body: 22, bullet: 20, title: 32 },
  estandar: { maxChars: 520, maxBullets: 7, body: 16, bullet: 15, title: 26 },
  detallado: { maxChars: 950, maxBullets: 11, body: 13, bullet: 12, title: 24 },
} as const;

/** Color de marca en formato PPTX (sin almohadilla) */
export function normalizeHex(color: string): string {
  const hex = (color || "#2563EB").replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex.toUpperCase() : "2563EB";
}

const stripInline = (s: string) => s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*\s][^*]*)\*/g, "$1").trim();

/** Separa el texto de una lección (formato ligero) en párrafos y viñetas. */
function parseText(text: string): { paragraphs: string[]; bullets: string[]; numbered: boolean } {
  const paragraphs: string[] = [];
  const bullets: string[] = [];
  let numbered = false;
  let current: string[] = [];
  const flush = () => {
    if (!current.length) return;
    const joined = stripInline(current.join(" "));
    const inline = splitInlineList(joined);
    if (inline) {
      numbered = true;
      bullets.push(...inline);
    } else paragraphs.push(joined);
    current = [];
  };
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^\|?\s*:?-{2,}/.test(line)) continue; // separador de tabla
    if ((line.match(/\|/g) || []).length >= 2) {
      flush();
      const cells = line.replace(/^\||\|$/g, "").split("|").map((c) => stripInline(c)).filter(Boolean);
      if (cells.length) bullets.push(cells.join(" — "));
      continue;
    }
    const item = line.match(/^([-*•]|\d+[.)])\s+(.*)$/);
    if (item) {
      flush();
      if (/^\d/.test(item[1])) numbered = true;
      const content = stripInline(item[2]);
      // "1. Uno. 2. Dos." en una sola línea de lista: lo previo al "2." es el primer punto
      const inline = splitInlineList(content);
      if (inline) numbered = true;
      bullets.push(...(inline ?? [content]));
      continue;
    }
    current.push(line.replace(/^#{1,4}\s+/, ""));
  }
  flush();
  return { paragraphs, bullets, numbered };
}

function firstSentences(text: string, max: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > max && out) break;
    out += s;
  }
  return out.trim().slice(0, max);
}

/** Parte un texto largo en trozos sin cortar párrafos por la mitad. */
function splitIntoChunks(paragraphs: string[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > maxChars && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? `${current}\n\n${p}` : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Construye el guion de diapositivas a partir de los bloques de la lección. */
export function buildDeck(input: DeckInput, density: TextDensity = "estandar"): DeckSlide[] {
  const d = DENSITY[density];
  const firstImage = input.blocks.find((b) => b.type === "image" && b.url)?.url;
  const slides: DeckSlide[] = [{ kind: "cover", title: input.lessonTitle, body: input.courseTitle, footnote: input.academyName, image: firstImage }];
  // Primera diapositiva generada por el último bloque de texto: ahí va su imagen
  let lastTextSlide = -1;

  for (const block of input.blocks) {
    if (block.type === "image" && block.url) {
      const target = slides[lastTextSlide];
      if (target && !target.image) target.image = block.url;
      else if (block.url !== firstImage || lastTextSlide >= 0) {
        slides.push({ kind: "content", title: block.title || "Imagen", image: block.url, role: "image-only" });
      }
      continue;
    }
    if (block.type === "text") lastTextSlide = slides.length;
    else if (block.type !== "image") lastTextSlide = -1;

    if (block.type === "chapter") {
      slides.push({ kind: "section", title: block.title || "Sección", body: density === "minimo" ? undefined : block.content, footnote: block.label });
      continue;
    }

    if (block.type === "text") {
      const { paragraphs, bullets, numbered } = parseText(block.content || "");
      if (!paragraphs.length && !bullets.length) continue;
      const title = block.title || "Contenido";

      if (density === "minimo") {
        // Solo lo esencial: una idea y los puntos clave
        const keyPoints = bullets.length ? bullets : paragraphs.slice(1).map((p) => firstSentences(p, 110));
        slides.push({
          kind: "content",
          title,
          body: paragraphs[0] ? firstSentences(paragraphs[0], d.maxChars) : undefined,
          bullets: keyPoints.slice(0, d.maxBullets),
          numbered: numbered && bullets.length > 0,
        });
        continue;
      }

      const textChunks = splitIntoChunks(paragraphs, d.maxChars);
      const bulletChunks = chunk(bullets, d.maxBullets);
      const total = Math.max(textChunks.length, bulletChunks.length, 1);
      for (let i = 0; i < total; i++) {
        slides.push({
          kind: "content",
          title: total > 1 ? `${title} (${i + 1}/${total})` : title,
          body: textChunks[i],
          bullets: bulletChunks[i],
          numbered,
        });
      }
      continue;
    }

    if (block.type === "quiz" && block.question) {
      const options = block.options || [];
      const question = stripInline(block.question);
      slides.push({ kind: "quiz", title: "Pregunta", body: question, bullets: options.map((opt, i) => `${LETTERS[i] || i + 1}. ${opt}`), options });
      const correct = block.correctOptionIndex ?? -1;
      if (options[correct]) {
        // Corrección: la misma pregunta con ✓ en la buena y ✕ en las demás
        slides.push({
          kind: "answer",
          title: "Respuesta",
          body: question,
          bullets: options.map((opt, i) => `${i === correct ? "✓" : "✕"} ${opt}`),
          options,
          correct,
        });
      }
      continue;
    }

    if (block.type === "practice" && block.question) {
      slides.push({ kind: "quiz", title: "Practica", body: stripInline(block.question), role: "practice" });
      if (block.answer) slides.push({ kind: "answer", title: "Respuesta modelo", body: stripInline(block.answer), footnote: block.question, role: "practice-answer" });
      continue;
    }

    if (block.type === "dialogue" && block.lines?.length) {
      // Diálogos largos se reparten en diapositivas de 6 intervenciones
      chunk(block.lines, 6).forEach((lines, i, all) => {
        slides.push({
          kind: "content",
          title: all.length > 1 ? `${block.title || "Diálogo"} (${i + 1}/${all.length})` : block.title || "Diálogo",
          dialogue: lines,
          bullets: lines.map((l) => `${l.speaker}: ${l.text}`),
        });
      });
      continue;
    }

    if (block.type === "flashcards" && block.cards?.length) {
      chunk(block.cards, d.maxBullets).forEach((group, i, all) => {
        slides.push({
          kind: "content",
          role: "cards",
          title: all.length > 1 ? `${block.title || "Repaso"} (${i + 1}/${all.length})` : block.title || "Repaso",
          bullets: group.map((c) => (density === "minimo" ? c.front : `${c.front} — ${c.back}`)),
        });
      });
      continue;
    }

    if (block.type === "mindmap" && block.mindMap?.branches?.length) {
      slides.push({
        kind: "content",
        title: block.title || "Mapa mental",
        body: block.mindMap.center,
        bullets: block.mindMap.branches.map((b) => (density === "minimo" ? b.label : `${b.label}: ${(b.children || []).join(", ")}`)),
      });
      continue;
    }

    if ((block.type === "video" || block.type === "resource") && block.url && density !== "minimo") {
      slides.push({ kind: "content", title: block.title || (block.type === "video" ? "Video" : "Material"), body: block.url, role: "link" });
    }
  }

  // Cierre con el plan del profesor. Va al final para que pueda recortarlo si reparte el PDF.
  const plan = input.teacherPlan;
  if (plan) {
    if (plan.objective) {
      slides.push({
        kind: "content",
        title: "Objetivo de la clase",
        role: "teacher",
        body: plan.objective,
        bullets: plan.prerequisites?.length ? plan.prerequisites.map((p) => `Requisito: ${p}`) : undefined,
      });
    }
    if (plan.classFlow?.length) {
      slides.push({ kind: "content", role: "teacher", title: "Guion de la clase", bullets: plan.classFlow.map((f) => `${f.minute}-${f.minute + f.durationMinutes} min: ${f.activity}`) });
    }
    if ((plan.teacherNotes?.length || plan.homework) && density !== "minimo") {
      chunk(plan.teacherNotes ?? [], 6).forEach((notes, i) => {
        slides.push({ kind: "content", role: "teacher", title: "Notas del profesor", body: i === 0 && plan.homework ? `Tarea: ${plan.homework}` : undefined, bullets: notes });
      });
    }
  }

  return slides;
}

/** La lección como texto plano ordenado, para que la IA diseñe la presentación inteligente. */
export function lessonToPlainText(blocks: DeckInput["blocks"], maxChars = 24000): string {
  const L = ["A", "B", "C", "D", "E", "F"];
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === "chapter") parts.push(`\n## ${b.label ? `${b.label}: ` : ""}${b.title ?? ""}${b.content ? `\n${b.content}` : ""}`);
    else if (b.type === "text" && (b.title || b.content)) parts.push(`### ${b.title ?? ""}\n${b.content ?? ""}`);
    else if (b.type === "quiz" && b.question) {
      const opts = (b.options ?? []).map((o, i) => `${L[i]}) ${o}`).join("  ");
      const ok = b.correctOptionIndex !== undefined && b.options?.[b.correctOptionIndex] ? ` · Correcta: ${L[b.correctOptionIndex]}` : "";
      parts.push(`[Pregunta] ${b.question}\n${opts}${ok}`);
    } else if (b.type === "practice" && b.question) parts.push(`[Ejercicio] ${b.question}${b.answer ? `\nRespuesta modelo: ${b.answer}` : ""}`);
    else if (b.type === "flashcards" && b.cards?.length) parts.push(`[Vocabulario]\n${b.cards.map((c) => `- ${c.front}: ${c.back}`).join("\n")}`);
    else if (b.type === "mindmap" && b.mindMap) parts.push(`[Mapa] ${b.mindMap.center}: ${b.mindMap.branches.map((x) => `${x.label} (${x.children.join(", ")})`).join("; ")}`);
  }
  const text = parts.join("\n\n").trim();
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…` : text;
}

// ─── Ajuste al número de diapositivas pedido ─────────────────────────────────

export const MIN_SLIDES = 5;
export const MAX_SLIDES = 20;

const CONTINUATION = /\s\((\d+)\/(\d+)\)$|\s\(continuación\)$/;

/** Cuanto más bajo, antes se quita al recortar. La portada nunca se quita. */
function priority(s: DeckSlide): number {
  if (s.kind === "cover") return Infinity;
  if (s.role === "teacher") return 10;
  if (s.role === "link") return 15;
  if (s.role === "practice") return 20;
  if (s.role === "image-only") return 25;
  if (s.role === "cards") return 30;
  if (s.kind === "content" && CONTINUATION.test(s.title) && !/\(1\/\d+\)$/.test(s.title)) return 35;
  if (s.kind === "quiz") return 40;
  if (s.kind === "section") return 55;
  return 70;
}

/** Texto repartible de una diapositiva de contenido, en piezas (párrafos, viñetas o frases). */
function pieces(s: DeckSlide): Array<{ text: string; bullet: boolean }> {
  const paragraphs = (s.body ?? "").split(/\n{2,}/).map((t) => t.trim()).filter(Boolean);
  const out = [...paragraphs.map((text) => ({ text, bullet: false })), ...(s.bullets ?? []).map((text) => ({ text, bullet: true }))];
  if (out.length === 1 && !out[0].bullet) {
    const sentences = out[0].text.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((x) => x.trim()) ?? [];
    if (sentences.length >= 2) return sentences.map((text) => ({ text, bullet: false }));
  }
  return out;
}

/**
 * Ajusta el guion al número de diapositivas que pide el profesor (5-20).
 *  - Si sobran: se quitan primero las menos importantes (guion del profesor,
 *    enlaces, respuestas modelo, repasos, continuaciones, preguntas…). Cada
 *    pregunta se quita junto con su diapositiva de respuesta.
 *  - Si faltan: se reparte el contenido más largo en dos diapositivas.
 * No se inventa contenido: si la lección es muy corta puede quedar por debajo.
 */
export function fitDeckToCount(deck: DeckSlide[], target: number): DeckSlide[] {
  // El 5-20 se valida al pedirla; aquí puede llegar uno menos (el cierre del modelo cuenta aparte)
  const goal = Math.max(1, Math.min(MAX_SLIDES, Math.round(target)));

  // Unidades: una pregunta y su respuesta van juntas
  const units: DeckSlide[][] = [];
  for (const s of deck) {
    if (s.kind === "answer" && units.length && units[units.length - 1][0].kind === "quiz") units[units.length - 1].push(s);
    else units.push([s]);
  }
  const count = () => units.reduce((acc, u) => acc + u.length, 0);

  // Recortar
  while (count() > goal) {
    let pick = -1;
    let best = Infinity;
    units.forEach((u, i) => {
      const p = priority(u[0]);
      // A igual prioridad se quita la más tardía: se conserva el hilo de la lección
      if (p !== Infinity && p <= best) { best = p; pick = i; }
    });
    if (pick < 0) break;
    const unit = units[pick];
    // Si quitar la pareja pregunta+respuesta se pasa, basta con quitar la respuesta
    if (unit.length === 2 && count() - goal === 1) unit.pop();
    else units.splice(pick, 1);
  }

  let slides = units.flat();

  // Ampliar
  while (slides.length < goal) {
    let pick = -1;
    let size = 0;
    slides.forEach((s, i) => {
      if (s.kind !== "content" || s.role === "teacher") return;
      const p = pieces(s);
      const len = p.reduce((acc, x) => acc + x.text.length, 0);
      if (p.length >= 2 && len > size) { size = len; pick = i; }
    });
    if (pick < 0) break;
    const s = slides[pick];
    const p = pieces(s);
    const half = Math.ceil(p.length / 2);
    const make = (part: typeof p, title: string, image?: string): DeckSlide => ({
      ...s,
      title,
      image,
      body: part.filter((x) => !x.bullet).map((x) => x.text).join("\n\n") || undefined,
      bullets: part.some((x) => x.bullet) ? part.filter((x) => x.bullet).map((x) => x.text) : undefined,
    });
    const base = s.title.replace(CONTINUATION, "");
    slides = [...slides.slice(0, pick), make(p.slice(0, half), s.title, s.image), make(p.slice(half), `${base} (cont.)`), ...slides.slice(pick + 1)];
  }

  return slides;
}


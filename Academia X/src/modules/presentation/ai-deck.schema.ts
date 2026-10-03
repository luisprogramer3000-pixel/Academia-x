import type { DeckSlide } from "./presentation.deck";
import type { TextDensity } from "./presentation.themes";

/**
 * PRESENTACIÓN INTELIGENTE (con IA, cuesta créditos)
 *
 * La IA rediseña la lección en diapositivas con estructura visual: tarjetas,
 * dos columnas, tablas, pasos, procesos, debate, quiz con su corrección y
 * actividad de relacionar columnas. La versión básica (gratis) solo reparte
 * el texto de la lección; esta la reorganiza como lo haría un diseñador.
 */

export type RichSlide =
  | { layout: "title"; title: string; subtitle?: string; imagePrompt?: string; imageUrl?: string }
  | { layout: "agenda"; title: string; items: string[] }
  | { layout: "cards"; title: string; cards: Array<{ icon: string; heading: string; text: string }> }
  | { layout: "two-columns"; title?: string; columns: Array<{ heading: string; text: string; bullets: string[] }> }
  | { layout: "text"; title: string; heading?: string; text: string; bullets: string[]; imagePrompt?: string; imageUrl?: string }
  | { layout: "table"; title: string; intro?: string; headers: string[]; rows: string[][] }
  | { layout: "steps"; title: string; badge?: string; steps: Array<{ heading?: string; text: string }> }
  | { layout: "process"; title: string; steps: Array<{ heading: string; text: string }> }
  | { layout: "discussion"; badge: string; question: string; prompt: string }
  | { layout: "quiz"; question: string; options: string[]; correctIndex: number; explanation?: string }
  | { layout: "matching"; title: string; left: string[]; right: string[]; answers: number[] }
  | { layout: "conclusion"; title: string; bullets: string[] };

export interface AiDeckParams {
  lessonTitle: string;
  /** Texto de la lección (bloques ya aplanados) */
  lessonText: string;
  level?: string;
  language: string;
  slideCount: number;
  density: TextDensity;
  /** Cuántas diapositivas pueden llevar ilustración generada */
  imageCount: number;
}

export interface AiDeckOutput {
  slides: RichSlide[];
  promptTokens: number;
  completionTokens: number;
  estimatedCost: number;
}

/** El quiz y el relacionar columnas ocupan dos diapositivas (actividad + corrección). */
export const renderedCount = (s: RichSlide) => (s.layout === "quiz" || s.layout === "matching" ? 2 : 1);

const DENSITY_RULE: Record<TextDensity, string> = {
  minimo: "Texto MÍNIMO: frases muy cortas (máx. 15 palabras por bloque), ideas clave; el profesor explica en voz alta.",
  estandar: "Texto ESTÁNDAR: explicaciones breves de 1-2 frases por bloque, con un ejemplo concreto.",
  detallado: "Texto DETALLADO: explicaciones completas de 2-3 frases por bloque, con ejemplos, para estudiar sin el profesor.",
};

export function buildAiDeckPrompt(p: AiDeckParams): string {
  return [
    "Eres un diseñador de presentaciones educativas. Conviertes una lección en una presentación visual, clara y atractiva, lista para proyectar en clase.",
    `Idioma de toda la presentación: ${p.language}. Nivel del alumnado: ${p.level || "general"}.`,
    `La presentación debe tener EXACTAMENTE ${p.slideCount} diapositivas en total. Ojo: cada "quiz" y cada "matching" cuentan como 2 (actividad + corrección); el resto cuentan 1.`,
    DENSITY_RULE[p.density],
    "",
    "Tipos de diapositiva (campo \"layout\"):",
    '- "title": portada. {title, subtitle}',
    '- "agenda": índice. {title, items: 3-6 puntos}',
    '- "cards": 2-4 tarjetas de conceptos. {title, cards: [{icon: un emoji, heading, text}]}',
    '- "two-columns": comparación. {title?, columns: [2 x {heading, text, bullets: 0-3}]}',
    '- "text": explicación con viñetas. {title, heading?, text, bullets: 0-6}',
    '- "table": tabla (conjugaciones, vocabulario, datos). {title, intro?, headers: 2-4, rows: 3-7 filas}',
    '- "steps": pasos numerados en vertical (demostración guiada). {title, badge?: p. ej. "✏️ Demostración guiada", steps: 3-5 x {heading?, text}}',
    '- "process": proceso de 3-4 fases en horizontal. {title, steps: [{heading, text}]}',
    '- "discussion": pregunta para comentar en parejas. {badge: p. ej. "👥 Discute con el compañero de al lado", question (corta y grande), prompt (instrucciones y 2-4 preguntas guía)}',
    '- "quiz": pregunta de opción múltiple. {question, options: 4, correctIndex: 0-3, explanation}',
    '- "matching": relacionar columnas. {title, left: 4 elementos, right: 4 elementos DESORDENADOS, answers: para cada elemento de right, el índice (0-3) del elemento de left que le corresponde}',
    '- "conclusion": cierre. {title, bullets: 3-5}',
    "",
    "Reglas:",
    "1. Empieza con \"title\" y, si caben 8 o más diapositivas, sigue con \"agenda\". Termina con \"conclusion\".",
    "2. Alterna los tipos para que sea visual: usa tarjetas, tablas, columnas y pasos donde el contenido lo pida; no pongas dos \"text\" seguidos.",
    "3. Incluye actividades según el total: con 10 o más diapositivas, al menos 1 \"quiz\" y 1 \"discussion\" o \"matching\"; con 15 o más, 2 quiz y 1 matching.",
    "4. Todo el contenido sale de la lección: conceptos, ejemplos y ejercicios reales, sin inventar temas ajenos ni dejar marcadores.",
    p.imageCount > 0
      ? `5. Añade "imagePrompt" (descripción visual concreta, sin texto dentro) a la portada y a ${Math.max(0, p.imageCount - 1)} diapositivas "text" donde una ilustración ayude.`
      : '5. No añadas "imagePrompt".',
    "",
    // La palabra "JSON" es obligatoria: OpenAI rechaza el modo json_object si no aparece en las instrucciones
    'Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma: { "slides": [ ... ] }',
  ].join("\n");
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, n: number, max = 300) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

/** Valida y limpia la salida del modelo; descarta diapositivas incompletas. */
export function normalizeAiDeck(raw: unknown, p: AiDeckParams): RichSlide[] {
  const list = Array.isArray((raw as { slides?: unknown })?.slides) ? ((raw as { slides: unknown[] }).slides) : [];
  const out: RichSlide[] = [];
  for (const item of list) {
    const s = (item ?? {}) as Record<string, unknown>;
    const imagePrompt = str(s.imagePrompt) || undefined;
    switch (s.layout) {
      case "title":
        out.push({ layout: "title", title: str(s.title, 120) || p.lessonTitle, subtitle: str(s.subtitle, 200) || undefined, imagePrompt });
        break;
      case "agenda": {
        const items = strs(s.items, 7, 120);
        if (items.length) out.push({ layout: "agenda", title: str(s.title, 80) || "Índice", items });
        break;
      }
      case "cards": {
        const cards = (Array.isArray(s.cards) ? s.cards : []).slice(0, 4).map((c: Record<string, unknown>) => ({
          icon: str(c?.icon, 8) || "•", heading: str(c?.heading, 60), text: str(c?.text, 260),
        })).filter((c) => c.heading || c.text);
        if (cards.length >= 2) out.push({ layout: "cards", title: str(s.title, 90), cards });
        break;
      }
      case "two-columns": {
        const columns = (Array.isArray(s.columns) ? s.columns : []).slice(0, 2).map((c: Record<string, unknown>) => ({
          heading: str(c?.heading, 70), text: str(c?.text, 320), bullets: strs(c?.bullets, 4, 160),
        }));
        if (columns.length === 2) out.push({ layout: "two-columns", title: str(s.title, 90) || undefined, columns });
        break;
      }
      case "text":
        if (str(s.text) || strs(s.bullets, 6).length) {
          out.push({ layout: "text", title: str(s.title, 90), heading: str(s.heading, 80) || undefined, text: str(s.text, 700), bullets: strs(s.bullets, 6, 200), imagePrompt });
        }
        break;
      case "table": {
        const headers = strs(s.headers, 4, 60);
        const rows = (Array.isArray(s.rows) ? s.rows : []).slice(0, 8).map((r) => strs(r, headers.length, 120)).filter((r) => r.length === headers.length);
        if (headers.length >= 2 && rows.length) out.push({ layout: "table", title: str(s.title, 90), intro: str(s.intro, 300) || undefined, headers, rows });
        break;
      }
      case "steps":
      case "process": {
        const steps = (Array.isArray(s.steps) ? s.steps : []).slice(0, s.layout === "process" ? 4 : 5).map((x: Record<string, unknown>) => ({
          heading: str(x?.heading, 60), text: str(x?.text, 320),
        })).filter((x) => x.text || x.heading);
        if (steps.length >= 2) {
          out.push(s.layout === "process"
            ? { layout: "process", title: str(s.title, 90), steps }
            : { layout: "steps", title: str(s.title, 90), badge: str(s.badge, 60) || undefined, steps });
        }
        break;
      }
      case "discussion":
        if (str(s.question)) out.push({ layout: "discussion", badge: str(s.badge, 70) || "👥 Discute con tu compañero", question: str(s.question, 120), prompt: str(s.prompt, 500) });
        break;
      case "quiz": {
        const options = strs(s.options, 5, 160);
        const correctIndex = typeof s.correctIndex === "number" ? Math.round(s.correctIndex) : -1;
        if (str(s.question) && options.length >= 2 && correctIndex >= 0 && correctIndex < options.length) {
          out.push({ layout: "quiz", question: str(s.question, 400), options, correctIndex, explanation: str(s.explanation, 300) || undefined });
        }
        break;
      }
      case "matching": {
        const left = strs(s.left, 5, 80);
        const right = strs(s.right, 5, 120);
        const answers = Array.isArray(s.answers) ? (s.answers as unknown[]).map((a) => (typeof a === "number" ? Math.round(a) : -1)) : [];
        if (left.length >= 3 && right.length === left.length && answers.length === right.length && answers.every((a) => a >= 0 && a < left.length)) {
          out.push({ layout: "matching", title: str(s.title, 80) || "Relaciona las columnas", left, right, answers });
        }
        break;
      }
      case "conclusion": {
        const bullets = strs(s.bullets, 5, 220);
        if (bullets.length) out.push({ layout: "conclusion", title: str(s.title, 60) || "Conclusión", bullets });
        break;
      }
    }
  }
  if (!out.length || out[0].layout !== "title") out.unshift({ layout: "title", title: p.lessonTitle });

  // Si la IA se pasa del total pedido, se recorta desde el final conservando la conclusión
  let total = out.reduce((a, s) => a + renderedCount(s), 0);
  while (total > p.slideCount && out.length > 2) {
    const i = out.length - 2;
    total -= renderedCount(out[i]);
    out.splice(i, 1);
  }
  return out;
}

/**
 * Versión plana de la presentación inteligente, para los formatos que solo
 * admiten título + texto + viñetas (PDF y modelos de PowerPoint subidos).
 */
export function flattenAiDeck(slides: RichSlide[], academyName: string): DeckSlide[] {
  const L = ["A", "B", "C", "D", "E"];
  const out: DeckSlide[] = [];
  for (const s of slides) {
    switch (s.layout) {
      case "title": out.push({ kind: "cover", title: s.title, body: s.subtitle, footnote: academyName, image: s.imageUrl }); break;
      case "agenda": out.push({ kind: "content", title: s.title, bullets: s.items }); break;
      case "cards": out.push({ kind: "content", title: s.title, bullets: s.cards.map((c) => `${c.heading}: ${c.text}`) }); break;
      case "two-columns":
        out.push({ kind: "content", title: s.title || `${s.columns[0].heading} / ${s.columns[1].heading}`, bullets: s.columns.flatMap((c) => [`${c.heading}: ${c.text}`, ...c.bullets]) });
        break;
      case "text": out.push({ kind: "content", title: s.title, body: [s.heading, s.text].filter(Boolean).join("\n\n"), bullets: s.bullets, image: s.imageUrl }); break;
      case "table": out.push({ kind: "content", title: s.title, body: s.intro, bullets: [s.headers.join(" — "), ...s.rows.map((r) => r.join(" — "))] }); break;
      case "steps":
      case "process": out.push({ kind: "content", title: s.title, bullets: s.steps.map((x, i) => `${i + 1}. ${x.heading ? `${x.heading}: ` : ""}${x.text}`) }); break;
      case "discussion": out.push({ kind: "section", title: s.question, body: s.prompt, footnote: s.badge }); break;
      case "quiz":
        out.push({ kind: "quiz", title: "Pregunta", body: s.question, bullets: s.options.map((o, i) => `${L[i]}. ${o}`) });
        out.push({ kind: "answer", title: "Respuesta", body: `${L[s.correctIndex]}. ${s.options[s.correctIndex]}`, footnote: s.explanation });
        break;
      case "matching":
        out.push({ kind: "quiz", title: s.title, bullets: [...s.left.map((x, i) => `${i + 1}. ${x}`), ...s.right.map((x) => `( ) ${x}`)] });
        out.push({ kind: "answer", title: "Solución", bullets: s.right.map((x, i) => `${s.answers[i] + 1} → ${x}`) } as DeckSlide);
        break;
      case "conclusion": out.push({ kind: "content", title: s.title, bullets: s.bullets }); break;
    }
  }
  return out;
}

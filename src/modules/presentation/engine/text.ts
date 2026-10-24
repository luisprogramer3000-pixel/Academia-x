/**
 * Utilidades de texto para transformar contenido de lección en texto de
 * diapositiva: frases cortas, viñetas, IDs semánticos y similitud.
 */

/** Quita marcado markdown sencillo (negritas, encabezados, viñetas). */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function normalize(text: string): string {
  return text.toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Divide un texto en frases (respeta abreviaturas cortas como "p. ej."). */
export function sentences(text: string): string[] {
  const clean = stripMarkdown(text).replace(/\s*\n+\s*/g, " ");
  // Se corta tras . ! ? (con comillas o paréntesis de cierre) cuando sigue una
  // mayúscula: nunca se pierde texto ("Responde 'I am fine.' a una pregunta" queda entera)
  const parts = clean.split(/(?<=[.!?…]["'”’»)\]]*)\s+(?=["'“‘«¿¡(]?[A-ZÁÉÍÓÚÑÜ0-9])/);
  const out: string[] = [];
  for (const raw of parts) {
    const s = raw.trim();
    if (!s) continue;
    // Pega fragmentos de abreviatura ("p. ej.", "etc.")
    if (out.length && /(?:\b[a-z]{1,3}\.)$/i.test(out[out.length - 1]) && s.length < 25) out[out.length - 1] += ` ${s}`;
    else out.push(s);
  }
  return out;
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Recorta un texto a `maxWords` palabras por un límite natural (coma, punto y
 * coma, conjunción) para que no termine a mitad de idea.
 */
export function condense(text: string, maxWords: number): string {
  const first = sentences(text)[0] ?? stripMarkdown(text);
  const words = first.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return first.replace(/[.;:]+$/, "");
  const cut = words.slice(0, maxWords).join(" ");
  // Último corte natural dentro del límite
  const natural = cut.match(/^(.{12,}?)[,;:](?=[^,;:]*$)/);
  const base = natural ? natural[1] : cut.replace(/\s+(?:y|e|o|u|de|del|la|el|los|las|en|con|que|para|por|a|and|or|the|of|to|in|with|for)$/i, "");
  return `${base.replace(/[.,;:]+$/, "")}…`;
}

/** Divide una definición en 2-3 rasgos cortos para viñetas. */
export function keyPoints(text: string, max = 3, maxWords = 7): string[] {
  const clean = stripMarkdown(text).replace(/[.]+$/, "");
  const chunks = clean
    .split(/(?<=[.;])\s+|,\s+(?:y\s+|e\s+|que\s+|and\s+|which\s+)?|\s+(?:y|e|pero|and|but)\s+(?=[a-záéíóúñ])/i)
    .map((c) => c.trim().replace(/^(?:que|y|e|and|which)\s+/i, ""))
    .filter((c) => wordCount(c) >= 2);
  const points: string[] = [];
  for (const c of chunks) {
    const p = condense(c, maxWords);
    const n = normalize(p);
    if (points.some((x) => normalize(x) === n)) continue;
    points.push(capitalize(p));
    if (points.length >= max) break;
  }
  return points;
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toLocaleUpperCase("es") + text.slice(1) : text;
}

/** ID semántico estable: CONCEPT_TRANSPORTE_PUBLICO */
export function semanticId(prefix: string, label: string): string {
  const slug = normalize(label).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 32).toUpperCase();
  return `${prefix}_${slug || "X"}`;
}

const STOP = new Set(
  "a al ante con de del desde el en entre es la las lo los para por que se sin son su sus un una uno y o e u the a an and or of to in on for with is are be this that it as by from at".split(" ")
);

export function contentWords(text: string): Set<string> {
  return new Set(
    normalize(stripMarkdown(text))
      .split(/[^a-z0-9ñ]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  );
}

/** Similitud de Jaccard entre dos textos (0-1). */
export function similarity(a: string, b: string): number {
  const A = contentWords(a);
  const B = contentWords(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** ¿El texto menciona el término? (sin tildes ni mayúsculas; admite plural simple) */
export function mentions(text: string, term: string): boolean {
  const t = normalize(term).replace(/[^a-z0-9ñ ]+/g, " ").trim();
  if (!t) return false;
  const hay = ` ${normalize(text).replace(/[^a-z0-9ñ ]+/g, " ")} `;
  return hay.includes(` ${t} `) || hay.includes(` ${t}s `) || hay.includes(` ${t}es `);
}

/** Primer bloque de "Ejemplo: …" dentro de un texto, y el texto sin él. */
export function splitExample(text: string): { body: string; example?: string } {
  const m = text.match(/(?:^|\n)\s*(?:\*\*)?\s*(?:ejemplos?|example|e\.g\.|por ejemplo)\s*:?\s*(?:\*\*)?\s*:?\s*(.+)$/im);
  if (!m) return { body: text };
  return { body: text.slice(0, m.index).trim(), example: stripMarkdown(m[1]).replace(/^["“]|["”]$/g, "").trim() };
}

/** Elementos de una lista (viñetas o líneas). */
export function listItems(text: string): string[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /^(?:[-*•▪◦]|\d+[.)])\s+/.test(l))
    .map((l) => stripMarkdown(l))
    .filter(Boolean);
}

/** Pseudoaleatorio determinista a partir de una semilla (variación controlada y reproducible). */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "Al finalizar la clase, los estudiantes podrán:" / "By the end of the lesson, students will be able to:" */
const OBJECTIVE_LEAD_IN = /^\s*(?:al (?:finalizar|terminar|concluir)|al final de|despu[eé]s de|tras|by the end of|at the end of|after)(?:\s+(?:la|el|this|the)?\s*(?:clase|lecci[oó]n|sesi[oó]n|unidad|tema|curso|class|lesson|session|unit))?\s*,?\s*/i;
const OBJECTIVE_SUBJECT = /^\s*(?:los|las|el|la)?\s*(?:estudiantes|alumnos|alumnas|participantes|ni[nñ]os|students|learners|pupils)\s*(?:podr[aá]n|ser[aá]n capaces de|sabr[aá]n|van a|will be able to|will|can|should be able to)?\s*:?\s*/i;

/**
 * Separa un texto de objetivos en objetivos sueltos: quita la frase
 * introductoria ("Al finalizar…, podrán:") y divide por ";", saltos,
 * viñetas, numeración o comas entre verbos.
 */
export function splitObjectives(text: string): string[] {
  let t = stripMarkdown(text).replace(/\s+/g, " ").trim();
  // Introducción hasta los dos puntos ("…podrán: a; b; c")
  const colon = t.indexOf(":");
  if (colon > 0 && colon < 120 && /podr|capaces|able|will|objetiv|goal|finalizar|end of/i.test(t.slice(0, colon))) t = t.slice(colon + 1);
  t = t.replace(OBJECTIVE_LEAD_IN, "").replace(OBJECTIVE_SUBJECT, "");
  let parts = t.split(/\s*(?:;|\n|•|·|\.\s+|\s\d+[.)]\s+|\s[a-d]\)\s+)\s*/).map((x) => x.trim()).filter(Boolean);
  // Una sola frase con varios verbos: "reconocer…, diferenciar… y usar…"
  if (parts.length === 1) {
    const verbs = parts[0].split(/,\s*|\s+y\s+(?=[a-záéíóú]+(?:ar|er|ir)\b)|\s+and\s+(?=[a-z]+\b)/i).map((x) => x.trim()).filter((x) => wordCount(x) >= 2);
    if (verbs.length >= 2) parts = verbs;
  }
  return parts
    .map((p) => capitalize(p.replace(/^(?:y|and)\s+/i, "").replace(/[.;,:]+$/, "").trim()))
    .filter((p) => wordCount(p) >= 2)
    .slice(0, 4);
}

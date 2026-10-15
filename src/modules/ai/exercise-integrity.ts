/**
 * Control de calidad de ejercicios generados por IA: un ejercicio tiene que
 * poder resolverse con lo que muestra. "Lee el siguiente párrafo y escribe la
 * idea principal" sin el párrafo, "Observa la imagen…" sin imagen o "Escucha el
 * audio…" sin audio son ejercicios rotos y no deben llegar nunca al alumno.
 *
 * 1. `missingMaterial` detecta los enunciados que remiten a un material que no
 *    está incluido en el propio enunciado.
 * 2. `enforceSelfContained` pide a la IA que reescriba SOLO esos ejercicios con
 *    el material completo dentro, vuelve a comprobarlos y elimina los que sigan
 *    incompletos. No cuesta créditos al profesor.
 */

/** Regla que se añade a las instrucciones de todos los generadores de ejercicios. */
export const SELF_CONTAINED_RULE =
  "REGLA OBLIGATORIA DE EJERCICIOS: cada ejercicio y cada pregunta debe poder resolverse solo con lo que muestra su enunciado. " +
  "Si pide leer, analizar o completar un párrafo, texto, fragmento, oraciones, frases, diálogo, correo, noticia, tabla o lista, " +
  "ESCRIBE ese material completo dentro del mismo enunciado (después de dos puntos o entre comillas). " +
  'Nunca escribas "el siguiente párrafo/texto/diálogo" sin incluirlo. ' +
  "No pidas observar imágenes, fotos o videos ni escuchar audios: el alumno no los tiene; usa un texto equivalente.";

/** Remite a un material escrito que debería venir en el enunciado */
const NEEDS_TEXT: RegExp[] = [
  /\b(siguientes?)\s+(p[aá]rrafos?|textos?|fragmentos?|oraciones|oraci[oó]n|frases?|di[aá]logos?|palabras|afirmaciones|enunciados|ejemplos|situaciones|casos|correos?|cartas?|noticias?|historias?|poemas?|tablas?|listas?|conversaci[oó]n(es)?|verbos|expresiones|preguntas|anuncios?|mensajes?)\b/i,
  /\b(lee|leer|analiza|resume|subraya|relee)\s+(el|este|esta|estos|estas|un|una)\s+(p[aá]rrafo|fragmento|texto|di[aá]logo|correo|carta|noticia|poema|art[ií]culo|conversaci[oó]n|anuncio|mensaje)\b/i,
  /\b(el|la)\s+(p[aá]rrafo|fragmento|texto|di[aá]logo)\s+(anterior|de arriba|de abajo|dado)\b/i,
  // Un texto concreto que no está ("del texto sobre el cambio climático", "este artículo acerca de…")
  /\b(el|del|al|este|esta|ese|esa)\s+(texto|art[ií]culo|p[aá]rrafo|fragmento|di[aá]logo|correo|carta|noticia|historia|relato|conversaci[oó]n|anuncio)\s+(sobre|acerca de|que habla de|titulad[oa]|de la p[aá]gina)\b/i,
  // "el párrafo", "del fragmento": siempre tienen que venir escritos en el ejercicio
  /\b(el|del|al|este|ese)\s+(p[aá]rrafo|fragmento)\b/i,
  /\bthe following\b/i,
  /\b(read|summari[sz]e|analy[sz]e)\s+(the|this)\s+(paragraph|text|passage|dialogue|email|letter|article)\b/i,
];

/** Remite a algo que el alumno tiene que VER (imagen, video, mapa...) */
const NEEDS_VISUAL: RegExp[] = [
  /\b(observa|mira|describe|fíjate en|fijate en)\s+(la|las|el|los|esta|estas|este)\s+(imagen|im[aá]genes|foto|fotos|fotograf[ií]as?|ilustraci[oó]n(es)?|dibujos?|v[ií]deos?|mapa|gr[aá]fic[oa]s?|infograf[ií]a)\b/i,
  /\b(look at|watch)\s+(the|this)\s+(picture|image|photo|video)\b/i,
];

/** Remite a algo que el alumno tiene que OÍR (audio, grabación, canción...) */
const NEEDS_AUDIO: RegExp[] = [
  /\b(escucha|oye|escuchar)\b.*\b(audio|grabaci[oó]n|canci[oó]n|podcast|di[aá]logo)\b/i,
  /\blisten to\s+(the|this)\s+(audio|recording|video|song)\b/i,
];

/** Material que el profesor adjuntó al ejercicio en el editor */
export interface AttachedMaterial {
  image?: boolean;
  audio?: boolean;
  video?: boolean;
  /** Enlace web (YouTube, Vimeo, una página...) */
  link?: boolean;
}

/** "Según la lectura…", "del texto", "el artículo": válido solo si la lección tiene una lectura */
const READING_REF = /\b(la lectura|el texto de la lectura|the reading|(el|del|al|este)\s+(texto|art[ií]culo|relato|historia|cuento))\b/i;

/** ¿Trae el enunciado el material? Texto entre comillas largo o contenido tras la consigna. */
function includesMaterial(text: string, triggerIndex: number): boolean {
  const quoted = text.match(/[«“"']([^«»“”"']{40,})[»”"']/);
  if (quoted) return true;
  // La consigna termina en ":" / salto de línea / punto; lo que sigue es el material
  const rest = text.slice(triggerIndex);
  const cut = rest.search(/[:\n]|\.\s/);
  const after = cut >= 0 ? rest.slice(cut + 1).trim() : "";
  const before = text.slice(0, triggerIndex).trim();
  // Material antes de la consigna ("Juan vive en… Lee el texto anterior y…") también cuenta
  return after.replace(/\s+/g, " ").length >= 60 || before.replace(/\s+/g, " ").length >= 120;
}

/**
 * Motivo por el que el ejercicio no se puede resolver, o null si está completo.
 * `readingAvailable`: la lección incluye una lectura a la que se puede remitir.
 * `attached`: imagen, audio, video o enlace que el profesor adjuntó al ejercicio.
 */
export function missingMaterial(text: string, opts: { readingAvailable?: boolean; attached?: AttachedMaterial } = {}): string | null {
  const t = (text || "").trim();
  if (!t) return "enunciado vacío";
  const a = opts.attached ?? {};
  // Un video o un enlace (YouTube, una página) sirven para ver y para escuchar
  const canSee = Boolean(a.image || a.video || a.link);
  const canHear = Boolean(a.audio || a.video || a.link);
  if (!canHear && NEEDS_AUDIO.some((re) => re.test(t))) return "pide un audio que el alumno no tiene";
  if (!canSee && NEEDS_VISUAL.some((re) => re.test(t))) return "pide una imagen o video que el alumno no tiene";
  // Un enlace a una página web puede ser el texto que el ejercicio pide leer
  if (a.link) return null;
  for (const re of NEEDS_TEXT) {
    const m = re.exec(t);
    if (m && !includesMaterial(t, m.index)) return "remite a un texto que no está incluido";
  }
  const reading = READING_REF.exec(t);
  if (reading && !opts.readingAvailable && !includesMaterial(t, reading.index)) return "remite a una lectura que la lección no tiene";
  return null;
}

/** Un ejercicio a revisar, con cómo reescribirlo o quitarlo de su estructura. */
export interface ExerciseRef {
  text: string;
  answer?: string;
  /** Opciones de respuesta (preguntas de opción múltiple) */
  options?: string[];
  set: (text: string, answer?: string) => void;
  remove: () => void;
}

/** Llamada JSON genérica a la IA (la misma que usa el planificador de presentaciones). */
export type JsonAsk = (system: string, user: string) => Promise<unknown>;

export async function enforceSelfContained(
  refs: ExerciseRef[],
  ask: JsonAsk,
  ctx: { topic: string; level?: string; language?: string; readingAvailable?: boolean }
): Promise<{ checked: number; repaired: number; removed: number }> {
  const broken = refs
    .map((r, i) => ({ r, i, reason: missingMaterial(r.text, ctx) }))
    .filter((x): x is { r: ExerciseRef; i: number; reason: string } => Boolean(x.reason));
  if (!broken.length) return { checked: refs.length, repaired: 0, removed: 0 };

  let fixes = new Map<number, { text: string; answer?: string }>();
  try {
    const system = [
      "Eres editor de materiales de una academia. Te paso ejercicios que NO se pueden resolver porque les falta el material.",
      "Reescribe cada uno para que sea autosuficiente, del mismo tema y nivel:",
      "- Si pide un párrafo, texto, oraciones, diálogo, etc., escríbelo completo DENTRO del enunciado, después de dos puntos (4 a 8 oraciones para un párrafo).",
      "- Si pide una imagen, audio o video, cámbialo por un texto o una descripción escrita equivalente.",
      "- Mantén el tipo de ejercicio y, si hay opciones, que sigan siendo correctas para el nuevo enunciado.",
      "- Escribe también la respuesta modelo correcta para el nuevo enunciado.",
      `Idioma: ${ctx.language || "español"}. Nivel: ${ctx.level || "acorde al tema"}.`,
      'Devuelve solo JSON: { "items": [ { "id": number, "text": string, "answer": string } ] }',
    ].join("\n");
    const user = JSON.stringify({
      tema: ctx.topic,
      ejercicios: broken.map((b) => ({ id: b.i, enunciado: b.r.text, respuesta: b.r.answer ?? "", opciones: b.r.options ?? [], problema: b.reason })),
    });
    const raw = (await ask(system, user)) as { items?: Array<{ id?: unknown; text?: unknown; answer?: unknown }> } | null;
    fixes = new Map(
      (raw?.items ?? [])
        .filter((x) => typeof x?.id === "number" && typeof x?.text === "string")
        .map((x) => [x.id as number, { text: String(x.text).trim(), answer: typeof x.answer === "string" ? x.answer.trim() : undefined }])
    );
  } catch (error) {
    console.warn("[exercise-integrity] No se pudo reparar con IA:", error instanceof Error ? error.message : error);
  }

  let repaired = 0;
  let removed = 0;
  // Se quitan de atrás hacia adelante para no desplazar los índices de las estructuras
  for (const b of [...broken].reverse()) {
    const fix = fixes.get(b.i);
    if (fix && fix.text && !missingMaterial(fix.text, ctx)) {
      b.r.set(fix.text, fix.answer || b.r.answer);
      repaired++;
    } else {
      b.r.remove();
      removed++;
    }
  }
  if (repaired || removed) console.info(JSON.stringify({ scope: "exercise-integrity", topic: ctx.topic, checked: refs.length, repaired, removed }));
  return { checked: refs.length, repaired, removed };
}

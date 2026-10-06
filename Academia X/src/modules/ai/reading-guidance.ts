/**
 * Reglas de la LECTURA DE COMPRENSIÓN y del VOCABULARIO según el nivel del alumno.
 * Las comparten el plan de clase, el contenido de lecciones de curso y la
 * herramienta "Lectura comprensiva", para que todas generen lo mismo.
 */

export type Band = "infantil" | "basico" | "intermedio" | "autentico";

/** Clasifica el grado o nivel ("Primaria (6-8 años)", "Bachillerato", "ELE B1", "B2"…) */
export function band(levelOrGrade: string): Band {
  const g = (levelOrGrade || "").toLowerCase();
  const cefr = g.match(/\b([abc])\s?([12])\b/);
  if (/6-8|infantil/.test(g)) return "infantil";
  if (/bachiller|universi|adult|profesional/.test(g)) return "autentico";
  if (cefr) {
    const rank = { a: 0, b: 1, c: 2 }[cefr[1] as "a" | "b" | "c"] * 2 + Number(cefr[2]);
    return rank <= 1 ? "basico" : rank === 2 ? "intermedio" : "autentico";
  }
  if (/9-12|primaria/.test(g)) return "basico";
  return "intermedio"; // secundaria o sin indicar
}

const RULES: Record<Band, string> = {
  infantil:
    "Tipo de texto: cuento, fábula o descripción cercana a la vida del niño. Extensión: 2-3 párrafos (150-220 palabras), frases cortas y vocabulario concreto.",
  basico:
    "Tipo de texto: narración, diálogo, correo, anuncio o texto informativo sencillo de la vida cotidiana. Extensión: 3 párrafos (220-320 palabras), frases claras.",
  intermedio:
    "Tipo de texto: artículo divulgativo, crónica, entrevista o reportaje breve. Extensión: 3-4 párrafos (300-420 palabras), con conectores variados.",
  autentico:
    "Tipo de texto AUTÉNTICO, como los que el alumno encontraría fuera del aula: artículo científico divulgativo, artículo de revista, noticia de periódico, reportaje o columna de opinión. " +
    "Formato periodístico: titular, entradilla en **negrita** (1-2 frases que resumen lo esencial) y cuerpo de 4-5 párrafos (450-650 palabras) con datos, cifras, citas de expertos y vocabulario académico o técnico propio del tema. " +
    "Usa organizaciones, personas y datos verosímiles pero ficticios (no atribuyas afirmaciones a personas u organismos reales) y termina con la línea \"*Texto adaptado con fines didácticos.*\".",
};

/** Instrucciones para escribir la lectura de comprensión. */
export function readingRules(levelOrGrade: string): string {
  return [
    `LECTURA DE COMPRENSIÓN (nivel: ${levelOrGrade || "general"}): mínimo 2-3 párrafos completos, nunca un solo bloque de texto.`,
    RULES[band(levelOrGrade)],
    "Los párrafos van separados por una línea en blanco. El texto debe usar el tema de la lección de forma natural y abundante, y la dificultad (léxico, longitud de frases, estructuras) debe corresponder exactamente al nivel.",
  ].join(" ");
}

/** ¿El nivel pide ejercicios de producción (B1 en adelante, secundaria alta, universidad, adultos)? */
export function isProductionLevel(levelOrGrade: string): boolean {
  const b = band(levelOrGrade);
  return b === "autentico";
}

/**
 * Reglas de los ejercicios según el nivel. Evitan preguntas cuya respuesta se
 * copia de la explicación que el alumno acaba de leer.
 */
export function exerciseRules(levelOrGrade: string): string {
  const common =
    "EJERCICIOS: nunca preguntes algo que se copia literalmente de la explicación inmediatamente anterior (prohibido: \"¿Cuál es la estructura de…?\", \"¿Qué es…?\", \"¿Cuándo se usa…?\"). " +
    "Cada ejercicio obliga a APLICAR lo aprendido en un contexto nuevo que no aparece en la explicación. " +
    "En opción múltiple, los distractores son errores reales y plausibles de los alumnos de ese nivel, de longitud parecida a la correcta.";
  const b = band(levelOrGrade);
  if (b === "autentico") {
    return `${common} Nivel ${levelOrGrade}: justo después de explicar cada estructura o concepto, el ejercicio es de PRODUCCIÓN abierta (tipo "practice"), por ejemplo: "Escribe tres oraciones sobre tus planes para el próximo verano siguiendo la estructura [nombre de la estructura]", "Transforma estas situaciones en…", "Reacciona a esta situación usando…". La respuesta modelo va en "answer". Las preguntas de opción múltiple se reservan para comprensión lectora y detección de errores en oraciones nuevas.`;
  }
  if (b === "intermedio") {
    return `${common} Nivel ${levelOrGrade}: tras cada concepto, completar oraciones nuevas, transformar frases o elegir la forma correcta dentro de una situación; alterna con alguna producción breve ("Escribe dos oraciones…").`;
  }
  return `${common} Nivel ${levelOrGrade}: ejercicios de reconocimiento y aplicación guiada (completar con la forma correcta, relacionar, ordenar palabras) con oraciones distintas a los ejemplos de la explicación.`;
}

/** Coherencia entre teoría y ejercicios (evita preguntas con dos respuestas válidas). */
export const CONSISTENCY_RULES =
  "COHERENCIA: cada pregunta de opción múltiple tiene UNA sola respuesta correcta según la teoría de ESTA misma clase. " +
  "Ninguna opción incorrecta puede ser algo que la teoría presente como válido para esa pregunta (ejemplo: si la teoría dice que \"Adiós\" sirve en contextos formales, no puede ser un distractor de \"¿Cuál es una despedida formal?\"). " +
  "No clasifiques una misma palabra en dos categorías opuestas en la teoría. Antes de responder, revisa cada pregunta contra la teoría y corrige cualquier contradicción. " +
  "Revisa también la ortografía de los títulos.";

/**
 * Diálogos tipo libro de idiomas: personajes jóvenes que conversan. En los
 * niveles iniciales e intermedios son obligatorios; en avanzados, opcionales.
 */
export function DIALOGUE_RULES(levelOrGrade: string): string {
  const b = band(levelOrGrade);
  const base =
    "DIÁLOGOS: usa el campo \"dialogue\" de una sección para mostrar conversaciones como en un libro de idiomas: 2-3 personajes jóvenes con nombre propio (variados: p. ej. Lucía, Mateo, Aisha, Kenji), " +
    "líneas cortas y naturales que usen el tema de la clase, en situaciones reales (colegio, parque, cafetería, fiesta, viaje, redes). Cada línea: {\"speaker\", \"text\"} y, si la clase es bilingüe, \"translation\". " +
    "El texto de la sección (\"body\") presenta la situación en 1-2 frases; el diálogo NO se repite en el body. Añade a esa sección un \"imagePrompt\" con los personajes conversando en ese lugar.";
  if (b === "autentico") return `${base} En este nivel son opcionales: úsalos en el reto o en la teoría cuando la situación sea conversacional.`;
  return `${base} En este nivel son OBLIGATORIOS: el reto (m1) abre con un diálogo de 6-10 líneas, y la teoría (m2) incluye en cada concepto un mini diálogo modelo de 3-4 líneas que muestre ese concepto en uso.`;
}

/** Resumen final: lista vertical, un punto por línea. */
export const SUMMARY_RULES =
  "RESUMEN: lista VERTICAL con un punto por línea (\"- \" o \"1. \"), 4-6 puntos breves. Nunca escribas varios números seguidos en la misma línea (prohibido: \"1. Uno. 2. Dos. 3. Tres.\").";

/** Instrucciones para la tabla de vocabulario (mínimo 10 palabras, bien organizada). */
export const VOCABULARY_RULES =
  "VOCABULARIO: tabla con pipes de MÍNIMO 10 filas (10-15), sin filas vacías, con esta cabecera exacta: " +
  "| Palabra o expresión | Tipo | Significado | Ejemplo en contexto |. " +
  "\"Tipo\" es la categoría gramatical abreviada (sust., verbo, adj., adv., expr.). Ordena las filas agrupadas por tipo y, dentro de cada grupo, alfabéticamente. " +
  "El significado es breve y claro (máx. 12 palabras) y el ejemplo es una oración completa distinta de la lectura.";

/** Idiomas de apoyo para la clase bilingüe */
/**
 * Idiomas de las clases (idioma de la clase y lengua nativa de los alumnos usan
 * la MISMA lista): los básicos primero; "Otro" permite escribir cualquier idioma.
 */
export const CLASS_LANGUAGES = [
  "Español", "English", "Français", "Deutsch", "Italiano", "Português",
  "中文 (Chino)", "日本語 (Japonés)", "한국어 (Coreano)", "العربية (Árabe)", "Русский (Ruso)", "Nederlands (Neerlandés)", "Türkçe (Turco)", "हिन्दी (Hindi)",
];
export const OTHER_LANGUAGE = "Otro…";
/** @deprecated usar CLASS_LANGUAGES */
export const NATIVE_LANGUAGES = CLASS_LANGUAGES;

/**
 * Clase bilingüe (sobre todo A1): el alumno se apoya en su idioma nativo sin
 * dejar de practicar el idioma que aprende.
 */
export function bilingualRules(nativeLanguage: string): string {
  return [
    `CLASE BILINGÜE: el alumno habla ${nativeLanguage}. La lección se escribe en el idioma que aprende, con apoyo en ${nativeLanguage}:`,
    `- Explicaciones de gramática y teoría: cada párrafo va seguido, en la línea siguiente, de su traducción a ${nativeLanguage} en cursiva: *${nativeLanguage}: …*.`,
    `- Tablas de vocabulario: añade la columna "${nativeLanguage}" después de "Palabra o expresión" (cabecera: | Palabra o expresión | ${nativeLanguage} | Tipo | Significado | Ejemplo en contexto |).`,
    `- Consignas de los ejercicios: en los dos idiomas (\"Completa las oraciones. / …en ${nativeLanguage}\").`,
    `- Diálogos: cada línea lleva su traducción a ${nativeLanguage} en el campo "translation".`,
    `- La LECTURA y las RESPUESTAS de los ejercicios van SOLO en el idioma que se aprende (para no quitar la práctica real); tras la lectura, añade "### Glosario" con las 6-8 palabras más difíciles traducidas a ${nativeLanguage}.`,
    `- Los recuadros "💡 Consejo" pueden comparar con ${nativeLanguage} (falsos amigos, diferencias de estructura) cuando ayude.`,
  ].join("\n");
}

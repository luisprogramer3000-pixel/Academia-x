import { normalize } from "./text";

/**
 * Iconos (emoji) para conceptos y vocabulario cuando no hay imagen. Se buscan
 * por palabra clave en español e inglés; PowerPoint los muestra en color con
 * la fuente "Segoe UI Emoji" y siguen siendo texto editable.
 */

const DICTIONARY: Array<[string[], string]> = [
  // Transporte
  [["coche", "carro", "auto", "automovil", "car"], "🚗"],
  [["bicicleta", "bici", "bicycle", "bike", "ciclismo"], "🚲"],
  [["autobus", "bus", "omnibus", "colectivo", "buseta"], "🚌"],
  [["tren", "train", "ferrocarril", "ferroviario", "railway"], "🚆"],
  [["avion", "airplane", "plane", "aereo", "vuelo", "flight", "aeropuerto", "airport"], "✈️"],
  [["barco", "boat", "ship", "maritimo", "ferry", "buque", "acuatico"], "🚢"],
  [["moto", "motocicleta", "motorbike", "motorcycle", "scooter"], "🏍️"],
  [["metro", "subway", "underground", "subte"], "🚇"],
  [["taxi", "cab"], "🚕"],
  [["camion", "truck", "lorry"], "🚚"],
  [["caminar", "andar", "walk", "walking", "pie", "peaton"], "🚶"],
  [["helicoptero", "helicopter"], "🚁"],
  [["cohete", "rocket", "espacial"], "🚀"],
  [["tranvia", "tram"], "🚊"],
  [["patinete", "monopatin", "skateboard"], "🛴"],
  [["transporte", "transport", "vehiculo", "vehicle", "movilidad"], "🚉"],
  [["publico", "public", "compartido", "colectivo"], "👥"],
  [["personal", "privado", "private", "individual"], "👤"],
  [["terrestre", "carretera", "road", "land"], "🛣️"],
  [["rieles", "vias", "rails"], "🛤️"],
  [["aire", "air", "sky", "cielo"], "☁️"],
  [["agua", "water", "mar", "sea", "rio", "river"], "🌊"],
  // Escuela y lenguaje
  [["objetivo", "meta", "goal", "objective", "aim"], "🎯"],
  [["vocabulario", "vocabulary", "palabras", "words"], "🔤"],
  [["gramatica", "grammar", "estructura", "structure", "regla", "rule"], "🧩"],
  [["leer", "lectura", "read", "reading", "libro", "book"], "📖"],
  [["escribir", "escritura", "write", "writing", "redaccion"], "✏️"],
  [["hablar", "speak", "speaking", "conversacion", "conversation", "dialogo", "dialogue", "talk"], "💬"],
  [["escuchar", "listen", "listening", "audio"], "🎧"],
  [["pregunta", "question", "duda"], "❓"],
  [["idea", "concepto", "concept", "pensar", "think"], "💡"],
  [["ejemplo", "example"], "📌"],
  [["resumen", "summary", "conclusion"], "📝"],
  [["practica", "practice", "ejercicio", "exercise"], "🏋️"],
  [["juego", "game", "reto", "challenge"], "🎲"],
  [["tiempo", "time", "hora", "clock", "reloj", "horario"], "⏰"],
  [["dinero", "money", "precio", "price", "costo", "cost"], "💰"],
  [["rapido", "fast", "velocidad", "speed"], "⚡"],
  [["lento", "slow"], "🐢"],
  [["seguro", "seguridad", "safe", "safety"], "🛡️"],
  [["ecologico", "medio ambiente", "environment", "contaminacion", "pollution", "verde", "green"], "🌱"],
  [["ciudad", "city", "urbano", "urban"], "🏙️"],
  [["casa", "hogar", "home", "house"], "🏠"],
  [["escuela", "colegio", "school", "clase", "classroom"], "🏫"],
  [["familia", "family"], "👨‍👩‍👧"],
  [["amigo", "friend", "companero", "partner"], "🤝"],
  [["trabajo", "work", "job", "empresa", "company"], "💼"],
  [["viaje", "viajar", "travel", "trip", "turismo"], "🧳"],
  [["mapa", "map", "geografia", "geography", "mundo", "world", "pais", "country"], "🌍"],
  [["historia", "history", "pasado", "past"], "🏛️"],
  [["futuro", "future"], "🔮"],
  [["presente", "present", "hoy", "today"], "📅"],
  [["ciencia", "science", "experimento", "experiment"], "🔬"],
  [["matematica", "math", "numero", "number", "calculo"], "🔢"],
  [["suma", "addition", "sumar"], "➕"],
  [["resta", "subtraction", "restar"], "➖"],
  [["multiplicacion", "multiply"], "✖️"],
  [["division", "divide"], "➗"],
  [["fraccion", "fraction"], "🍕"],
  [["geometria", "geometry", "figura", "shape", "triangulo", "circulo"], "📐"],
  [["planta", "plant", "arbol", "tree", "fotosintesis"], "🌳"],
  [["animal", "animales", "fauna"], "🐾"],
  [["perro", "dog"], "🐶"],
  [["gato", "cat"], "🐱"],
  [["cuerpo", "body", "salud", "health"], "🫀"],
  [["comida", "food", "alimento", "comer", "eat"], "🍎"],
  [["bebida", "drink", "beber"], "🥤"],
  [["sol", "sun", "solar"], "☀️"],
  [["luna", "moon"], "🌙"],
  [["planeta", "planet", "tierra", "earth"], "🌎"],
  [["energia", "energy", "electricidad", "electricity"], "🔋"],
  [["clima", "weather", "lluvia", "rain"], "🌦️"],
  [["musica", "music", "cancion", "song"], "🎵"],
  [["arte", "art", "pintura", "paint", "dibujo"], "🎨"],
  [["deporte", "sport", "futbol", "football", "soccer"], "⚽"],
  [["tecnologia", "technology", "computadora", "computer", "internet"], "💻"],
  [["telefono", "phone", "movil", "celular"], "📱"],
  [["ropa", "clothes", "clothing"], "👕"],
  [["emocion", "emotion", "sentimiento", "feeling", "feliz", "happy"], "😊"],
  [["verbo", "verb", "accion", "action"], "🏃"],
  [["sustantivo", "noun"], "🏷️"],
  [["adjetivo", "adjective"], "🎨"],
  [["comparar", "comparacion", "compare", "comparison", "versus", "diferencia"], "⚖️"],
  [["proceso", "process", "paso", "step", "etapa"], "🔁"],
  [["lugar", "place", "donde", "where"], "📍"],
  [["persona", "people", "personas", "gente"], "🧑"],
];

const INDEX: Array<[string, string]> = DICTIONARY.flatMap(([words, emoji]) => words.map((w) => [normalize(w), emoji] as [string, string]));

/** Emoji para un término, o undefined si no hay uno razonable. */
export function emojiFor(text: string): string | undefined {
  const n = ` ${normalize(text).replace(/[^a-z0-9ñ ]+/g, " ")} `;
  // Primero coincidencias de palabra completa, por orden de aparición en el texto
  let best: { pos: number; emoji: string } | undefined;
  for (const [word, emoji] of INDEX) {
    const variants = [` ${word} `, ` ${word}s `, ` ${word}es `];
    for (const v of variants) {
      const pos = n.indexOf(v);
      if (pos >= 0 && (!best || pos < best.pos)) best = { pos, emoji };
    }
  }
  return best?.emoji;
}

/** ¿El texto empieza por un emoji? Lo separa del resto. */
export function splitLeadingEmoji(text: string): { emoji?: string; text: string } {
  const m = text.match(/^\s*(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*(.*)$/u);
  return m ? { emoji: m[1], text: m[2] } : { text };
}

export const ROLE_EMOJI: Record<string, string> = {
  hook: "🤔",
  objectives: "🎯",
  vocabulary: "🔤",
  grammar: "🧩",
  example: "📌",
  comparison: "⚖️",
  process: "🔁",
  mind_map: "🧠",
  dialogue: "💬",
  practice: "✏️",
  production: "🗣️",
  reflection: "💭",
  quiz: "❓",
  assessment: "✅",
  summary: "⭐",
  exit_ticket: "🎟️",
  reading: "📖",
  concept: "💡",
  explanation: "💡",
};

export const STEP_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

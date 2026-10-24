/**
 * Genera src/modules/presentation/engine/vector-icons.data.ts: el dibujo vectorial
 * (trazo, 24×24) de cada icono que usan las presentaciones cuando no hay imagen.
 *
 *   node scripts/build-vector-icons.mjs
 *
 * La mayoría salen de Lucide (licencia ISC, ya instalado con lucide-react); los
 * que Lucide no tiene (nariz, boca, cabeza, silla…) están dibujados aquí mismo.
 * La clave es el emoji que el motor ya asigna a cada concepto (icons.ts).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LUCIDE = path.join(ROOT, "node_modules/lucide-react/dist/esm/icons");
const OUT = path.join(ROOT, "src/modules/presentation/engine/vector-icons.data.ts");

/** Dibujos propios, mismo estilo que Lucide (trazo 2, puntas redondeadas) */
const CUSTOM = {
  head: '<path d="M16 21v-3h1.5a2 2 0 0 0 2-2v-2.5l1.5-.8-1.6-3.2A7.5 7.5 0 1 0 7 15.2V21"/>',
  nose: '<path d="M12.5 3c-.4 4.5-3.6 8.6-3.6 12"/><path d="M8.9 15a3.1 3.1 0 0 0 3.1 3.1 3.1 3.1 0 0 0 3.1-3.1c0-1.3-.8-2.2-1.8-2.6"/><path d="M5.5 19.5c1.6 0 2.9-.9 3.4-2.2"/><path d="M18.5 19.5c-1.6 0-2.9-.9-3.4-2.2"/>',
  lips: '<path d="M2 12c2.5-3.5 5.5-5 7.5-4.2L12 9l2.5-1.2c2-.8 5 .7 7.5 4.2"/><path d="M2 12c2.5 3.8 6 5.8 10 5.8s7.5-2 10-5.8"/><path d="M2 12c3.5 1 6.5 1.5 10 1.5s6.5-.5 10-1.5"/>',
  leg: '<path d="M9 2v8.5c0 1 .3 2 .8 2.8l1 1.7c.4.7.2 1.6-.4 2.1L7 20v2h9.5a1.5 1.5 0 0 0 .6-2.9L14 18l-.4-3.6c-.1-1 0-2 .3-2.9L15 8V2"/>',
  chair: '<path d="M7 2v20"/><path d="M7 13h10v9"/><path d="M7 2h4"/><path d="M7 8h4"/><path d="M11 2v11"/>',
  table: '<path d="M2 8h20"/><path d="M4 8v13"/><path d="M20 8v13"/><path d="M4 13h16"/><rect x="2" y="5" width="20" height="3" rx="1"/>',
  window: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18"/><path d="M4 12h16"/><path d="M2 21h20"/>',
  letterA: '<circle cx="12" cy="12" r="10"/><path d="m8.5 16.5 3.5-9 3.5 9"/><path d="M9.8 13.5h4.4"/>',
  letterB: '<circle cx="12" cy="12" r="10"/><path d="M9.5 7.5h3a2.25 2.25 0 0 1 0 4.5h-3z"/><path d="M9.5 12h3.6a2.25 2.25 0 0 1 0 4.5H9.5z"/>',
};

/** emoji (clave del motor) → icono de Lucide o dibujo propio ("custom:…") */
const MAP = {
  // Lugares
  "📚": "library", "☕": "coffee", "🎬": "film", "🌳": "trees", "🧭": "compass", "🍽️": "utensils",
  "🏥": "hospital", "🖼️": "image", "🎭": "drama", "🏖️": "tree-palm", "⛰️": "mountain", "🛍️": "shopping-bag",
  "🛒": "shopping-cart", "🏦": "landmark", "🏨": "hotel", "💊": "pill", "⛪": "church", "🏟️": "dumbbell",
  "🏢": "building-2", "🎓": "graduation-cap", "⛲": "landmark", "🛣️": "route", "🚉": "train-front", "✉️": "mail",
  "🚓": "siren", "🚒": "flame", "🥖": "croissant", "🦁": "paw-print", "🏊": "waves", "🍹": "wine",
  // Transporte
  "🚗": "car", "🚲": "bike", "🚌": "bus", "🚆": "train-front", "✈️": "plane", "🚢": "ship", "🏍️": "bike",
  "🚇": "train-front-tunnel", "🚕": "car-taxi-front", "🚚": "truck", "🚶": "footprints", "🚁": "plane",
  "🚀": "rocket", "🚊": "tram-front", "🛴": "bike", "👥": "users", "👤": "user", "🛤️": "train-track",
  "☁️": "cloud", "🌊": "waves",
  // Escuela, lenguaje y temas generales
  "🎯": "target", "🔤": "whole-word", "🧩": "puzzle", "📖": "book-open", "✏️": "pencil", "💬": "message-circle",
  "🎧": "headphones", "❓": "circle-help", "💡": "lightbulb", "📌": "pin", "📝": "notebook-pen", "🏋️": "dumbbell",
  "🎲": "dice-5", "⏰": "clock", "💰": "coins", "⚡": "zap", "🐢": "turtle", "🛡️": "shield", "🌱": "sprout",
  "🏙️": "building-2", "🏠": "house", "🏫": "school", "👨‍👩‍👧": "users", "🤝": "handshake", "💼": "briefcase",
  "🧳": "luggage", "🌍": "globe", "🏛️": "landmark", "🔮": "sparkles", "📅": "calendar", "🔬": "microscope",
  "🔢": "calculator", "➕": "plus", "➖": "minus", "✖️": "x", "➗": "divide", "🍕": "pizza", "📐": "shapes",
  "🐾": "paw-print", "🐶": "dog", "🐱": "cat", "🍎": "apple", "🥤": "cup-soda", "☀️": "sun", "🌙": "moon",
  "🌎": "earth", "🔋": "battery-full", "🌦️": "cloud-sun-rain", "🎵": "music", "🎨": "palette", "⚽": "volleyball",
  "💻": "laptop", "📱": "smartphone", "👕": "shirt", "😊": "smile", "🏃": "footprints", "🏷️": "tag",
  "⚖️": "scale", "🔁": "repeat", "📍": "map-pin", "🧑": "user-round",
  // Cuerpo
  "🙂": "custom:head", "👁️": "eye", "👃": "custom:nose", "👄": "custom:lips", "👂": "ear", "✋": "hand",
  "🦶": "footprints", "💪": "biceps-flexed", "🦵": "custom:leg", "❤️": "heart", "🦴": "bone",
  "🧍": "person-standing", "🩺": "stethoscope",
  // Casa y objetos
  "🪑": "custom:chair", "🪵": "custom:table", "🛏️": "bed", "🛋️": "sofa", "🪔": "lamp", "🚪": "door-open",
  "🪟": "custom:window", "🛁": "bath", "🍳": "cooking-pot", "🧊": "refrigerator", "📺": "tv", "📷": "camera",
  "🎸": "guitar", "🎒": "backpack", "👓": "glasses", "☂️": "umbrella", "🎁": "gift", "🔑": "key",
  "📓": "notebook", "🧮": "calculator", "🧑‍🏫": "presentation",
  // Comida
  "🥗": "salad", "🐟": "fish", "🍦": "ice-cream-cone", "🎂": "cake", "🥛": "milk", "🥚": "egg", "🥕": "carrot",
  "🍌": "banana", "🍇": "grape", "🍒": "cherry", "🍲": "soup", "🍗": "drumstick",
  // Naturaleza
  "🌸": "flower-2", "🍃": "leaf", "❄️": "snowflake", "🌬️": "wind", "🌲": "tree-pine", "🏝️": "tree-palm",
  "⛺": "tent", "🐦": "bird",
  // Papeles de diapositiva (ROLE_EMOJI)
  "🤔": "message-circle-question", "🧠": "brain", "🗣️": "speech", "💭": "message-circle-more",
  "✅": "circle-check", "⭐": "star", "🎟️": "ticket",
  // Otros iconos fijos del motor
  "⏱️": "timer", "🔍": "search", "🔎": "search", "📘": "book", "🅰️": "custom:letterA", "🅱️": "custom:letterB",
};

function lucideSvg(name) {
  const src = readFileSync(path.join(LUCIDE, `${name}.js`), "utf8");
  const m = src.match(/createLucideIcon\("[^"]+",\s*(\[[\s\S]*\])\);/);
  if (!m) throw new Error(`No se pudo leer el icono ${name}`);
  const nodes = Function(`"use strict"; return (${m[1]});`)();
  return nodes
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
}

const out = {};
for (const [emoji, name] of Object.entries(MAP)) {
  out[emoji] = name.startsWith("custom:") ? CUSTOM[name.slice(7)] : lucideSvg(name);
  if (!out[emoji]) throw new Error(`Falta el dibujo ${name}`);
}

writeFileSync(
  OUT,
  `// Generado por scripts/build-vector-icons.mjs; no editar a mano.
// Iconos de Lucide (https://lucide.dev, licencia ISC) y dibujos propios.
export const VECTOR_ICONS: Record<string, string> = ${JSON.stringify(out, null, 2)};
`
);
console.log(`${Object.keys(out).length} iconos → ${path.relative(ROOT, OUT)}`);

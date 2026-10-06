/**
 * Fuentes: los modelos de Canva usan tipografías que el profesor no suele
 * tener instaladas (PowerPoint las sustituiría sin control). Se mapean a
 * familias equivalentes disponibles en Windows/Office/macOS conservando su
 * carácter (sans geométrica, serif, mecanografiada, manuscrita, display).
 */

const SAFE = new Set([
  "Arial", "Arial Black", "Calibri", "Cambria", "Candara", "Century Gothic", "Comic Sans MS", "Consolas", "Constantia",
  "Corbel", "Courier New", "Franklin Gothic Medium", "Georgia", "Gill Sans MT", "Impact", "Lucida Sans", "Palatino Linotype",
  "Segoe UI", "Segoe UI Black", "Segoe UI Semibold", "Segoe Print", "Segoe Script", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana", "Aptos",
]);

const RULES: Array<[RegExp, string]> = [
  [/montserrat|poppins|raleway|nunito|quicksand|futura|avenir|gotham|josefin|league spartan|glacial|didact|comfortaa|mulish|outfit|urbanist|questrial/i, "Century Gothic"],
  [/open sans|lato|roboto|inter|source sans|noto sans|helvetica|work sans|dm sans|manrope|karla|rubik|heebo|barlow|archivo|arimo|pt sans|fira sans|ibm plex sans/i, "Calibri"],
  [/oswald|bebas|anton|league gothic|fjalla|archivo black|alfa slab|bungee|black han|titan|luckiest|bowlby|chango|passion one|staatliches/i, "Arial Black"],
  [/playfair|merriweather|lora|libre baskerville|garamond|crimson|cormorant|dm serif|abril|prata|pt serif|noto serif|bodoni|didot|cinzel|times|serif/i, "Georgia"],
  [/typewriter|courier|mono|space mono|roboto mono|ibm plex mono|special elite|anonymous|inconsolata|tlwg/i, "Courier New"],
  [/shantell|avallon|sue ellen|coming soon|architects|gochi|nanum pen|covered by|kg |dk |just another|homemade|rock salt|permanent marker|pacifico|dancing|great vibes|sacramento|satisfy|allura|parisienne|script|brush|lobster|cookie|yellowtail|kaushan|amatic|caveat|shadows|patrick|indie|gloria|kalam|handlee|reenie|hand|marker|chalk|sketch|crayon|kids|comic|fredoka|baloo|chewy|sniglet|grandstander|schoolbell/i, "Segoe Print"],
  [/glacial|open sauce|now |canva sans|sans/i, "Segoe UI Semibold"],
  [/heartland/i, "Segoe UI Semibold"],
];

export function mapFont(name: string | undefined, fallback = "Calibri"): string {
  if (!name) return fallback;
  const clean = name.replace(/^\+(mj|mn)-lt$/, "").trim();
  if (!clean) return fallback;
  if (SAFE.has(clean)) return clean;
  for (const [re, font] of RULES) if (re.test(clean)) return font;
  return fallback;
}

/** Ancho medio de carácter, en ems, por familia (para estimar líneas). */
export function averageCharWidth(font: string): number {
  if (/courier|consolas|mono/i.test(font)) return 0.6;
  if (/arial black|impact|segoe ui black/i.test(font)) return 0.62;
  if (/century gothic|verdana|segoe print|comic/i.test(font)) return 0.56;
  if (/georgia|cambria|times|palatino|constantia/i.test(font)) return 0.5;
  return 0.5;
}

export const EMOJI_FONT = "Segoe UI Emoji";

import { VECTOR_ICONS } from "./vector-icons.data";

/**
 * Iconos vectoriales: el mismo concepto que el emoji, dibujado con trazo en el
 * color de la academia (más sobrio y legible que un emoji en una diapositiva).
 */

const VS16 = "️";

/** Dibujo (contenido SVG 24×24) para un emoji, con o sin selector de variante. */
export function vectorIconFor(emoji: string): string | undefined {
  const bare = emoji.split(VS16).join("");
  return VECTOR_ICONS[emoji] ?? VECTOR_ICONS[bare] ?? VECTOR_ICONS[`${bare}${VS16}`];
}

/** SVG completo listo para rasterizar. */
export function vectorIconSvg(body: string, color: string, sizePx: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 24 24" fill="none" stroke="#${color.replace(/^#/, "")}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

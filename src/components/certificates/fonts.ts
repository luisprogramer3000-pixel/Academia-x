import localFont from "next/font/local";

/**
 * Tipografías de los certificados, incluidas en el proyecto (./fonts, subconjunto latin,
 * licencia OFL vía @fontsource): la compilación no depende de Google Fonts y funcionan al imprimir.
 * next/font/local exige valores literales: no se pueden generar las rutas con una función.
 */
export const cinzel = localFont({
  src: [
    { path: "./fonts/cinzel-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cinzel-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cinzel-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const cormorant = localFont({
  src: [
    { path: "./fonts/cormorant-garamond-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-600-italic.woff2", weight: "600", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-700-italic.woff2", weight: "700", style: "italic" },
  ],
  display: "swap",
});

export const greatVibes = localFont({
  src: [{ path: "./fonts/great-vibes-latin-400-normal.woff2", weight: "400", style: "normal" }],
  display: "swap",
});

export const montserrat = localFont({
  src: [
    { path: "./fonts/montserrat-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/montserrat-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/montserrat-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/montserrat-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
});

export const playfair = localFont({
  src: [
    { path: "./fonts/playfair-display-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/playfair-display-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/playfair-display-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "./fonts/playfair-display-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/playfair-display-latin-600-italic.woff2", weight: "600", style: "italic" },
    { path: "./fonts/playfair-display-latin-700-italic.woff2", weight: "700", style: "italic" },
  ],
  display: "swap",
});

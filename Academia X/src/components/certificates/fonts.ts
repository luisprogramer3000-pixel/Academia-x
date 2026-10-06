import { Cinzel, Cormorant_Garamond, Great_Vibes, Montserrat, Playfair_Display } from "next/font/google";

/** Tipografías de los certificados (Next las descarga y sirve localmente: funcionan al imprimir). */
export const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "600", "700"], display: "swap" });
export const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], display: "swap" });
export const greatVibes = Great_Vibes({ subsets: ["latin"], weight: ["400"], display: "swap" });
export const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });
export const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["normal", "italic"], display: "swap" });

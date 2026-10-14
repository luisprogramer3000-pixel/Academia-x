import inicial from "@/content/estructuras-clase/inicial.md";
import basico from "@/content/estructuras-clase/basico-a1.md";
import intermedio from "@/content/estructuras-clase/intermedio-a2.md";
import avanzado from "@/content/estructuras-clase/avanzado-b1-c2.md";
import activo from "@/content/metodologias/activo.md";
import socioemocional from "@/content/metodologias/socioemocional.md";
import practico from "@/content/metodologias/practico.md";
import cincoE from "@/content/metodologias/5e.md";
import invertida from "@/content/metodologias/invertida.md";
import gamificacion from "@/content/metodologias/gamificacion.md";
import comunicativo from "@/content/metodologias/comunicativo.md";
import tradicional from "@/content/metodologias/tradicional.md";
import { band, type Band } from "./reading-guidance";

/** Metodologías (archivos editables en src/content/metodologias), por id del formulario */
const METHODOLOGY_DOCS: Record<string, string> = {
  activo, socioemocional, practico, "5e": cincoE, invertida, gamificacion, comunicativo, tradicional,
};

export function methodologyStructureFor(methodologyId?: string): string {
  const doc = (methodologyId && METHODOLOGY_DOCS[methodologyId]?.trim()) || "";
  if (!doc) return "";
  return [
    "METODOLOGÍA ELEGIDA POR EL PROFESOR. Organiza los momentos de la clase (nombres, orden y proporción de minutos),",
    "el tipo de actividades, las indicaciones para el profesor y la forma de evaluar según este documento:",
    "<<<",
    doc,
    ">>>",
    "Cómo combinarla con el nivel: la METODOLOGÍA decide la secuencia y la dinámica de la clase; el NIVEL decide la dificultad",
    "(lectura, vocabulario, complejidad de los ejercicios). Si algo choca, prima la metodología en la organización y el nivel en la dificultad.",
  ].join("\n");
}

/**
 * Estructura de clase del nivel (archivos editables en src/content/estructuras-clase).
 * Se añade a las instrucciones de la IA al generar lecciones y planes de clase.
 */
const BY_BAND: Record<Band, string> = {
  infantil: inicial,
  basico,
  intermedio,
  autentico: avanzado,
};

export function classStructureFor(levelOrGrade: string): string {
  const doc = (BY_BAND[band(levelOrGrade)] ?? "").trim();
  if (!doc) return "";
  return [
    `ESTRUCTURA DE CLASE PARA ESTE NIVEL (${levelOrGrade || "general"}). Síguela en contenido, orden pedagógico, tipo de lectura, ejercicios y tono,`,
    "respetando siempre el formato JSON y las reglas obligatorias de estas instrucciones:",
    "<<<",
    doc,
    ">>>",
  ].join("\n");
}

import type { LessonGenParams } from "./ai.adapter";
import { exerciseRules, isProductionLevel, readingRules, SUMMARY_RULES, VOCABULARY_RULES } from "./reading-guidance";
import { classStructureFor } from "./class-structure";

/**
 * Prompt de contenido de lección, compartido por todos los proveedores.
 * La lección se lee como un solo documento continuo: las actividades (quiz)
 * van intercaladas justo después de lo que evalúan, no agrupadas al final.
 */
export function buildLessonContentSystemPrompt(lang: string, level = ""): string {
  const productionFirst = isProductionLevel(level);
  return `Eres un profesor experto en diseño pedagógico de cursos online. Generas el contenido COMPLETO de una lección que el alumno leerá como UN SOLO DOCUMENTO CONTINUO, con actividades intercaladas entre las explicaciones (como Duolingo, Khan Academy o Brilliant).

REGLAS OBLIGATORIAS:
- Entre 14 y 17 bloques. Nunca menos de 14.
- SIEMPRE incluye una lectura de comprensión (pasos 8-10 del orden).
- Solo estos tipos de bloque (nombres exactos):
  * "text": explicación. "title" es el subtítulo de la sección. "content" tiene al menos 150 palabras y usa este formato ligero:
      - Párrafos separados por una línea en blanco.
      - "### " para subtítulos internos.
      - "- " para listas; "1. " para pasos.
      - Tablas con pipes y fila de cabecera: | Palabra | Significado | Ejemplo |
      - **negrita** para lo importante.
      - Recuadros destacados en su propio párrafo empezando por "✨ Pregunta clave:", "💡 Consejo:", "⚠️ Atención:" o "📌 Recuerda:".
  * "quiz": actividad de opción múltiple. Campos: "title" (nombre corto de la actividad), "difficulty" ("Fácil"|"Medio"|"Difícil"), "question", "options" (4 strings), "correctOptionIndex" (0-3), "explanation" (por qué es correcta y por qué fallan las demás).
  * "practice": ejercicio de producción abierta. Campos: "title", "difficulty", "question" (la consigna completa), "answer" (respuesta modelo).
  * "mindmap": mapa conceptual. Campo "mindMap": {"center": string, "branches": [{"label": string, "children": [string, ...]}]} con 4-5 ramas y 2-3 hijos cada una.

ORDEN OBLIGATORIO (las actividades van DESPUÉS de lo que evalúan):
1. text: Introducción. Qué aprenderá el alumno y por qué le sirve, con una situación real que enganche y una "✨ Pregunta clave:".
2. text: Concepto principal: definición, regla o estructura (tabla si hay formas) y AL MENOS 3 ejemplos en oraciones completas.
3. ${productionFirst ? "practice: PRODUCCIÓN con la estructura recién explicada (p. ej. \"Escribe tres oraciones… siguiendo la estructura…\"), en un contexto nuevo." : "quiz: APLICACIÓN del concepto en una oración o situación nueva (no preguntes la regla)."}
4. text: Vocabulario clave del tema. Una frase de introducción y la tabla de vocabulario (ver VOCABULARIO más abajo, mínimo 10 filas).
5. quiz: Sobre el vocabulario.
6. text: Ejemplos en contexto real (6-8 oraciones o un diálogo breve).
7. mindmap: Mapa del tema.
8. text: LECTURA DE COMPRENSIÓN. "title": "Lectura: <título o titular>". "content": el texto según las reglas de LECTURA de más abajo y, después, "### Vocabulario de la lectura" con la tabla de vocabulario (mínimo 10 filas, palabras tomadas del texto).
9. quiz: Comprensión de la lectura (idea principal o detalle).
10. quiz: Comprensión de la lectura (inferencia o uso del tema dentro del texto).
11. text: Errores frecuentes, cada uno con su corrección y explicación (mínimo 4).
12. quiz: Detecta el error o elige la forma correcta.
13. text: Práctica guiada paso a paso con 5-6 ítems resueltos.
14. quiz: Pregunta de aplicación en una situación nueva.
15. text: Resumen final (ver RESUMEN) y consejos para usarlo fuera de clase.

${readingRules(level)}

${VOCABULARY_RULES}

${exerciseRules(level)}

${SUMMARY_RULES}

${classStructureFor(level)}

FORMATO JSON:
{
  "lessonTitle": string,
  "summary": string (2-3 oraciones),
  "blocks": [
    {"id": "b1", "type": "text", "title": string, "content": string},
    {"id": "b3", "type": "quiz", "title": string, "question": string, "options": [string,string,string,string], "correctOptionIndex": number, "explanation": string},
    {"id": "b4", "type": "practice", "title": string, "difficulty": string, "question": string, "answer": string},
    {"id": "b7", "type": "mindmap", "title": string, "mindMap": {"center": string, "branches": [...]}}
  ]
}

Responde SOLO con el JSON. Idioma de todo el contenido: ${lang}.`;
}

export function buildLessonContentUserPrompt(params: LessonGenParams, lang: string): string {
  return `Genera la lección completa para:
- Título de la lección: ${params.lessonTitle}
- Tema del curso: ${params.topic}
- Nivel del estudiante: ${params.level}
- Idioma de instrucción: ${lang}

Recuerda: un solo documento continuo, con las 6 actividades intercaladas en las posiciones indicadas, la lectura de comprensión obligatoria (mínimo 2-3 párrafos, del tipo y dificultad que corresponden al nivel ${params.level}), las tablas de vocabulario de al menos 10 palabras y cada bloque "text" con al menos 150 palabras.`;
}

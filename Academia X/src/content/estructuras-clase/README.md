# Estructuras de clase por nivel

Estos archivos definen **cómo es una clase** según el nivel que elige el profesor.
La IA lee el archivo del nivel correspondiente cada vez que genera una lección o un
plan de clase, así que **editar estos archivos cambia las lecciones que se generan**
(no hace falta tocar código).

| Archivo | Se usa para |
|---|---|
| `inicial.md` | Primaria (6-8 años) |
| `basico-a1.md` | ELE A1 · Primaria (9-12 años) |
| `intermedio-a2.md` | ELE A2 · Secundaria |
| `avanzado-b1-c2.md` | ELE B1, B2, C1, C2 · Bachillerato · Universidad · Adultos |

## Cómo editarlos

- Escribe en lenguaje normal, como si le explicaras a un profesor nuevo cómo preparar la clase.
- Mantén las secciones (`## Secciones de la clase`, `## Lectura`, `## Vocabulario`, `## Ejercicios`, …):
  la IA las usa como guía.
- Cambia los números con cuidado (párrafos, palabras, ejercicios): la IA los respeta.
- Tras editar un archivo, reinicia el servidor (`npm run dev`) o vuelve a publicar la plataforma.

## Reglas que siempre se cumplen (están en el código)

Aunque se borre algo de estos archivos, la plataforma siempre exige:

- Lectura de comprensión de **mínimo 2-3 párrafos**.
- Tabla de vocabulario de **mínimo 10 palabras** con su tipo, significado y ejemplo.
- Ejercicios que **aplican** lo aprendido (nunca preguntar lo que acaba de explicarse).
- Resumen final en **lista vertical**.
- Si el profesor activa **Clase bilingüe**: explicaciones traducidas, columna de traducción en
  el vocabulario, consignas en los dos idiomas y lectura solo en el idioma que se aprende.

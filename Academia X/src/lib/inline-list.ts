/**
 * Enumeración escrita en una sola línea ("1. Uno. 2. Dos. 3. Tres.") → ["Uno.", "Dos.", "Tres."].
 * Solo si los números van seguidos (1, 2, 3…), para no partir frases que citan números.
 * Devuelve null si el texto no es una enumeración.
 */
export function splitInlineList(text: string): string[] | null {
  const marks = [...text.matchAll(/(?:^|\s)(\d{1,2})[.)]\s+/g)];
  if (marks.length < 2) return null;
  const start = Number(marks[0][1]);
  if (!marks.every((m, i) => Number(m[1]) === start + i)) return null;
  const before = text.slice(0, marks[0].index).trim();
  const items = marks.map((m, i) => text.slice(m.index! + m[0].length, marks[i + 1]?.index ?? text.length).trim()).filter(Boolean);
  return before ? [before, ...items] : items;
}

import { Fragment, type ReactNode } from "react";
import { splitInlineList } from "@/lib/inline-list";

/**
 * Renderiza el texto de una lección (formato ligero tipo markdown) como
 * elementos React: nunca inyecta HTML, así que el contenido es seguro.
 * Soporta: ### subtítulos, listas "- " y "1. ", tablas con pipes, **negrita**
 * y recuadros que empiezan por 💡 / ⚠️ / 📌 / "Nota:" / "Consejo:"...
 */

type Node =
  | { kind: "heading"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "callout"; tone: Tone; text: string }
  | { kind: "p"; lines: string[] };

type Tone = "tip" | "warn" | "note" | "question";

const CALLOUTS: Array<{ re: RegExp; tone: Tone }> = [
  { re: /^(✨|❓|pregunta clave:)/i, tone: "question" },
  { re: /^(💡|consejo:|tip:)/i, tone: "tip" },
  { re: /^(⚠️|⚠|atención:|atencion:|importante:|cuidado:)/i, tone: "warn" },
  { re: /^(📌|recuerda:|nota:)/i, tone: "note" },
];

const isTableLine = (l: string) => (l.match(/\|/g) || []).length >= 2;
const isSeparatorRow = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const splitRow = (l: string) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

function parse(text: string): Node[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: Node[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { i++; continue; }

    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) { nodes.push({ kind: "heading", text: h[1] }); i++; continue; }

    if (isTableLine(line)) {
      const block: string[] = [];
      while (i < lines.length && isTableLine(lines[i].trim())) block.push(lines[i++].trim());
      const rows = block.filter((l) => !isSeparatorRow(l)).map(splitRow);
      if (rows.length) nodes.push({ kind: "table", header: rows[0], rows: rows.slice(1) });
      continue;
    }

    // "1. Uno. 2. Dos. 3. Tres." en una sola línea se separa en un punto por línea
    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [];
      let numbered = false;
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        // "- - texto" (viñeta duplicada por la IA) → "texto"
        const content = lines[i++].trim().replace(/^[-*•]\s+/, "").replace(/^[-*•]\s+/, "");
        const inline = splitInlineList(content);
        if (inline) numbered = true;
        items.push(...(inline ?? [content]));
      }
      nodes.push({ kind: numbered ? "ol" : "ul", items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i].trim())) {
        const content = lines[i++].trim().replace(/^\d+[.)]\s+/, "");
        items.push(...(splitInlineList(content) ?? [content]));
      }
      nodes.push({ kind: "ol", items });
      continue;
    }

    const callout = CALLOUTS.find((c) => c.re.test(line));
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^#{1,4}\s/.test(l) || isTableLine(l) || /^[-*•]\s+/.test(l) || /^\d+[.)]\s+/.test(l)) break;
      if (para.length && CALLOUTS.some((c) => c.re.test(l))) break;
      para.push(l);
      i++;
    }
    const inlineList = !callout ? splitInlineList(para.join(" ")) : null;
    if (inlineList) nodes.push({ kind: "ol", items: inlineList });
    else nodes.push(callout ? { kind: "callout", tone: callout.tone, text: para.join("\n") } : { kind: "p", lines: para });
  }
  return nodes;
}

/** **negrita** y *cursiva* */
export function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>;
    if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

const CALLOUT_STYLE: Record<Tone, string> = {
  tip: "bg-amber-50 border-amber-300 text-amber-900",
  warn: "bg-rose-50 border-rose-300 text-rose-900",
  note: "bg-sky-50 border-sky-300 text-sky-900",
  question: "bg-violet-50 border-violet-400 text-violet-950",
};

const CALLOUT_LABEL_COLOR: Record<Tone, string> = {
  tip: "text-amber-700",
  warn: "text-rose-700",
  note: "text-sky-700",
  question: "text-violet-700",
};

/** "✨ Pregunta clave: texto" → icono, etiqueta y texto por separado */
function splitCallout(text: string) {
  const m = text.match(/^(\p{Extended_Pictographic}️?)?\s*([^:\n]{2,30}):\s*([\s\S]*)$/u);
  if (!m) return { icon: null, label: null, body: text };
  return { icon: m[1] ?? null, label: m[2].trim(), body: m[3] };
}

export function LessonProse({ text, accent }: { text: string; accent: string }) {
  const nodes = parse(text);
  return (
    <div className="space-y-5 text-[17px] leading-8 text-slate-700">
      {nodes.map((n, i) => {
        switch (n.kind) {
          case "heading":
            return <h3 key={i} className="text-xl font-bold text-slate-900 pt-2">{inline(n.text)}</h3>;
          case "ul":
            return (
              <ul key={i} className="space-y-2 pl-1">
                {n.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-3 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />
                    <span>{inline(it)}</span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="space-y-2">
                {n.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-1 w-6 h-6 rounded-full text-xs font-bold text-white flex items-center justify-center shrink-0" style={{ background: accent }}>
                      {j + 1}
                    </span>
                    <span>{inline(it)}</span>
                  </li>
                ))}
              </ol>
            );
          case "table": {
            // Columna de categoría gramatical (tabla de vocabulario): se muestra como etiqueta de color
            const typeCol = n.header.findIndex((h) => /^\s*(tipo|categor[ií]a)\b/i.test(h.replace(/\*/g, "")));
            const isVocab = typeCol >= 0 || /palabra|término|termino|expresi/i.test(n.header[0] ?? "");
            return (
              <div key={i} className={`overflow-x-auto rounded-xl border ${isVocab ? "border-2" : "border-slate-200"}`} style={isVocab ? { borderColor: `${accent}55` } : undefined}>
                {isVocab && n.rows.length > 0 && (
                  <div className="px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-between" style={{ background: `${accent}14`, color: accent }}>
                    <span>📚 Vocabulario</span>
                    <span>{n.rows.length} palabras</span>
                  </div>
                )}
                <table className="w-full text-[15px]">
                  <thead>
                    <tr style={{ background: accent }}>
                      {isVocab && <th className="text-white font-semibold px-3 py-2.5 w-10">#</th>}
                      {n.header.map((c, j) => (
                        <th key={j} className="text-left text-white font-semibold px-4 py-2.5">{inline(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {n.rows.map((r, j) => (
                      <tr key={j} className="border-t border-slate-100 even:bg-slate-50">
                        {isVocab && <td className="px-3 py-2.5 align-top text-center text-sm font-semibold text-slate-400 tabular-nums">{j + 1}</td>}
                        {r.map((c, k) => (
                          <td key={k} className={`px-4 py-2.5 align-top ${k === 0 ? "font-semibold text-slate-900" : ""} ${k === typeCol ? "whitespace-nowrap" : ""}`}>
                            {k === typeCol && c.trim() ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${accent}1a`, color: accent }}>
                                {c.trim()}
                              </span>
                            ) : (
                              inline(c)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case "callout": {
            const { icon, label, body } = splitCallout(n.text);
            return (
              <div key={i} className={`border-l-4 rounded-r-2xl px-5 py-4 flex gap-4 ${CALLOUT_STYLE[n.tone]}`}>
                {icon && <span className="text-2xl leading-none pt-0.5">{icon}</span>}
                <div className="whitespace-pre-line">
                  {label && <p className={`font-bold mb-1 ${CALLOUT_LABEL_COLOR[n.tone]}`}>{label}</p>}
                  {inline(body)}
                </div>
              </div>
            );
          }
          default:
            return (
              <p key={i}>
                {n.lines.map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {inline(l)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

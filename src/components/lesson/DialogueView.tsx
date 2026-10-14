/**
 * Diálogo tipo libro de idiomas: cada personaje con su avatar y color, y las
 * burbujas alternadas a izquierda y derecha. Sin "use client": sirve en
 * servidor y en cliente.
 */

export interface DialogueLineView {
  speaker: string;
  text: string;
  translation?: string;
}

const PALETTE = [
  { bg: "#dbeafe", border: "#60a5fa", avatar: "#2563eb" },
  { bg: "#fce7f3", border: "#f472b6", avatar: "#db2777" },
  { bg: "#dcfce7", border: "#4ade80", avatar: "#16a34a" },
  { bg: "#fef3c7", border: "#fbbf24", avatar: "#d97706" },
];

export function DialogueView({ lines, large = false }: { lines: DialogueLineView[]; large?: boolean }) {
  const speakers = [...new Set(lines.map((l) => l.speaker))];
  const styleOf = (name: string) => PALETTE[speakers.indexOf(name) % PALETTE.length];

  return (
    <div className={`rounded-3xl bg-slate-50 border border-slate-100 ${large ? "p-[2.5cqw] space-y-[1.6cqw]" : "p-4 sm:p-6 space-y-4"}`}>
      {lines.map((l, i) => {
        const st = styleOf(l.speaker);
        const right = speakers.indexOf(l.speaker) % 2 === 1;
        return (
          <div key={i} className={`flex items-end gap-3 ${right ? "flex-row-reverse" : ""}`}>
            <span
              className={`${large ? "w-[4.5cqw] h-[4.5cqw] text-[2cqw]" : "w-10 h-10 text-base"} rounded-full flex items-center justify-center font-black text-white shrink-0 shadow`}
              style={{ background: st.avatar }}
              aria-hidden
            >
              {l.speaker.charAt(0).toUpperCase()}
            </span>
            <div className={`max-w-[80%] ${right ? "items-end text-right" : ""} flex flex-col`}>
              <span className={`${large ? "text-[1.4cqw]" : "text-xs"} font-bold mb-1 px-1`} style={{ color: st.avatar }}>
                {l.speaker}
              </span>
              <div
                className={`${large ? "px-[2cqw] py-[1.2cqw] text-[2.1cqw]" : "px-4 py-2.5 text-[16px]"} leading-snug text-slate-800 border-2 shadow-sm ${
                  right ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"
                }`}
                style={{ background: st.bg, borderColor: st.border }}
              >
                {l.text}
                {l.translation && (
                  <span className={`block italic text-slate-500 mt-1 ${large ? "text-[1.5cqw]" : "text-sm"}`}>{l.translation}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

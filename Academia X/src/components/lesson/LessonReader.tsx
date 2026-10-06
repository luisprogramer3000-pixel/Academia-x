"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MindMapView } from "@/components/shared/MindMapView";
import { safeExternalUrl } from "@/lib/utils";
import { checkQuizAnswerAction, submitQuizAttemptAction } from "@/app/actions/quiz.actions";
import { LessonProse } from "./LessonProse";
import type { LessonBlock } from "./lesson-blocks";
import { DialogueView } from "./DialogueView";
import { CheckCircle2, Clock, Download, ListChecks, Loader2, PencilLine, RotateCcw, XCircle } from "lucide-react";

export type { LessonBlock };

type ActivityState = {
  selected: number | null;
  status: "idle" | "checking" | "done";
  correct?: boolean;
  correctIndex?: number;
  explanation?: string;
  error?: string;
};

export function LessonReader({
  lessonId,
  title,
  eyebrow,
  blocks,
  mode,
  accent,
  actions,
  practice = false,
}: {
  lessonId: string;
  title: string;
  eyebrow?: string;
  blocks: LessonBlock[];
  mode: "preview" | "student";
  accent: string;
  actions?: ReactNode;
  /** Vista previa del profesor: corrige en local con las respuestas del bloque y no guarda nota */
  practice?: boolean;
}) {
  const quizBlocks = useMemo(() => blocks.filter((b) => b.type === "quiz" && b.options?.length), [blocks]);
  const [activities, setActivities] = useState<Record<string, ActivityState>>({});
  const [final, setFinal] = useState<{ score: number; correctCount: number; totalQuestions: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef(false);

  const doneCount = quizBlocks.filter((b) => activities[b.id]?.status === "done").length;
  const allDone = quizBlocks.length > 0 && doneCount === quizBlocks.length;

  const minutes = useMemo(() => {
    const words = blocks.reduce((acc, b) => acc + (b.content || "").split(/\s+/).length, 0);
    return Math.max(3, Math.round(words / 180) + quizBlocks.length);
  }, [blocks, quizBlocks.length]);

  const hasChapters = useMemo(() => blocks.some((b) => b.type === "chapter"), [blocks]);

  // Índice: capítulos (lecciones nuevas) o secciones y actividades (lecciones antiguas)
  const toc = useMemo(() => {
    let section = 0;
    let activity = 0;
    if (hasChapters) {
      return blocks
        .filter((b) => b.type === "chapter")
        .map((b) => ({ id: b.id, label: `${b.emoji ?? ""} ${b.label ?? ""}`.trim(), detail: b.title ?? "", kind: "section" as const, n: ++section }));
    }
    return blocks
      .map((b) => {
        if (b.type === "quiz") return { id: b.id, label: b.title || `Actividad ${activity + 1}`, detail: "", kind: "activity" as const, n: ++activity };
        if ((b.type === "text" || b.type === "mindmap") && b.title) return { id: b.id, label: b.title, detail: "", kind: "section" as const, n: ++section };
        return null;
      })
      .filter(Boolean) as Array<{ id: string; label: string; detail: string; kind: "section" | "activity"; n: number }>;
  }, [blocks, hasChapters]);

  // Al terminar todas las actividades se guarda la nota (la ve el profesor)
  useEffect(() => {
    if (mode !== "student" || !allDone || savedRef.current) return;
    savedRef.current = true;
    if (practice) {
      const correctCount = quizBlocks.filter((b) => activities[b.id]?.correct).length;
      setFinal({ score: Math.round((correctCount / quizBlocks.length) * 100), correctCount, totalQuestions: quizBlocks.length });
      return;
    }
    const answers = Object.fromEntries(quizBlocks.map((b) => [b.id, activities[b.id]!.selected as number]));
    setSaving(true);
    submitQuizAttemptAction(lessonId, answers).then((res) => {
      setSaving(false);
      if (res.success && "score" in res) {
        setFinal({ score: res.score as number, correctCount: res.correctCount as number, totalQuestions: res.totalQuestions as number });
      }
    });
  }, [allDone, mode, quizBlocks, activities, lessonId, practice]);

  async function check(blockId: string) {
    const state = activities[blockId];
    if (!state || state.selected === null || state.status !== "idle") return;
    if (practice) {
      const block = quizBlocks.find((b) => b.id === blockId);
      const correctIndex = block?.correctOptionIndex ?? 0;
      setActivities((p) => ({
        ...p,
        [blockId]: { ...state, status: "done", correct: state.selected === correctIndex, correctIndex, explanation: block?.explanation },
      }));
      return;
    }
    setActivities((p) => ({ ...p, [blockId]: { ...state, status: "checking", error: undefined } }));
    const res = await checkQuizAnswerAction(lessonId, blockId, state.selected);
    setActivities((p) =>
      res.success
        ? { ...p, [blockId]: { ...state, status: "done", correct: res.correct, correctIndex: res.correctOptionIndex, explanation: res.explanation } }
        : { ...p, [blockId]: { ...state, status: "idle", error: res.error } }
    );
  }

  function retry() {
    setActivities({});
    setFinal(null);
    savedRef.current = false;
    document.getElementById("lesson-top")?.scrollIntoView({ behavior: "smooth" });
  }

  let sectionNumber = 0;
  let activityNumber = 0;

  return (
    <article id="lesson-top" className="bg-white text-slate-800 rounded-3xl shadow-2xl overflow-hidden scroll-mt-4">
      {/* Portada de la lección */}
      <header className="px-6 sm:px-12 pt-10 pb-8 border-b border-slate-100" style={{ background: `linear-gradient(135deg, ${accent}14, transparent 60%)` }}>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: accent }}>{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">{title}</h1>
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-500">
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> ~{minutes} min</span>
          {quizBlocks.length > 0 && (
            <span className="flex items-center gap-1.5"><PencilLine className="w-4 h-4" /> {quizBlocks.length} actividades</span>
          )}
        </div>
        {actions && <div className="mt-5">{actions}</div>}

        {toc.length > 2 && (
          <nav className="mt-8 rounded-2xl bg-white/70 border border-slate-200 p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
              <ListChecks className="w-4 h-4" /> En esta lección
            </p>
            <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[15px]">
              {toc.map((t) => {
                const done = t.kind === "activity" && activities[t.id]?.status === "done";
                return (
                  <li key={t.id}>
                    <a href={`#block-${t.id}`} className="flex items-start gap-2 text-slate-700 hover:text-slate-900">
                      {t.kind === "activity" ? (
                        done ? <CheckCircle2 className="w-4 h-4 mt-1 text-emerald-500 shrink-0" /> : <PencilLine className="w-4 h-4 mt-1 shrink-0" style={{ color: accent }} />
                      ) : (
                        <span className="w-5 text-right font-semibold text-slate-400 shrink-0">{t.n}.</span>
                      )}
                      <span className={t.kind === "activity" ? "italic" : ""}>
                        {hasChapters ? <><strong className="text-slate-900">{t.label}</strong> <span className="text-slate-500">· {t.detail}</span></> : t.label}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </header>

      {/* Progreso de actividades, fijo al hacer scroll */}
      {quizBlocks.length > 0 && (
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-100 px-6 sm:px-12 py-2.5 flex items-center gap-4">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
            Actividades {doneCount}/{quizBlocks.length}
          </span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(doneCount / quizBlocks.length) * 100}%`, background: accent }} />
          </div>
        </div>
      )}

      {/* Cuerpo: un solo documento continuo */}
      <div className="px-6 sm:px-12 py-10 space-y-12">
        {blocks.length === 0 && <p className="text-slate-400 italic text-center py-12">Esta lección aún no tiene contenido.</p>}

        {blocks.map((b) => {
          const anchor = `block-${b.id}`;

          if (b.type === "chapter") {
            return (
              <header key={b.id} id={anchor} className="scroll-mt-16 pt-10 first:pt-0 border-t-4 first:border-t-0" style={{ borderColor: `${accent}22` }}>
                <p className="text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: accent }}>
                  <span className="text-2xl">{b.emoji}</span> {b.label}
                </p>
                <h2 className="text-4xl sm:text-5xl font-black leading-tight" style={{ color: accent }}>{b.title}</h2>
                {b.content && <p className="text-lg text-slate-500 mt-4 leading-relaxed">{b.content}</p>}
              </header>
            );
          }

          if (b.type === "practice") {
            return <PracticeCard key={b.id} anchor={anchor} block={b} accent={accent} />;
          }

          if (b.type === "dialogue" && b.lines?.length) {
            return (
              <section key={b.id} id={anchor} className="scroll-mt-16">
                <DialogueView lines={b.lines} />
              </section>
            );
          }

          if (b.type === "flashcards" && b.cards?.length) {
            return (
              <section key={b.id} id={anchor} className="scroll-mt-16">
                <p className="text-sm text-slate-500 mb-4">Toca cada tarjeta para ver su significado.</p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {b.cards.map((c, i) => <FlipCard key={i} front={c.front} back={c.back} accent={accent} />)}
                </div>
              </section>
            );
          }

          if (b.type === "text" && hasChapters) {
            return (
              <section key={b.id} id={anchor} className="scroll-mt-16">
                {b.title && (
                  <h3 className="text-2xl sm:text-3xl font-bold pb-3 mb-6 border-b-2 leading-tight" style={{ color: accent, borderColor: `${accent}55` }}>
                    {b.title}
                  </h3>
                )}
                <TextWithImage block={b} accent={accent} />
              </section>
            );
          }

          if (b.type === "text") {
            const numbered = Boolean(b.title);
            if (numbered) sectionNumber++;
            return (
              <section key={b.id} id={anchor} className="scroll-mt-16">
                {numbered && (
                  <h2 className="flex items-center gap-3 text-2xl sm:text-[28px] font-extrabold text-slate-900 mb-5 leading-tight">
                    <span className="w-9 h-9 rounded-xl text-white text-base font-black flex items-center justify-center shrink-0" style={{ background: accent }}>
                      {sectionNumber}
                    </span>
                    {b.title}
                  </h2>
                )}
                <TextWithImage block={b} accent={accent} />
              </section>
            );
          }

          if (b.type === "quiz" && b.options?.length) {
            activityNumber++;
            return (
              <Activity
                key={b.id}
                anchor={anchor}
                number={activityNumber}
                total={quizBlocks.length}
                block={b}
                state={activities[b.id] ?? { selected: null, status: "idle" }}
                disabled={mode !== "student"}
                accent={accent}
                onSelect={(i) => setActivities((p) => ({ ...p, [b.id]: { selected: i, status: "idle" } }))}
                onCheck={() => check(b.id)}
              />
            );
          }

          if (b.type === "mindmap" && b.mindMap) {
            if (b.title) sectionNumber++;
            return (
              <figure key={b.id} id={anchor} className="scroll-mt-16">
                {b.title && (
                  <h2 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 mb-5">
                    <span className="w-9 h-9 rounded-xl text-white text-base font-black flex items-center justify-center shrink-0" style={{ background: accent }}>
                      {sectionNumber}
                    </span>
                    {b.title}
                  </h2>
                )}
                <div className="rounded-2xl bg-slate-900 p-5">
                  <MindMapView data={b.mindMap} primaryColor={accent} />
                </div>
              </figure>
            );
          }

          if (b.type === "image") {
            const src = safeExternalUrl(b.url);
            if (!src) return null;
            return (
              <figure key={b.id} id={anchor} className="rounded-3xl overflow-hidden border border-slate-100 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={b.content || b.title || "Ilustración de la lección"} className="w-full max-h-[520px] object-cover" loading="lazy" />
                {b.title && <figcaption className="text-sm text-slate-500 px-5 py-3 text-center">{b.title}</figcaption>}
              </figure>
            );
          }

          if (b.type === "video") {
            return (
              <figure key={b.id} id={anchor}>
                <VideoEmbed url={b.url} title={b.title} />
                {b.title && <figcaption className="text-sm text-slate-500 mt-3 text-center">{b.title}</figcaption>}
              </figure>
            );
          }

          if (b.type === "resource") {
            const href = safeExternalUrl(b.url);
            if (!href) return null;
            return (
              <a key={b.id} id={anchor} href={href} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-5 py-4 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                <span className="flex items-center gap-3 font-semibold text-slate-900">
                  <Download className="w-5 h-5" style={{ color: accent }} /> {b.title || "Material descargable"}
                </span>
                <span className="text-sm font-semibold" style={{ color: accent }}>Descargar</span>
              </a>
            );
          }

          return null;
        })}

        {/* Resultado final */}
        {mode === "student" && quizBlocks.length > 0 && (allDone || final) && (
          <div className="rounded-3xl border-2 p-8 text-center" style={{ borderColor: accent }}>
            {saving || !final ? (
              <p className="text-slate-500 flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Guardando tu resultado…</p>
            ) : (
              <>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Resultado de la lección</p>
                <p className={`text-6xl font-black mt-3 ${final.score >= 70 ? "text-emerald-500" : final.score >= 50 ? "text-amber-500" : "text-rose-500"}`}>
                  {final.score}<span className="text-2xl text-slate-400">/100</span>
                </p>
                <p className="text-slate-600 mt-2">{final.correctCount} de {final.totalQuestions} actividades correctas</p>
                <p className="text-sm text-slate-500 mt-1">
                  {final.score >= 70 ? "¡Muy bien! Dominas los contenidos de esta lección." : "Repasa las secciones de las actividades falladas y vuelve a intentarlo."}
                </p>
                <button onClick={retry} className="mt-5 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-sm inline-flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Repetir actividades
                </button>
                <p className="text-xs text-slate-400 mt-3">
                  {practice ? "Vista previa: este resultado no se guarda." : "Tu profesor ve este resultado."}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function Activity({
  anchor, number, total, block, state, disabled, accent, onSelect, onCheck,
}: {
  anchor: string;
  number: number;
  total: number;
  block: LessonBlock;
  state: ActivityState;
  disabled: boolean;
  accent: string;
  onSelect: (i: number) => void;
  onCheck: () => void;
}) {
  const done = state.status === "done";
  return (
    <section id={anchor} className="scroll-mt-16 rounded-3xl border border-slate-200 bg-slate-50/70 overflow-hidden">
      <div className="px-6 py-3 flex items-center justify-between text-sm font-semibold text-white" style={{ background: accent }}>
        <span className="flex items-center gap-2"><PencilLine className="w-4 h-4" /> Actividad {number} de {total}</span>
        {block.difficulty ? (
          <span className={`ml-4 text-xs px-2.5 py-0.5 rounded-full border ${DIFFICULTY_STYLE[block.difficulty] ?? DIFFICULTY_STYLE.Medio}`}>{block.difficulty}</span>
        ) : (
          block.title && <span className="opacity-80 truncate ml-4">{block.title}</span>
        )}
      </div>
      <div className="p-6 sm:p-8">
        <p className="text-lg sm:text-xl font-bold text-slate-900 mb-5 leading-snug">{block.question}</p>
        <div className="space-y-2.5">
          {block.options!.map((opt, i) => {
            const picked = state.selected === i;
            const right = done && state.correctIndex === i;
            const wrong = done && picked && !state.correct;
            return (
              <button
                key={i}
                type="button"
                disabled={disabled || done || state.status === "checking"}
                onClick={() => onSelect(i)}
                className={`w-full text-left flex items-center gap-4 px-5 py-4 rounded-2xl border-2 text-base transition-all ${
                  right ? "border-emerald-400 bg-emerald-50"
                  : wrong ? "border-rose-300 bg-rose-50"
                  : picked ? "bg-white shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300"
                } ${disabled || done ? "cursor-default" : "cursor-pointer"}`}
                style={picked && !done ? { borderColor: accent } : undefined}
              >
                <span
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0"
                  style={picked && !done ? { borderColor: accent, color: accent } : undefined}
                >
                  {right ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : wrong ? <XCircle className="w-5 h-5 text-rose-500" /> : String.fromCharCode(65 + i)}
                </span>
                <span className="text-slate-800">{opt}</span>
              </button>
            );
          })}
        </div>

        {disabled ? (
          <p className="text-sm text-slate-500 italic mt-5">Inscríbete en el curso para hacer las actividades y recibir tu nota.</p>
        ) : done ? (
          <div className={`mt-6 rounded-2xl px-5 py-4 ${state.correct ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"}`}>
            <p className="font-bold">{state.correct ? "¡Correcto! 🎉" : "No es correcto"}</p>
            {state.explanation && <p className="mt-1 text-[15px] leading-relaxed">{state.explanation}</p>}
            <p className="text-xs mt-2 opacity-70">Sigue leyendo: la lección continúa abajo.</p>
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              onClick={onCheck}
              disabled={state.selected === null || state.status === "checking"}
              className="px-6 py-3 rounded-xl text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              style={{ background: accent }}
            >
              {state.status === "checking" && <Loader2 className="w-4 h-4 animate-spin" />} Comprobar
            </button>
            {state.error && <span className="text-sm text-rose-600">{state.error}</span>}
          </div>
        )}
      </div>
    </section>
  );
}

const DIFFICULTY_STYLE: Record<string, string> = {
  Fácil: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medio: "bg-amber-50 text-amber-800 border-amber-200",
  Difícil: "bg-rose-50 text-rose-700 border-rose-200",
};

/** Ejercicio abierto: el alumno escribe su respuesta y la compara con la respuesta modelo. */
function PracticeCard({ anchor, block, accent }: { anchor: string; block: LessonBlock; accent: string }) {
  const [text, setText] = useState("");
  const [shown, setShown] = useState(false);
  return (
    <section id={anchor} className="scroll-mt-16 rounded-3xl border-2 border-dashed border-slate-200 p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: accent }}>
          <PencilLine className="w-4 h-4" /> Practica
        </span>
        {block.difficulty && (
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${DIFFICULTY_STYLE[block.difficulty] ?? DIFFICULTY_STYLE.Medio}`}>{block.difficulty}</span>
        )}
      </div>
      <p className="text-lg sm:text-xl font-bold text-slate-900 leading-snug whitespace-pre-line mb-4">{block.question}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Escribe aquí tu respuesta…"
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 focus:outline-none focus:bg-white resize-none"
        style={{ outlineColor: accent }}
      />
      {shown ? (
        <div className="mt-4 rounded-2xl bg-sky-50 text-sky-950 px-5 py-4">
          <p className="font-bold">Respuesta modelo</p>
          <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line">{block.answer || "—"}</p>
          {block.explanation && <p className="mt-2 text-sm text-sky-800">{block.explanation}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="mt-4 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-colors hover:bg-slate-50"
          style={{ borderColor: accent, color: accent }}
        >
          Ver respuesta modelo
        </button>
      )}
    </section>
  );
}

function FlipCard({ front, back, accent }: { front: string; back: string; accent: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setFlipped((v) => !v)}
      className="min-h-[140px] rounded-2xl border-2 p-5 text-left flex flex-col justify-between transition-colors"
      style={flipped ? { borderColor: accent, background: `${accent}10` } : { borderColor: "#e2e8f0" }}
    >
      <span className={flipped ? "text-base text-slate-700 leading-relaxed" : "text-xl font-bold text-slate-900"}>{flipped ? back : front}</span>
      <span className="text-xs text-slate-400 flex items-center gap-1 mt-3"><RotateCcw className="w-3 h-3" /> {flipped ? "Ver término" : "Girar"}</span>
    </button>
  );
}

function toEmbedUrl(raw: string | undefined): { kind: "iframe" | "video" | "link"; src: string } | null {
  const url = safeExternalUrl(raw);
  if (!url) return null;
  try {
    const u = new URL(url, "https://local.invalid");
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let yt: string | null = null;
    if (host === "youtu.be") yt = u.pathname.slice(1);
    else if (host.endsWith("youtube.com")) yt = u.searchParams.get("v") || u.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/)?.[2] || null;
    if (yt && /^[\w-]{6,20}$/.test(yt)) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt}` };

    const vimeo = host.endsWith("vimeo.com") ? u.pathname.match(/\/(\d{5,})/)?.[1] : null;
    if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo}` };

    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { kind: "video", src: url };
  } catch {}
  return { kind: "link", src: url };
}

function VideoEmbed({ url, title }: { url?: string; title?: string }) {
  const embed = toEmbedUrl(url);
  if (!embed) return <div className="aspect-video rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-sm">Video no disponible</div>;
  if (embed.kind === "iframe") {
    return (
      <div className="aspect-video rounded-2xl overflow-hidden bg-black">
        <iframe
          src={embed.src}
          title={title || "Video de la lección"}
          className="w-full h-full"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }
  if (embed.kind === "video") {
    return <video src={embed.src} controls className="w-full rounded-2xl bg-black" preload="metadata" />;
  }
  return (
    <a href={embed.src} target="_blank" rel="noopener noreferrer" className="block rounded-2xl border border-slate-200 px-5 py-4 text-slate-800 font-semibold hover:bg-slate-50">
      ▶ Ver video: {title || embed.src}
    </a>
  );
}

/** Texto de una sección; si trae ilustración (p. ej. un concepto clave), va al lado del texto. */
function TextWithImage({ block, accent }: { block: LessonBlock; accent: string }) {
  const src = safeExternalUrl(block.url);
  if (!src) return block.content ? <LessonProse text={block.content} accent={accent} /> : null;
  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-6 items-start">
      <div className="min-w-0">{block.content && <LessonProse text={block.content} accent={accent} />}</div>
      <figure className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 md:order-last order-first">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={block.title || "Ilustración del concepto"} className="w-full aspect-video object-cover" loading="lazy" />
      </figure>
    </div>
  );
}

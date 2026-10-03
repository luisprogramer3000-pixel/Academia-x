"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { liveControlAction } from "@/app/actions/live.actions";
import { OPTION_STYLES } from "@/components/live/liveTheme";
import type { LiveService } from "@/modules/live/live.service";
import { ArrowLeft, Check, Loader2, Maximize, Trophy, Users } from "lucide-react";

type HostState = NonNullable<Awaited<ReturnType<typeof LiveService.hostState>>>;

export function LiveHostClient({ initial }: { initial: HostState }) {
  const [state, setState] = useState<HostState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localLeft, setLocalLeft] = useState(initial.secondsLeft);
  const [origin, setOrigin] = useState("");
  const autoRevealed = useRef<number | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/live/host/${initial.id}`, { cache: "no-store" });
      if (res.ok) {
        const next = (await res.json()) as HostState;
        setState(next);
        setLocalLeft(next.secondsLeft);
      }
    } catch {}
  }, [initial.id]);

  useEffect(() => {
    if (state.status === "ENDED") return;
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh, state.status]);

  // Cuenta atrás local entre sondeos, para que el reloj no vaya a saltos
  useEffect(() => {
    if (state.status !== "QUESTION") return;
    const t = setInterval(() => setLocalLeft((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [state.status, state.index]);

  const control = useCallback(async (action: "next" | "reveal" | "end") => {
    setBusy(true);
    setError(null);
    const res = await liveControlAction(initial.id, action);
    if (!res.success) setError(res.error);
    await refresh();
    setBusy(false);
  }, [initial.id, refresh]);

  // Revelar solo cuando se acaba el tiempo o han respondido todos
  useEffect(() => {
    if (state.status !== "QUESTION" || autoRevealed.current === state.index) return;
    const everyone = state.participants.length > 0 && state.answeredCount >= state.participants.length;
    if (localLeft <= 0 || everyone) {
      autoRevealed.current = state.index;
      control("reveal");
    }
  }, [state.status, state.index, state.answeredCount, state.participants.length, localLeft, control]);

  const q = state.question;
  const isLast = state.index >= state.total - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link href={state.resourceId ? `/dashboard/resources/${state.resourceId}` : "/dashboard/resources"} className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Salir
        </Link>
        <p className="font-semibold text-slate-300 truncate mx-4">{state.title}</p>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-slate-300"><Users className="w-4 h-4" /> {state.participants.length}</span>
          {state.status !== "LOBBY" && state.status !== "ENDED" && (
            <span className="font-mono text-slate-400">{state.index + 1}/{state.total}</span>
          )}
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="p-2 rounded-lg hover:bg-white/10" title="Pantalla completa">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
        {state.status === "LOBBY" && (
          <div className="text-center w-full max-w-5xl">
            <p className="text-xl text-slate-300">Entra en <span className="font-bold text-white">{origin ? `${origin.replace(/^https?:\/\//, "")}/live` : "/live"}</span> e introduce el código</p>
            <p className="text-8xl md:text-[10rem] font-black tracking-[0.15em] my-6 tabular-nums">{state.code}</p>
            <div className="flex flex-wrap justify-center gap-2 min-h-[48px] mb-10">
              {state.participants.length === 0 ? (
                <p className="text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Esperando jugadores…</p>
              ) : (
                state.participants.map((p) => (
                  <span key={p.id} className="px-4 py-2 rounded-xl bg-white/10 font-semibold">{p.nickname}</span>
                ))
              )}
            </div>
            <button onClick={() => control("next")} disabled={busy} className="px-10 py-4 rounded-2xl bg-white text-indigo-900 text-xl font-black hover:scale-105 transition-transform disabled:opacity-60">
              Empezar
            </button>
          </div>
        )}

        {(state.status === "QUESTION" || state.status === "REVEAL") && q && (
          <div className="w-full max-w-6xl">
            <div className="flex items-center justify-between mb-6">
              <span className="text-lg text-slate-300">Pregunta {state.index + 1} de {state.total}</span>
              {state.status === "QUESTION" ? (
                <span className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl font-black ${localLeft <= 5 ? "bg-rose-600" : "bg-indigo-600"}`}>
                  {localLeft}
                </span>
              ) : (
                <span className="text-lg text-slate-300">{state.answeredCount} respuestas</span>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-center leading-tight mb-10 bg-white text-slate-900 rounded-3xl px-8 py-8">{q.prompt}</h1>

            <div className="grid md:grid-cols-2 gap-4">
              {q.options.map((opt, i) => {
                const style = OPTION_STYLES[i % OPTION_STYLES.length];
                const reveal = state.status === "REVEAL";
                const isCorrect = i === q.correctIndex;
                const max = Math.max(1, ...state.distribution);
                return (
                  <div
                    key={i}
                    className={`relative rounded-2xl px-6 py-6 flex items-center gap-4 text-2xl font-bold transition-opacity overflow-hidden ${reveal && !isCorrect ? "opacity-35" : ""}`}
                    style={{ background: style.bg }}
                  >
                    <span className="text-3xl">{style.shape}</span>
                    <span className="flex-1">{opt}</span>
                    {reveal && (
                      <span className="flex items-center gap-2">
                        {isCorrect && <Check className="w-8 h-8" />}
                        <span className="text-xl tabular-nums">{state.distribution[i]}</span>
                      </span>
                    )}
                    {reveal && (
                      <span className="absolute left-0 bottom-0 h-1.5 bg-white/70" style={{ width: `${(state.distribution[i] / max) * 100}%` }} />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              {state.status === "QUESTION" ? (
                <p className="text-slate-300">{state.answeredCount} de {state.participants.length} han respondido</p>
              ) : (
                <div className="flex-1">
                  {q.explanation && <p className="text-lg text-slate-200 mb-4">💡 {q.explanation}</p>}
                  <Leaderboard players={state.participants.slice(0, 5)} />
                </div>
              )}
              <div className="flex gap-3 shrink-0">
                {state.status === "QUESTION" ? (
                  <button onClick={() => control("reveal")} disabled={busy} className="px-6 py-3 rounded-xl bg-white/15 hover:bg-white/25 font-bold">Saltar tiempo</button>
                ) : (
                  <button onClick={() => control("next")} disabled={busy} className="px-8 py-4 rounded-2xl bg-white text-indigo-900 text-lg font-black hover:scale-105 transition-transform">
                    {isLast ? "Ver resultados" : "Siguiente"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {state.status === "ENDED" && <Podium players={state.participants} />}

        {error && <p className="mt-6 text-rose-300">{error}</p>}
      </main>

      {state.status !== "ENDED" && state.status !== "LOBBY" && (
        <footer className="px-6 pb-4 flex justify-between text-sm text-slate-400">
          <span>Código: <strong className="text-white tracking-widest">{state.code}</strong></span>
          <button onClick={() => control("end")} className="hover:text-white">Terminar partida</button>
        </footer>
      )}
    </div>
  );
}

function Leaderboard({ players }: { players: HostState["participants"] }) {
  if (players.length === 0) return null;
  return (
    <ol className="space-y-2 max-w-md">
      {players.map((p, i) => (
        <li key={p.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/10">
          <span className="font-bold"><span className="text-slate-400 mr-3">{i + 1}</span>{p.nickname}</span>
          <span className="tabular-nums font-bold">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

function Podium({ players }: { players: HostState["participants"] }) {
  const [first, second, third] = players;
  const col = (p: (typeof players)[number] | undefined, place: number, height: string, color: string) => (
    <div className="flex flex-col items-center w-40">
      <p className="font-black text-xl mb-2 truncate max-w-full">{p?.nickname ?? "—"}</p>
      <p className="text-slate-300 mb-3 tabular-nums">{p?.score ?? 0} pts</p>
      <div className={`w-full ${height} rounded-t-2xl flex items-start justify-center pt-4 text-5xl font-black`} style={{ background: color }}>{place}</div>
    </div>
  );
  return (
    <div className="w-full max-w-4xl text-center">
      <h1 className="text-5xl font-black mb-12 flex items-center justify-center gap-3"><Trophy className="w-12 h-12 text-amber-400" /> Resultados</h1>
      <div className="flex items-end justify-center gap-4 mb-12">
        {col(second, 2, "h-32", "#94a3b8")}
        {col(first, 1, "h-48", "#f59e0b")}
        {col(third, 3, "h-24", "#b45309")}
      </div>
      {players.length > 3 && (
        <div className="max-w-lg mx-auto rounded-2xl bg-white/5 divide-y divide-white/10 text-left max-h-72 overflow-y-auto">
          {players.slice(3).map((p, i) => (
            <div key={p.id} className="flex justify-between px-5 py-2.5">
              <span><span className="text-slate-400 mr-3">{i + 4}</span>{p.nickname}</span>
              <span className="tabular-nums">{p.score}</span>
            </div>
          ))}
        </div>
      )}
      {players.length === 0 && <p className="text-slate-400">Nadie participó en esta partida.</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { answerLiveAction, joinLiveAction } from "@/app/actions/live.actions";
import { OPTION_STYLES } from "@/components/live/liveTheme";
import type { LiveService } from "@/modules/live/live.service";
import { Loader2 } from "lucide-react";

type PlayerState = NonNullable<Awaited<ReturnType<typeof LiveService.playerState>>>;
type Identity = { participantId: string; token: string; nickname: string };

const storageKey = (code: string) => `live:${code}`;

function loadIdentity(code: string): Identity | null {
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

export function LivePlayerClient({ code }: { code: string }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<PlayerState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIdentity(loadIdentity(code));
    setReady(true);
  }, [code]);

  const poll = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (identity) {
        headers["x-live-participant"] = identity.participantId;
        headers["x-live-token"] = identity.token;
      }
      const res = await fetch(`/api/live/play/${code}`, { headers, cache: "no-store" });
      if (res.status === 404) return setNotFound(true);
      if (res.ok) {
        const next = (await res.json()) as PlayerState;
        setState(next);
        // Token caducado o de otra partida: se pide unirse otra vez
        if (identity && !next.me && next.status !== "ENDED") {
          try { localStorage.removeItem(storageKey(code)); } catch {}
          setIdentity(null);
        }
      }
    } catch {}
  }, [code, identity]);

  useEffect(() => {
    if (!ready) return;
    poll();
    if (state?.status === "ENDED") return;
    const t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [ready, poll, state?.status]);

  useEffect(() => {
    setPending(null);
    setError(null);
  }, [state?.index, state?.status]);

  async function answer(i: number) {
    if (!identity || !state || pending !== null) return;
    setPending(i);
    const res = await answerLiveAction(code, identity.participantId, identity.token, state.index, i);
    if (!res.success) {
      setError(res.error);
      setPending(null);
    }
    poll();
  }

  const shell = (children: React.ReactNode, bg = "from-indigo-700 via-purple-700 to-fuchsia-700") => (
    <div className={`min-h-[100dvh] bg-gradient-to-br ${bg} text-white flex flex-col`}>
      <header className="flex items-center justify-between px-4 py-3 text-sm font-semibold bg-black/15">
        <span className="truncate">{identity?.nickname ?? "Quiz en vivo"}</span>
        {state?.me && <span className="tabular-nums">{state.me.score} pts</span>}
      </header>
      <main className="flex-1 flex flex-col p-4">{children}</main>
    </div>
  );

  const center = (node: React.ReactNode) => <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">{node}</div>;

  if (!ready) return shell(center(<Loader2 className="w-8 h-8 animate-spin" />));
  if (notFound) {
    return shell(center(<>
      <p className="text-2xl font-black">No existe ningún juego con el código {code}</p>
      <Link href="/live" className="mt-4 px-6 py-3 rounded-2xl bg-white text-indigo-900 font-black">Probar otro código</Link>
    </>));
  }
  if (!state) return shell(center(<Loader2 className="w-8 h-8 animate-spin" />));

  if (!identity) {
    if (state.status === "ENDED") return shell(center(<p className="text-2xl font-black">Esta partida ya terminó</p>));
    return shell(center(<NicknameForm code={code} onJoined={(id) => {
      try { localStorage.setItem(storageKey(code), JSON.stringify(id)); } catch {}
      setIdentity(id);
    }} />));
  }

  const me = state.me;

  if (state.status === "LOBBY") {
    return shell(center(<>
      <p className="text-3xl font-black">¡Estás dentro!</p>
      <p className="text-white/80">Mira la pantalla del profesor. Empezamos enseguida.</p>
      <Loader2 className="w-8 h-8 animate-spin mt-4 opacity-70" />
    </>));
  }

  if (state.status === "QUESTION" && state.question) {
    if (me?.answered || pending !== null) {
      return shell(center(<>
        <Loader2 className="w-10 h-10 animate-spin" />
        <p className="text-2xl font-black mt-2">¡Respuesta enviada!</p>
        <p className="text-white/80">¿Serás de los más rápidos?</p>
      </>));
    }
    if (state.secondsLeft <= 0) return shell(center(<p className="text-2xl font-black">⏰ Se acabó el tiempo</p>));
    return shell(
      <div className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{state.index + 1} / {state.total}</span>
          <span className="tabular-nums">{state.secondsLeft}s</span>
        </div>
        <p className="text-xl font-bold bg-white text-slate-900 rounded-2xl px-4 py-4 text-center">{state.question.prompt}</p>
        <div className="flex-1 grid grid-cols-1 gap-3">
          {state.question.options.map((opt, i) => {
            const s = OPTION_STYLES[i % OPTION_STYLES.length];
            return (
              <button key={i} onClick={() => answer(i)} className="rounded-2xl px-4 py-4 flex items-center gap-3 text-left text-lg font-bold active:scale-[0.98] transition-transform shadow-lg" style={{ background: s.bg }}>
                <span className="text-2xl">{s.shape}</span> {opt}
              </button>
            );
          })}
        </div>
        {error && <p className="text-center font-semibold">{error}</p>}
      </div>,
      "from-slate-800 via-slate-900 to-slate-950",
    );
  }

  if (state.status === "REVEAL") {
    const correct = me?.lastCorrect;
    const bg = correct ? "from-emerald-500 to-green-700" : "from-rose-500 to-red-700";
    return shell(center(<>
      <p className="text-6xl">{me?.answered ? (correct ? "✓" : "✗") : "⏰"}</p>
      <p className="text-3xl font-black">{me?.answered ? (correct ? "¡Correcto!" : "Incorrecto") : "Sin respuesta"}</p>
      {correct && <p className="text-xl font-bold">+{me?.lastPoints} puntos</p>}
      {!correct && state.question && state.correctIndex !== null && (
        <p className="text-white/90">La respuesta era: <strong>{state.question.options[state.correctIndex]}</strong></p>
      )}
      {me && <p className="mt-4 px-5 py-2 rounded-full bg-black/20 font-bold">Vas en la posición #{me.rank}</p>}
    </>), me?.answered ? bg : "from-slate-600 to-slate-800");
  }

  // ENDED
  return shell(center(<>
    <p className="text-lg text-white/80">Resultado final</p>
    {me ? (
      <>
        <p className="text-7xl font-black">#{me.rank}</p>
        <p className="text-2xl font-bold">{me.score} puntos</p>
        <p className="text-white/80">{me.rank === 1 ? "¡Has ganado! 🏆" : me.rank <= 3 ? "¡Estás en el podio! 🎉" : "¡Buen trabajo!"}</p>
      </>
    ) : (
      <p className="text-2xl font-black">La partida terminó</p>
    )}
  </>));
}

function NicknameForm({ code, onJoined }: { code: string; onJoined: (id: Identity) => void }) {
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await joinLiveAction(code, nickname);
    setBusy(false);
    if (!res.success) return setError(res.error);
    onJoined({ participantId: res.participantId, token: res.token, nickname: res.nickname });
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 text-slate-900">
      <p className="text-sm font-semibold text-slate-500">Código {code}</p>
      <input
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={20}
        autoFocus
        placeholder="Tu apodo"
        aria-label="Tu apodo"
        className="w-full text-center text-2xl font-black py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:outline-none"
      />
      {error && <p className="text-sm text-rose-600 font-semibold">{error}</p>}
      <button disabled={busy || nickname.trim().length < 2} className="w-full py-4 rounded-2xl bg-slate-900 text-white text-lg font-black disabled:opacity-40 flex items-center justify-center gap-2">
        {busy && <Loader2 className="w-5 h-5 animate-spin" />} ¡Listo, a jugar!
      </button>
    </form>
  );
}

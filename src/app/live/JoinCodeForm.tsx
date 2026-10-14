"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.replace(/\D/g, "").slice(0, 6);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (clean.length === 6) router.push(`/live/${clean}`);
      }}
      className="bg-white rounded-3xl p-6 shadow-2xl space-y-4"
    >
      <input
        value={clean}
        onChange={(e) => setCode(e.target.value)}
        inputMode="numeric"
        autoFocus
        placeholder="Código del juego"
        aria-label="Código del juego"
        className="w-full text-center text-3xl font-black tracking-[0.3em] py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-500 focus:outline-none text-slate-900 placeholder:text-lg placeholder:tracking-normal placeholder:font-semibold"
      />
      <button disabled={clean.length !== 6} className="w-full py-4 rounded-2xl bg-slate-900 text-white text-lg font-black disabled:opacity-40">
        Entrar
      </button>
    </form>
  );
}

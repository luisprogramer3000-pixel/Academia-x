"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/app/actions/account.actions";

export function DeleteAccountForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const input = "w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-red-500";

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          // Si sale bien, la acción redirige a /login; si no, devuelve el motivo
          const result = await deleteAccountAction(formData);
          if (result && !result.success) setError(result.error);
        });
      }}
    >
      <input type="password" name="password" required autoComplete="current-password" placeholder="Tu contraseña" className={input} />
      <input type="text" name="confirm" required placeholder="Escribe ELIMINAR" autoComplete="off" className={input} />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button type="submit" disabled={pending} className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-semibold text-white disabled:opacity-50">
        {pending ? "Eliminando..." : "Eliminar mi cuenta definitivamente"}
      </button>
    </form>
  );
}

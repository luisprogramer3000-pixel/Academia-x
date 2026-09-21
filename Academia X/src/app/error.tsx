"use client";

import { useEffect } from "react";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app-error]", error.digest || "", error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold">Algo salió mal</h1>
        <p className="text-sm text-slate-400">
          {error.message && !error.message.includes("prisma") ? error.message : "Ocurrió un error inesperado. Intenta de nuevo."}
        </p>
        <button onClick={reset} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm">
          Reintentar
        </button>
      </div>
    </div>
  );
}

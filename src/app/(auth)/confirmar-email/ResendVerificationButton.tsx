"use client";

import { useState, useTransition } from "react";
import { resendVerificationAction } from "@/app/actions/account.actions";

export function ResendVerificationButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await resendVerificationAction()))}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Reenviar el enlace"}
      </button>
      {result && <p className={`text-xs ${result.success ? "text-emerald-400" : "text-amber-400"}`}>{result.message}</p>}
    </div>
  );
}

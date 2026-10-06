"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PaintBucket } from "lucide-react";
import { setPanelColorAction } from "@/app/actions/academy.actions";

/** Colores rápidos. null = oscuro, el de siempre. */
const PRESETS: Array<{ id: string | null; name: string; swatch: string }> = [
  { id: null, name: "Oscuro", swatch: "#020617" },
  { id: "#F1F5F9", name: "Gris claro", swatch: "#F1F5F9" },
  { id: "#FFFFFF", name: "Blanco", swatch: "#FFFFFF" },
  { id: "#FAF7F0", name: "Crema", swatch: "#FAF7F0" },
  { id: "#EEF2FF", name: "Lavanda", swatch: "#EEF2FF" },
  { id: "#ECFDF5", name: "Menta", swatch: "#ECFDF5" },
  { id: "#1E293B", name: "Pizarra", swatch: "#1E293B" },
];

/** Fondo del panel del profesor (Configuración & Branding). */
export function PanelColorSettings({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState<string | null>(initial);
  const [custom, setCustom] = useState(initial ?? "#F1F5F9");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(color: string | null) {
    setBusy(true);
    setError("");
    const res = await setPanelColorAction(color);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setValue(color);
    router.refresh();
  }

  const same = (a: string | null, b: string | null) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

  return (
    <section className="mt-10 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <PaintBucket className="w-5 h-5 text-blue-400" /> Fondo del panel
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          El color de fondo de este panel de profesor. Con un color claro, los textos pasan a oscuro automáticamente.
          (El fondo de la página pública y del campus de tus alumnos se cambia arriba, en el color de fondo de la marca.)
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {PRESETS.map((p) => {
          const selected = same(value, p.id);
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => save(p.id)}
              disabled={busy}
              className={`w-24 rounded-xl border p-2 text-left transition-colors disabled:opacity-60 ${selected ? "border-blue-500 ring-2 ring-blue-500/40" : "border-slate-800 hover:border-slate-600"}`}
              aria-pressed={selected}
            >
              <span className="block h-10 rounded-lg border border-slate-700 relative" style={{ background: p.swatch }}>
                {selected && (
                  <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </span>
              <span className="block text-xs font-semibold text-slate-300 mt-1.5">{p.name}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate-400" htmlFor="panel-color">Otro color:</label>
        <input
          id="panel-color"
          type="color"
          value={custom}
          onChange={(e) => setCustom(e.target.value.toUpperCase())}
          className="w-12 h-9 rounded-lg bg-transparent border border-slate-700 cursor-pointer"
        />
        <span className="text-xs font-mono text-slate-400">{custom}</span>
        <button
          type="button"
          onClick={() => save(custom)}
          disabled={busy || same(value, custom)}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-semibold"
        >
          Usar este color
        </button>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </section>
  );
}

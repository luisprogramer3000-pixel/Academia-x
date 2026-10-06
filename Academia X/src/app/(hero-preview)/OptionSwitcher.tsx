import Link from "next/link";

/** Selector temporal para comparar las 3 propuestas de hero. Se elimina al elegir la definitiva. */
export function OptionSwitcher({ current }: { current: 1 | 2 | 3 }) {
  const names = ["Split humano", "Inmersivo", "SaaS / LMS"];
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 p-1 rounded-full bg-slate-900/90 text-white text-xs shadow-2xl backdrop-blur max-w-[calc(100vw-2rem)]">
      {[1, 2, 3].map((n) => (
        <Link key={n} href={`/hero-option-${n}`} className={`px-3 py-1.5 rounded-full whitespace-nowrap ${current === n ? "bg-white text-slate-900 font-bold" : "hover:bg-white/10"}`}>
          {n}. <span className="hidden sm:inline">{names[n - 1]}</span>
        </Link>
      ))}
      <Link href="/" className="px-3 py-1.5 rounded-full hover:bg-white/10 whitespace-nowrap">Actual</Link>
    </div>
  );
}

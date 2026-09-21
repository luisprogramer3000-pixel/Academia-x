import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-5xl font-extrabold text-slate-200">404</h1>
        <p className="text-slate-400">La página que buscas no existe o ya no está disponible.</p>
        <Link href="/" className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

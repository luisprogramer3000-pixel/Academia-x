import { AcademyService } from "@/modules/academy/academy.service";
import { publicRegisterStudentAction } from "@/app/actions/user.actions";
import { notFound, redirect } from "next/navigation";
import { GraduationCap, UserPlus } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface JoinPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}

export default async function JoinAcademyPage({ params, searchParams }: JoinPageProps) {
  const { slug } = await params;
  const { error } = await searchParams;

  const academy = await AcademyService.getAcademyBySlug(slug);

  if (!academy) {
    notFound();
  }

  async function handleRegister(formData: FormData) {
    "use server";
    const res = await publicRegisterStudentAction(formData);
    if (res.success) {
      redirect("/campus");
    }
    redirect(`/a/${slug}/join?error=${encodeURIComponent(res.error || "No se pudo completar el registro")}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6">
      {/* Top Navbar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-4">
        <Link href={`/a/${slug}`} className="flex items-center gap-3 group">
          {academy.logoUrl ? (
            <Image
              src={academy.logoUrl}
              alt={academy.name}
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl object-cover"
              unoptimized
            />
          ) : (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg"
              style={{ backgroundColor: academy.primaryColor || "#3B82F6" }}
            >
              {academy.name[0].toUpperCase()}
            </div>
          )}
          <span className="font-extrabold text-lg text-white group-hover:text-blue-400 transition-colors">
            {academy.name}
          </span>
        </Link>
        <Link
          href={`/a/${slug}`}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          Volver a la Academia
        </Link>
      </header>

      {/* Main Form Container */}
      <main className="max-w-md mx-auto w-full my-auto py-12">
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-xl"
              style={{ backgroundColor: academy.primaryColor || "#3B82F6" }}
            >
              <GraduationCap className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white mb-2">Únete a {academy.name}</h1>
            <p className="text-sm text-slate-400">
              Registra tu cuenta como estudiante para acceder a nuestros cursos e instructores.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form action={handleRegister} className="space-y-4">
            <input type="hidden" name="tenantId" value={academy.id} />

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Nombre Completo
              </label>
              <input
                type="text"
                name="name"
                required
                placeholder="Ej. Sofía Ramírez"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <input
                type="email"
                name="email"
                required
                placeholder="estudiante@ejemplo.com"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Contraseña (mínimo 8 caracteres)
              </label>
              <input
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="mt-2 text-[11px] text-slate-500">¿Ya tienes cuenta en Academia X? Usa tu contraseña actual.</p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl text-white font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              style={{ backgroundColor: academy.primaryColor || "#3B82F6" }}
            >
              <UserPlus className="w-4 h-4" /> Registrarme como Estudiante
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Al registrarte aceptas las políticas de la escuela y nuestros{" "}
            <Link href="/terms" className="underline hover:text-slate-300">
              Términos de servicio
            </Link>.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-4">
        Powered by <span className="font-bold text-slate-400">Academia X</span>
      </footer>
    </div>
  );
}

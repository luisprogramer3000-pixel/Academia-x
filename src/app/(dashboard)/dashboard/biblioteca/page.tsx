import Link from "next/link";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { isMongoConfigured } from "@/lib/mongo";
import { formatInTimezone } from "@/lib/timezone";
import { MATERIAL_TYPES } from "@/lib/upload-types";
import { LIBRARY_LANGUAGES, LibraryService, type LibraryFileView } from "@/modules/library/library.service";
import { Download, Library, Search, Clock, XCircle } from "lucide-react";
import { LibraryUploadButton } from "./LibraryUploadButton";
import { LibraryItemActions } from "./LibraryItemActions";

export const metadata = { title: "Biblioteca de la plataforma" };

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const extOf = (f: LibraryFileView) => (MATERIAL_TYPES[f.mimeType] ?? "").replace(".", "").toUpperCase() || "ARCHIVO";

function FileCard({ f, tz, canReview, isAdmin }: { f: LibraryFileView; tz: string; canReview?: boolean; isAdmin: boolean }) {
  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="shrink-0 px-2 py-1 rounded-lg bg-blue-500/10 text-blue-300 text-[10px] font-bold tracking-wider">{extOf(f)}</span>
        <div className="min-w-0">
          <p className="font-semibold text-white leading-snug break-words">{f.title}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {f.language} · {formatSize(f.size)} · {formatInTimezone(new Date(f.createdAt), tz, { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
      </div>
      {f.description && <p className="text-sm text-slate-400 line-clamp-3 whitespace-pre-line">{f.description}</p>}
      <p className="text-xs text-slate-500">
        Subido por {f.uploadedByName}{f.uploadedByAcademy ? ` · ${f.uploadedByAcademy}` : ""}
        {f.status === "approved" && ` · ${f.downloads} descarga${f.downloads === 1 ? "" : "s"}`}
      </p>
      {f.status === "rejected" && f.reviewNote && <p className="text-xs text-red-300">Motivo del rechazo: {f.reviewNote}</p>}
      <div className="mt-auto pt-2 space-y-2">
        <a
          href={`/api/library/${f.id}/download`}
          className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" /> Descargar
        </a>
        <LibraryItemActions id={f.id} title={f.title} canDelete={f.isMine || isAdmin} canReview={Boolean(canReview)} />
      </div>
    </div>
  );
}

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ idioma?: string; q?: string; page?: string }> }) {
  const ctx = await getDashboardContext(STAFF_ROLES);
  const tz = ctx.tenant.timezone;
  const sp = await searchParams;
  const language = sp.idioma && (LIBRARY_LANGUAGES as readonly string[]).includes(sp.idioma) ? sp.idioma : "";
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Number(sp.page) || 1);

  const configured = isMongoConfigured();
  let data: Awaited<ReturnType<typeof LibraryService.list>> | null = null;
  let pending: LibraryFileView[] = [];
  let loadError = false;
  if (configured) {
    try {
      [data, pending] = await Promise.all([
        LibraryService.list({ userId: ctx.userId }, { language, q, page }),
        ctx.isSuperAdmin ? LibraryService.listPending(ctx.userId) : Promise.resolve([]),
      ]);
    } catch (error) {
      console.error("[biblioteca]", error);
      loadError = true;
    }
  }

  const href = (params: { idioma?: string; q?: string; page?: number }) => {
    const s = new URLSearchParams();
    if (params.idioma) s.set("idioma", params.idioma);
    if (params.q) s.set("q", params.q);
    if (params.page && params.page > 1) s.set("page", String(params.page));
    const str = s.toString();
    return `/dashboard/biblioteca${str ? `?${str}` : ""}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={ctx.tenant.slug} academyName={ctx.tenant.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={ctx.tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-6xl w-full">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
                <Library className="w-7 h-7 text-blue-400" /> Biblioteca de la plataforma
              </h1>
              <p className="text-slate-400 text-sm max-w-2xl">
                Material compartido para todos los profesores de Mentor Studio Global: descárgalo y úsalo en tus clases.
                También puedes aportar el tuyo; se publica cuando el administrador lo revisa.
              </p>
            </div>
            {configured && !loadError && <LibraryUploadButton languages={LIBRARY_LANGUAGES} isPlatformAdmin={ctx.isSuperAdmin} />}
          </div>

          {!configured || loadError ? (
            <div className="p-8 rounded-3xl bg-slate-900 border border-amber-500/30 text-center">
              <Library className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <p className="text-white font-semibold">La biblioteca no está disponible</p>
              <p className="text-sm text-slate-400 mt-1">
                {ctx.isSuperAdmin
                  ? configured
                    ? "No se pudo conectar con MongoDB. Revisa MONGODB_URI y el acceso de red (IP) en MongoDB Atlas."
                    : "Falta configurar MONGODB_URI en el servidor. Ejecuta después: npx tsx scripts/setup-library.ts"
                  : "Vuelve a intentarlo en unos minutos."}
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {pending.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Pendientes de revisión ({pending.length})
                  </h2>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pending.map((f) => <FileCard key={f.id} f={f} tz={tz} canReview isAdmin={ctx.isSuperAdmin} />)}
                  </div>
                </section>
              )}

              {data && data.mine.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">Mis archivos sin publicar</h2>
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 divide-y divide-slate-800">
                    {data.mine.map((f) => (
                      <div key={f.id} className="p-4 flex flex-wrap items-center gap-3">
                        {f.status === "pending" ? (
                          <span className="text-xs font-semibold text-amber-300 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> En revisión</span>
                        ) : (
                          <span className="text-xs font-semibold text-red-300 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Rechazado</span>
                        )}
                        <span className="text-sm text-white font-medium flex-1 min-w-0 truncate">{f.title}</span>
                        <span className="text-xs text-slate-500">{f.language}</span>
                        {f.reviewNote && <span className="basis-full text-xs text-red-300">Motivo: {f.reviewNote}</span>}
                        <div className="basis-full sm:basis-auto">
                          <LibraryItemActions id={f.id} title={f.title} canDelete canReview={false} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                {/* Filtros: idioma + búsqueda (formulario GET, sin JavaScript) */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Link href={href({ q })} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${!language ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
                    Todos
                  </Link>
                  {LIBRARY_LANGUAGES.map((l) => (
                    <Link key={l} href={href({ idioma: l, q })} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${language === l ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}>
                      {l}
                    </Link>
                  ))}
                </div>
                <form action="/dashboard/biblioteca" className="flex gap-2 mb-6 max-w-lg">
                  {language && <input type="hidden" name="idioma" value={language} />}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input name="q" defaultValue={q} placeholder="Buscar por título o descripción…" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white" />
                  </div>
                  <button type="submit" className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold">Buscar</button>
                </form>

                {data && data.items.length === 0 ? (
                  <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center">
                    <Library className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-white font-semibold">{q || language ? "No hay archivos con esos filtros" : "La biblioteca aún está vacía"}</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data?.items.map((f) => <FileCard key={f.id} f={f} tz={tz} isAdmin={ctx.isSuperAdmin} />)}
                  </div>
                )}

                {data && data.pages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-8 text-sm">
                    {data.page > 1 && <Link href={href({ idioma: language, q, page: data.page - 1 })} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700">Anterior</Link>}
                    <span className="text-slate-400">Página {data.page} de {data.pages}</span>
                    {data.page < data.pages && <Link href={href({ idioma: language, q, page: data.page + 1 })} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700">Siguiente</Link>}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

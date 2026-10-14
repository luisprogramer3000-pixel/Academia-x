import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle, BadgeDollarSign, Ban, CalendarClock, CheckCircle2, Clock, CreditCard, Download,
  FileText, Gift, Library, LineChart, Search, ShieldCheck, Sparkles, TrendingUp, Users, XCircle,
} from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { isMongoConfigured } from "@/lib/mongo";
import { SalesAnalyticsService, type SaleRow, type SaleState } from "@/modules/billing/sales-analytics.service";
import { LibraryService, LIBRARY_LANGUAGES, type LibraryFileView } from "@/modules/library/library.service";
import { LibraryUploadButton } from "../../biblioteca/LibraryUploadButton";
import { LibraryItemActions } from "../../biblioteca/LibraryItemActions";
import { MonthlyBars } from "./MonthlyBars";

export const dynamic = "force-dynamic";

/** Estados de suscripción: color de estado + icono + texto (nunca solo color). */
const STATES: Record<SaleState, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  active: { label: "Activa", color: "#0ca30c", Icon: CheckCircle2 },
  trialing: { label: "En prueba", color: "#3987e5", Icon: Clock },
  past_due: { label: "Pago fallido", color: "#d03b3b", Icon: AlertTriangle },
  canceling: { label: "Cancela al vencer", color: "#fab219", Icon: CalendarClock },
  canceled: { label: "Cancelada", color: "#94a3b8", Icon: XCircle },
  expired: { label: "Vencida", color: "#94a3b8", Icon: Ban },
};

const usd = (v: number, decimals = 0) =>
  v.toLocaleString("es", { style: "currency", currency: "USD", minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function StateBadge({ state }: { state: SaleState }) {
  const { label, color, Icon } = STATES[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 whitespace-nowrap">
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} /> {label}
    </span>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint?: string }) {
  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
      <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
        <Icon className="w-4 h-4 text-blue-400" /> {label}
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold text-white tabular-nums">{value}</div>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`p-6 rounded-2xl bg-slate-900 border border-slate-800 ${className}`}>
      <h3 className="text-base font-bold text-white">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </section>
  );
}

export default async function AdminSalesPage({ searchParams }: { searchParams: Promise<{ estado?: string; q?: string }> }) {
  const ctx = await getDashboardContext(OWNER_ONLY, { requirePlan: false });
  if (!ctx.isSuperAdmin) redirect("/dashboard");
  const tz = ctx.tenant.timezone;
  const sp = await searchParams;
  const filter = (sp.estado ?? "") as SaleState | "";
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 100);

  const mongo = isMongoConfigured();
  const [sales, library, pending] = await Promise.all([
    SalesAnalyticsService.getOverview(),
    mongo ? LibraryService.stats().catch(() => null) : Promise.resolve(null),
    mongo ? LibraryService.listPending(ctx.userId).catch(() => [] as LibraryFileView[]) : Promise.resolve([] as LibraryFileView[]),
  ]);
  const { kpis } = sales;

  const date = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric", timeZone: tz });
  const rows = sales.rows.filter(
    (r) => (!filter || r.state === filter) && (!q || r.academy.toLowerCase().includes(q) || (r.ownerEmail ?? "").toLowerCase().includes(q) || r.slug.includes(q))
  );
  const attention = sales.rows.filter((r) => r.state === "past_due" || r.state === "canceling");
  const maxPlan = Math.max(1, ...sales.byPlan.map((p) => p.count));
  const filterHref = (estado: string) => {
    const params = new URLSearchParams();
    if (estado) params.set("estado", estado);
    if (q) params.set("q", q);
    const s = params.toString();
    return `/dashboard/admin/sales${s ? `?${s}` : ""}#suscripciones`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={ctx.tenant.slug} academyName={ctx.tenant.name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={ctx.tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-4 sm:p-8 flex-1 overflow-y-auto max-w-7xl w-full space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Administrador de la plataforma
              </p>
              <h1 className="text-3xl font-extrabold text-white">Ventas y biblioteca</h1>
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                Suscripciones, ingresos y crecimiento de Mentor Studio Global, con los pagos confirmados por Payphone. Y la moderación de la Biblioteca de la plataforma.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2 text-xs font-semibold">
              {[["#ventas", "Ventas"], ["#suscripciones", "Suscripciones"], ["#biblioteca", `Biblioteca${pending.length ? ` (${pending.length})` : ""}`]].map(([href, label]) => (
                <a key={href} href={href} className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-blue-500/40">
                  {label}
                </a>
              ))}
            </nav>
          </div>

          {/* ─── Ventas ─────────────────────────────────────────────── */}
          <div id="ventas" className="scroll-mt-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Kpi icon={BadgeDollarSign} label="Ingreso mensual (MRR)" value={usd(kpis.mrr)} hint={`Anual estimado (ARR): ${usd(kpis.arr)}`} />
              <Kpi icon={CreditCard} label="Academias que pagan" value={kpis.payingAcademies.toLocaleString("es")} hint={`Ingreso medio: ${usd(kpis.arpa, 2)} / mes`} />
              <Kpi icon={TrendingUp} label="Altas este mes" value={kpis.newThisMonth.toLocaleString("es")} hint={`${kpis.tenantsTotal.toLocaleString("es")} academias registradas`} />
              <Kpi icon={Sparkles} label="Cobrado este mes" value={usd(kpis.collectedThisMonth)} hint={`Últimos 12 meses: ${usd(kpis.collected12m)} · créditos IA: ${usd(kpis.topUpTotal)}`} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Panel title="Nuevas suscripciones por mes" subtitle="Primera suscripción de cada academia · últimos 12 meses">
                <MonthlyBars data={sales.newSubs} unit="altas" />
              </Panel>
              <Panel title="Cobrado por mes" subtitle="Pagos aprobados por Payphone (planes y créditos IA) · USD con IVA · últimos 12 meses">
                <MonthlyBars data={sales.collected} currency />
              </Panel>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <Panel title="Academias por plan" subtitle="Suscripciones con acceso vigente">
                <div className="space-y-4">
                  {sales.byPlan.map((p) => (
                    <div key={p.id}>
                      <div className="flex items-baseline justify-between text-sm mb-1.5">
                        <span className="font-semibold text-white">{p.name}</span>
                        <span className="text-slate-400 tabular-nums">
                          <span className="text-white font-bold">{p.count}</span> · {usd(p.mrr)}/mes
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(p.count / maxPlan) * 100}%`, background: "#3987e5" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-5 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5" /> {kpis.courtesy} de cortesía (sin cobro) · {kpis.withoutPlan} sin plan activo
                </p>
              </Panel>

              <Panel title="Estado de las suscripciones" subtitle="Una por academia (la más reciente)">
                <ul className="space-y-2.5">
                  {(Object.keys(STATES) as SaleState[]).map((s) => (
                    <li key={s}>
                      <Link href={filterHref(s)} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-slate-800/60">
                        <StateBadge state={s} />
                        <span className="text-sm font-bold text-white tabular-nums">{sales.stateCounts[s]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Requieren atención" subtitle="Pagos fallidos, cancelaciones y renovaciones en 7 días">
                {attention.length === 0 && sales.renewingSoon.length === 0 ? (
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Todo en orden.
                  </p>
                ) : (
                  <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {attention.map((r) => (
                      <li key={r.id} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white truncate">{r.academy}</span>
                          <StateBadge state={r.state} />
                        </div>
                        <p className="text-xs text-slate-500">{r.planName} · vence {date(r.currentPeriodEnd)}</p>
                      </li>
                    ))}
                    {sales.renewingSoon.filter((r) => r.state === "active").map((r) => (
                      <li key={`renew-${r.id}`} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white truncate">{r.academy}</span>
                          <span className="text-xs text-slate-300 tabular-nums">{usd(r.amount, 2)}</span>
                        </div>
                        <p className="text-xs text-slate-500">Renueva el {date(r.currentPeriodEnd)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <Panel title="Academias nuevas por mes" subtitle="Registros en la plataforma, con o sin plan · últimos 12 meses">
              <MonthlyBars data={sales.newAcademies} unit="academias" />
            </Panel>
          </div>

          {/* ─── Suscripciones ──────────────────────────────────────── */}
          <section id="suscripciones" className="scroll-mt-6 p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <LineChart className="w-5 h-5 text-blue-400" /> Suscripciones
                </h2>
                <p className="text-xs text-slate-500">{rows.length} de {sales.rows.length} academias con suscripción</p>
              </div>
              <form action="/dashboard/admin/sales#suscripciones" className="flex gap-2">
                {filter && <input type="hidden" name="estado" value={filter} />}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input name="q" defaultValue={sp.q ?? ""} placeholder="Academia o correo…" className="w-56 pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white" />
                </div>
                <button type="submit" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white">Buscar</button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {[["", "Todas"], ...(Object.keys(STATES) as SaleState[]).map((s) => [s, STATES[s].label])].map(([value, label]) => (
                <Link
                  key={value || "all"}
                  href={filterHref(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${filter === value ? "bg-blue-600 border-blue-600 text-white" : "border-slate-700 text-slate-300 hover:bg-slate-800"}`}
                >
                  {label}
                </Link>
              ))}
            </div>

            {rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">No hay suscripciones con esos filtros.</p>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="w-full text-sm min-w-[860px]">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                      <th className="py-2.5 pr-4 font-semibold">Academia</th>
                      <th className="py-2.5 pr-4 font-semibold">Plan</th>
                      <th className="py-2.5 pr-4 font-semibold text-right">Importe</th>
                      <th className="py-2.5 pr-4 font-semibold">Estado</th>
                      <th className="py-2.5 pr-4 font-semibold">Renueva / vence</th>
                      <th className="py-2.5 pr-4 font-semibold">Alta</th>
                      <th className="py-2.5 font-semibold text-right">Cobro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: SaleRow) => (
                      <tr key={r.id} className="border-b border-slate-800/70 hover:bg-slate-800/30">
                        <td className="py-3 pr-4">
                          <a href={`/a/${r.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-white hover:text-blue-300">{r.academy}</a>
                          <p className="text-xs text-slate-500">{r.ownerEmail ?? "—"}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-white">{r.planName}</span>
                          <p className="text-xs text-slate-500">{r.interval === "YEARLY" ? "Anual" : "Mensual"}</p>
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {r.kind === "payphone" ? (
                            <>
                              <span className="text-white font-semibold">{usd(r.amount, 2)}</span>
                              <p className="text-xs text-slate-500">{r.interval === "YEARLY" ? `${usd(r.monthly, 2)}/mes` : "por mes"}</p>
                            </>
                          ) : (
                            <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                              <Gift className="w-3.5 h-3.5" /> {r.kind === "internal" ? "Cortesía" : "Simulada"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4"><StateBadge state={r.state} /></td>
                        <td className="py-3 pr-4 text-slate-300 whitespace-nowrap">{new Date(r.currentPeriodEnd).getUTCFullYear() >= 2090 ? "Sin vencimiento" : date(r.currentPeriodEnd)}</td>
                        <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">{date(r.createdAt)}</td>
                        <td className="py-3 text-right">
                          {r.kind === "payphone" && (
                            <span className="text-xs text-slate-400 whitespace-nowrap">{r.autoCharge ? "Automático" : "Manual"}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ─── Biblioteca ─────────────────────────────────────────── */}
          <section id="biblioteca" className="scroll-mt-6 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Library className="w-5 h-5 text-blue-400" /> Biblioteca de la plataforma
                </h2>
                <p className="text-xs text-slate-500 max-w-xl">
                  Lo que subes tú se publica al momento. Lo que suben los profesores espera aquí tu aprobación antes de que lo vean los demás.
                </p>
              </div>
              <div className="flex gap-2">
                <Link href="/dashboard/biblioteca" className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-300 hover:text-white">Ver biblioteca</Link>
                {mongo && library && <LibraryUploadButton languages={LIBRARY_LANGUAGES} isPlatformAdmin />}
              </div>
            </div>

            {!mongo || !library ? (
              <div className="p-8 rounded-2xl bg-slate-900 border border-amber-500/30 text-center text-sm text-slate-300">
                {mongo ? "No se pudo conectar con MongoDB. Revisa MONGODB_URI y el acceso de red en MongoDB Atlas." : "Falta configurar MONGODB_URI en el servidor."}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Kpi icon={FileText} label="Publicados" value={library.approved.toLocaleString("es")} hint={library.byKind.map((k) => `${k.count} ${k.label}`).join(" · ") || "—"} />
                  <Kpi icon={Clock} label="Por aprobar" value={library.pending.toLocaleString("es")} hint={library.pending ? "Revísalos abajo" : "Nada pendiente"} />
                  <Kpi icon={Download} label="Descargas" value={library.downloads.toLocaleString("es")} hint="Total histórico" />
                  <Kpi icon={Users} label="Profesores que aportan" value={library.contributors.length.toLocaleString("es")} hint={`${library.rejected} archivo(s) rechazado(s)`} />
                </div>

                <Panel title={`Pendientes de aprobación (${pending.length})`} subtitle="Revisa el archivo antes de aprobarlo: al aprobarlo lo ven todos los profesores de la plataforma">
                  {pending.length === 0 ? (
                    <p className="text-sm text-slate-400 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> No hay archivos esperando revisión.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pending.map((f) => (
                        <div key={f.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex flex-col gap-3">
                          <div>
                            <p className="font-semibold text-white leading-snug">{f.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {f.uploadedByName}{f.uploadedByAcademy ? ` · ${f.uploadedByAcademy}` : ""} · {date(f.createdAt)}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {f.language} · {f.originalName} · {(f.size / 1048576).toFixed(1)} MB
                            </p>
                            {f.description && <p className="text-xs text-slate-400 mt-2 line-clamp-3">{f.description}</p>}
                          </div>
                          <a href={`/api/library/${f.id}/download`} className="mt-auto px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                            <Download className="w-3.5 h-3.5" /> Descargar para revisar
                          </a>
                          <LibraryItemActions id={f.id} title={f.title} canDelete canReview />
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <div className="grid lg:grid-cols-2 gap-6">
                  <Panel title="Profesores que aportan" subtitle="Archivos subidos por profesores de las academias">
                    {library.contributors.length === 0 ? (
                      <p className="text-sm text-slate-400">Ningún profesor ha subido archivos todavía.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                            <th className="py-2 font-semibold">Profesor</th>
                            <th className="py-2 font-semibold text-right">Publicados</th>
                            <th className="py-2 font-semibold text-right">Pendientes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {library.contributors.map((c) => (
                            <tr key={c.userId} className="border-b border-slate-800/70">
                              <td className="py-2.5">
                                <span className="text-white font-medium">{c.name}</span>
                                {c.academy && <p className="text-xs text-slate-500">{c.academy}</p>}
                              </td>
                              <td className="py-2.5 text-right tabular-nums text-slate-300">{c.approved}</td>
                              <td className="py-2.5 text-right tabular-nums">
                                {c.pending ? <span className="inline-flex items-center gap-1 text-white font-bold"><Clock className="w-3.5 h-3.5" style={{ color: "#fab219" }} /> {c.pending}</span> : <span className="text-slate-500">0</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </Panel>

                  <Panel title="Más descargados" subtitle="Archivos publicados con más descargas">
                    {library.topDownloaded.length === 0 ? (
                      <p className="text-sm text-slate-400">Todavía no hay descargas.</p>
                    ) : (
                      <ol className="space-y-3">
                        {library.topDownloaded.map((d, i) => (
                          <li key={d.id} className="flex items-center gap-3 text-sm">
                            <span className="w-6 text-right text-slate-500 tabular-nums">{i + 1}.</span>
                            <span className="flex-1 text-white truncate">{d.title}</span>
                            <span className="text-slate-300 tabular-nums">{d.downloads.toLocaleString("es")}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Panel>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

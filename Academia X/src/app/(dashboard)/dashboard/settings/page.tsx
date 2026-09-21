import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, OWNER_ONLY } from "@/lib/session";
import { BrandingSettingsForm } from "@/components/dashboard/BrandingSettingsForm";
import { Palette, Globe } from "lucide-react";
import { SAAS_PLANS } from "@/modules/billing/plans";
import { prisma } from "@/lib/db";
import { setCustomDomainAction } from "@/app/actions/academy.actions";

export default async function SettingsPage() {
  const ctx = await getDashboardContext(OWNER_ONLY);
  const { tenantId, tenant: academy } = ctx;
  const tenantSlug = academy.slug;
  const name = academy.name;


  const primaryColor = academy.primaryColor;
  const secondaryColor = academy.secondaryColor;
  const logoUrl = academy.logoUrl || "";

  const planId = ctx.activePlan?.id as keyof typeof SAAS_PLANS | undefined;
  const capabilities = planId ? SAAS_PLANS[planId].capabilities : null;
  const tenantRecord = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { customDomain: true } });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={tenantSlug} academyName={name} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />

        <main className="p-8 flex-1 overflow-y-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-white mb-2 flex items-center gap-3">
              <Palette className="w-7 h-7 text-blue-400" /> Configuración & Branding
            </h1>
            <p className="text-slate-400 text-sm">
              Personaliza el nombre, logo e identidad visual de tu escuela de idiomas.
            </p>
          </div>

          <BrandingSettingsForm
            tenantId={tenantId}
            initialName={name}
            initialPrimaryColor={primaryColor}
            initialSecondaryColor={secondaryColor}
            initialLogoUrl={logoUrl}
            slug={tenantSlug}
          />

          {!capabilities?.customBranding && (
            <p className="mt-4 text-xs text-amber-400">
              Tu plan permite cambiar el nombre. Colores y logo están disponibles desde el plan Professional.
            </p>
          )}

          <section className="mt-10 p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" /> Dominio personalizado
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Tu academia siempre está disponible en <span className="font-mono">{tenantSlug}.{process.env.NEXT_PUBLIC_APP_HOST || "academiax.com"}</span>.
              </p>
            </div>
            {capabilities?.customDomain ? (
              <form action={setCustomDomainAction} className="space-y-3">
                <input
                  name="customDomain"
                  defaultValue={tenantRecord?.customDomain || ""}
                  placeholder="www.miacademia.com"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500">
                  Crea un registro CNAME de tu dominio apuntando a <span className="font-mono">cname.vercel-dns.com</span>. Deja vacío para quitarlo.
                </p>
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">
                  Guardar dominio
                </button>
              </form>
            ) : (
              <p className="text-xs text-amber-400">El dominio personalizado está disponible en el plan Academy Executive.</p>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

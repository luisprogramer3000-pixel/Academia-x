import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Images } from "lucide-react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { prisma } from "@/lib/db";
import { AICreditEngine } from "@/modules/ai/ai.credit-engine";
import { PhotoDeckService } from "@/modules/presentation/photo-deck/photo-deck.service";
import { PhotoDeckStudio } from "./PhotoDeckStudio";

export const dynamic = "force-dynamic";

/** Presentación "foto + texto": guion revisable por el profesor y una foto por diapositiva. */
export default async function PhotoDeckPage({ params, searchParams }: { params: Promise<{ lessonId: string }>; searchParams: Promise<{ nueva?: string }> }) {
  const { lessonId } = await params;
  const { nueva } = await searchParams;
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { tenantId, deletedAt: null } } },
    select: { id: true, title: true },
  });
  if (!lesson) notFound();

  const [latest, wallet] = await Promise.all([
    nueva ? null : PhotoDeckService.latestForLesson(tenantId, lessonId),
    AICreditEngine.getTenantWalletSummary(tenantId),
  ]);
  const deck = latest ? await PhotoDeckService.get(tenantId, latest.id) : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        <main className="p-4 sm:p-8 flex-1 overflow-y-auto max-w-6xl w-full">
          <Link href={`/dashboard/lessons/${lesson.id}/editar`} className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1 font-semibold mb-5">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a la lección
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <Images className="w-7 h-7 text-amber-400" /> PowerPoint con fotos
          </h1>
          <p className="text-sm text-slate-400 mt-1 mb-8 max-w-3xl">
            «{lesson.title}». La IA escribe el guion, tú lo revisas y después se genera una fotografía realista por diapositiva.
            El texto va en PowerPoint como texto real: sin errores y editable.
          </p>
          <PhotoDeckStudio
            lessonId={lesson.id}
            initialDeck={deck ? { id: deck.id, script: deck.script } : null}
            initialCredits={wallet.teacherCredits.available}
            accent={academy.primaryColor || "#2563EB"}
            academyName={academy.name}
          />
        </main>
      </div>
    </div>
  );
}

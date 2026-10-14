import { notFound } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { prisma } from "@/lib/db";
import { collectMultipleChoice, readResourceData } from "@/modules/resources/plan-to-lesson";
import { ResourceDetailClient } from "./ResourceDetailClient";

export default async function ResourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { id } = await params;
  const { nuevo } = await searchParams;
  const ctx = await getDashboardContext(STAFF_ROLES);
  const { tenantId, tenant: academy } = ctx;

  const resource = await prisma.teachingResource.findFirst({ where: { id, tenantId } });
  if (!resource || (resource.kind !== "CLASS_PLAN" && resource.kind !== "MATERIAL")) notFound();

  // Si la lección vinculada se borró, se permite volver a convertir
  const lesson = resource.lessonId
    ? await prisma.lesson.findFirst({
        where: { id: resource.lessonId, module: { course: { tenantId, deletedAt: null } } },
        select: { id: true, module: { select: { courseId: true, course: { select: { contentType: true } } } } },
      })
    : null;

  const courses = await prisma.course.findMany({
    where: { tenantId, contentType: "COURSE" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, modules: { orderBy: { order: "asc" }, select: { id: true, title: true } } },
  });

  const { plan, material } = readResourceData(resource.kind, resource.data, resource.title);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <div className="print:hidden">
        <Sidebar tenantSlug={academy.slug} academyName={academy.name} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="print:hidden">
          <Header userName={ctx.user.name} userEmail={ctx.user.email} tenantId={tenantId} planLabel={ctx.activePlan?.name} />
        </div>
        <main className="p-8 flex-1 overflow-y-auto">
          <ResourceDetailClient
            resourceId={resource.id}
            plan={plan}
            material={material}
            liveQuestionCount={collectMultipleChoice(plan).length}
            lessonHref={
              !lesson
                ? null
                : lesson.module.course.contentType === "STANDALONE_LESSON"
                ? `/dashboard/lessons/${lesson.id}`
                : `/dashboard/courses/${lesson.module.courseId}/lessons/${lesson.id}`
            }
            courses={courses}
            isNew={nuevo === "1"}
          />
        </main>
      </div>
    </div>
  );
}

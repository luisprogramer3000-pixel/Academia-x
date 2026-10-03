import { notFound } from "next/navigation";
import { getDashboardContext, STAFF_ROLES } from "@/lib/session";
import { prisma } from "@/lib/db";
import { buildDeck, type DeckInput } from "@/modules/presentation/presentation.deck";
import type { TextDensity } from "@/modules/presentation/presentation.themes";
import { LessonPresenter } from "./LessonPresenter";

const DENSITIES: TextDensity[] = ["minimo", "estandar", "detallado"];

/** Modo exposición: la lección como diapositivas a pantalla completa (solo profesorado). */
export default async function PresentLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { lessonId } = await params;
  const { d } = await searchParams;
  const density = DENSITIES.includes(d as TextDensity) ? (d as TextDensity) : "minimo";
  const { tenantId, tenant } = await getDashboardContext(STAFF_ROLES);

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, module: { course: { tenantId } } },
    select: {
      title: true,
      content: true,
      module: { select: { course: { select: { id: true, title: true, contentType: true } } } },
    },
  });
  if (!lesson) notFound();

  let blocks: DeckInput["blocks"] = [];
  try {
    const parsed = JSON.parse(lesson.content || "{}");
    blocks = Array.isArray(parsed.blocks) ? parsed.blocks : Array.isArray(parsed) ? parsed : [];
  } catch {
    blocks = [];
  }

  // En la exposición se va directo a los conceptos y ejercicios: se omite el capítulo del reto
  // (desde su cabecera hasta el siguiente capítulo)
  // Tampoco se proyectan las tarjetas de repaso (flashcards)
  let inReto = false;
  const kept = blocks.filter((b) => {
    if (b.type === "chapter") inReto = /reto/i.test(b.label ?? "");
    return !inReto && b.type !== "flashcards";
  });
  // Capítulos que se han quedado sin contenido (p. ej. "Repaso", que solo tenía tarjetas)
  const presented = kept.filter((b, i) => b.type !== "chapter" || (kept[i + 1] !== undefined && kept[i + 1].type !== "chapter"));

  // Sin el guion del profesor ni las diapositivas de respuesta: se proyecta la pregunta, no la solución
  const slides = buildDeck(
    {
      lessonTitle: lesson.title,
      courseTitle: lesson.module.course.contentType === "COURSE" ? lesson.module.course.title : "",
      academyName: tenant.name,
      primaryColor: tenant.primaryColor || "#2563EB",
      blocks: presented,
      teacherPlan: null,
    },
    density
  ).filter((s) => s.kind !== "answer");

  return (
    <LessonPresenter
      lessonId={lessonId}
      title={lesson.title}
      slides={slides}
      density={density}
      accent={tenant.primaryColor || "#2563EB"}
      backHref={lesson.module.course.contentType === "STANDALONE_LESSON" ? `/dashboard/lessons/${lessonId}` : `/dashboard/courses/${lesson.module.course.id}/builder`}
    />
  );
}

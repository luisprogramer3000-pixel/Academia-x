import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess, STAFF_ROLES, assertLessonInTenant } from "@/lib/session";
import { buildDeck, renderPptx, renderPdf, deckFileName, normalizeHex, type DeckInput } from "@/modules/presentation/presentation.service";
import { getPresetTheme, type TextDensity } from "@/modules/presentation/presentation.themes";
import {
  resolveUploadedModel,
  resolveWebModel,
  templatePdfTheme,
  TemplateError,
  type ResolvedModel,
} from "@/modules/presentation/presentation.template";
import { getLibraryTemplate } from "@/modules/presentation/presentation.library";
import { contentCapacity, fillPptxTemplate, splitForCapacity } from "@/modules/presentation/pptx-template";
import { loadDeckImages } from "@/modules/presentation/presentation.images";
import { fitDeckToCount, lessonToPlainText, MAX_SLIDES, MIN_SLIDES } from "@/modules/presentation/presentation.deck";
import { flattenAiDeck } from "@/modules/presentation/ai-deck.schema";
import { renderRichPptx } from "@/modules/presentation/rich-pptx";
import { renderLessonDocument } from "@/modules/presentation/lesson-document";
import { AIService } from "@/modules/ai/ai.service";
import { AICreditError } from "@/modules/ai/ai.credit-engine";
import { requireActiveSubscription } from "@/modules/billing/entitlements";

export const dynamic = "force-dynamic";
// La versión con IA puede tardar (diseño + ilustraciones)
export const maxDuration = 300;

const DENSITIES: TextDensity[] = ["minimo", "estandar", "detallado"];

/**
 * Descarga la lección como presentación lista para dar clase.
 *
 *   GET  /api/lessons/{id}/presentation?format=pptx|pdf   → diseño de la academia, densidad estándar
 *   POST /api/lessons/{id}/presentation  (multipart)       → con opciones:
 *        format, density (minimo|estandar|detallado),
 *        design = preset | upload | web, preset ("marca", "cuaderno"… o "lib:<modelo>"), file, url
 *
 * Con un modelo .pptx, el PowerPoint se genera rellenando las diapositivas del
 * propio modelo (conserva todo su diseño); el PDF usa sus colores y tipografía.
 * Solo el personal de la academia: es material de preparación de clase.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await context.params;
  const format = (req.nextUrl.searchParams.get("format") || "pptx").toLowerCase();
  return respond(lessonId, format, "estandar", undefined, async (primary) => ({ theme: getPresetTheme("marca", primary) }));
}

export async function POST(req: NextRequest, context: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await context.params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  }

  const format = String(form.get("format") || "pptx").toLowerCase();
  const densityRaw = String(form.get("density") || "estandar") as TextDensity;
  const density = DENSITIES.includes(densityRaw) ? densityRaw : "estandar";
  const design = String(form.get("design") || "preset");
  const requested = Number(form.get("slides"));
  const slideCount = Number.isFinite(requested) && requested > 0 ? Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Math.round(requested))) : undefined;

  const quality = String(form.get("quality") || "basic");
  const ai = quality === "ai"
    ? {
        imageCount: Math.max(0, Math.min(4, Number(form.get("imageCount") || 0))),
        idempotencyKey: String(form.get("idempotencyKey") || crypto.randomUUID()).slice(0, 100),
      }
    : undefined;

  return respond(lessonId, format, density, slideCount, async (primary) => {
    if (design === "upload") {
      const file = form.get("file");
      if (!(file instanceof File) || file.size === 0) throw new TemplateError("Sube un archivo con tu modelo.");
      return resolveUploadedModel(new Uint8Array(await file.arrayBuffer()));
    }
    if (design === "web") {
      const url = String(form.get("url") || "").trim();
      if (!url) throw new TemplateError("Pega el enlace del modelo que quieres replicar.");
      return resolveWebModel(url);
    }
    const preset = String(form.get("preset") || "marca");
    if (preset.startsWith("lib:")) {
      const template = await getLibraryTemplate(preset.slice(4));
      if (!template) throw new TemplateError("Ese modelo ya no está disponible.");
      return { template, theme: templatePdfTheme(template) };
    }
    return { theme: getPresetTheme(preset, primary) };
  }, ai);
}

async function respond(
  lessonId: string,
  format: string,
  density: TextDensity,
  slideCount: number | undefined,
  resolveModel: (primaryHex: string) => Promise<ResolvedModel>,
  /** Presentación inteligente con IA (cuesta créditos); sin esto, versión básica gratis */
  ai?: { imageCount: number; idempotencyKey: string }
) {
  if (format !== "pptx" && format !== "pdf") {
    return NextResponse.json({ error: "Formato no soportado. Usa pptx o pdf." }, { status: 400 });
  }

  let auth: { tenantId: string; userId: string };
  try {
    auth = await requireTenantAccess(STAFF_ROLES);
    await assertLessonInTenant(lessonId, auth.tenantId);
  } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      content: true,
      teacherPlan: true,
      module: { select: { course: { select: { title: true, level: true, language: true, tenant: { select: { name: true, primaryColor: true } } } } } },
    },
  });
  if (!lesson) return NextResponse.json({ error: "Lección no encontrada" }, { status: 404 });

  let blocks: DeckInput["blocks"] = [];
  try {
    const parsed = JSON.parse(lesson.content || "{}");
    if (Array.isArray(parsed.blocks)) blocks = parsed.blocks;
    else if (Array.isArray(parsed)) blocks = parsed;
  } catch {
    blocks = [];
  }

  const deckInput: DeckInput = {
    lessonTitle: lesson.title,
    courseTitle: lesson.module.course.title,
    academyName: lesson.module.course.tenant.name,
    primaryColor: lesson.module.course.tenant.primaryColor || "#2563EB",
    blocks,
    teacherPlan: (lesson.teacherPlan as never) ?? null,
  };

  // El PDF es un documento de estudio A4 (portada, secciones, tablas, ejercicios y claves),
  // no una versión de las diapositivas: no depende del modelo, la densidad ni la IA
  if (format === "pdf") {
    try {
      const images = await loadDeckImages(blocks.filter((b) => b.type === "image").map((b) => b.url));
      const file = await renderLessonDocument(
        { lessonTitle: lesson.title, courseTitle: lesson.module.course.title, academyName: deckInput.academyName, level: lesson.module.course.level, blocks },
        images
      );
      return fileResponse(file, lesson.title, format);
    } catch (error) {
      console.error("[presentation] Error generando documento PDF", error);
      return NextResponse.json({ error: "No se pudo generar el PDF." }, { status: 500 });
    }
  }

  let model: ResolvedModel;
  try {
    model = await resolveModel(normalizeHex(deckInput.primaryColor));
  } catch (error) {
    const message = error instanceof TemplateError ? error.message : "No se pudo cargar el modelo.";
    if (!(error instanceof TemplateError)) console.error("[presentation] Modelo", error);
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Modelos sin diapositivas de texto (solo diagramas): diseño propio con los colores del modelo
  const usesTemplate = format === "pptx" && Boolean(model.template) && model.template!.contentFit !== "poor";

  if (ai) {
    try {
      await requireActiveSubscription(auth.tenantId);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Tu plan no permite usar la IA." }, { status: 402 });
    }
    let aiDeck;
    try {
      aiDeck = await AIService.generatePresentationDeckAI({
        tenantId: auth.tenantId,
        userId: auth.userId,
        idempotencyKey: ai.idempotencyKey,
        lessonId,
        lessonTitle: lesson.title,
        lessonText: lessonToPlainText(blocks),
        level: lesson.module.course.level,
        language: lesson.module.course.language || "es",
        slideCount: slideCount ?? 12,
        density,
        imageCount: ai.imageCount,
      });
    } catch (error) {
      console.error("[presentation] IA", error);
      const code = error instanceof Error ? error.message : "";
      if (code === AICreditError.INSUFFICIENT_AI_CREDITS) {
        return NextResponse.json({ error: "No tienes créditos de IA suficientes. Usa la versión básica (gratis) o recarga créditos." }, { status: 402 });
      }
      // En desarrollo se muestra la causa técnica para poder diagnosticarla
      const detail = process.env.NODE_ENV !== "production" && code ? ` (Detalle: ${code.replace(/sk-[\w-]+/g, "sk-***").slice(0, 300)})` : "";
      return NextResponse.json({ error: `La IA no pudo diseñar la presentación. Los créditos se han devuelto; inténtalo de nuevo.${detail}` }, { status: 502 });
    }

    const images = await loadDeckImages(aiDeck.slides.map((s) => ("imageUrl" in s ? s.imageUrl : undefined)));
    try {
      let file: Buffer;
      if (format === "pptx" && !usesTemplate) {
        file = await renderRichPptx(aiDeck.slides, { lessonTitle: lesson.title, academyName: deckInput.academyName }, model.theme, images);
      } else {
        // Modelos .pptx y PDF: versión plana del mismo guion (mismo contenido y actividades)
        const flat = flattenAiDeck(aiDeck.slides, deckInput.academyName);
        file = usesTemplate
          ? await fillPptxTemplate(model.template!, splitForCapacity(flat, contentCapacity(model.template!), Boolean(model.template!.listSlide)), images)
          : await renderPdf(flat, deckInput, model.theme, density, images);
      }
      return fileResponse(file, lesson.title, format);
    } catch (error) {
      console.error("[presentation] Error generando (IA)", format, error);
      return NextResponse.json({ error: "No se pudo generar la presentación." }, { status: 500 });
    }
  }

  const built = buildDeck(deckInput, density);
  // Con modelo: el contenido se reparte según la capacidad de sus cuadros y el cierre cuenta en el total
  const base = usesTemplate
    ? splitForCapacity(built, contentCapacity(model.template!), Boolean(model.template!.listSlide))
    : built;
  const deck = slideCount ? fitDeckToCount(base, slideCount - (usesTemplate && model.template!.closing ? 1 : 0)) : base;
  // Las imágenes de la lección (subidas, generadas con IA o enlazadas) van dentro de la presentación
  const images = await loadDeckImages(deck.map((s) => s.image));

  try {
    let file: Buffer;
    if (usesTemplate) {
      file = await fillPptxTemplate(model.template!, deck, images);
    } else if (format === "pptx") {
      file = await renderPptx(deck, deckInput, model.theme, density, images);
    } else {
      file = await renderPdf(deck, deckInput, model.theme, density, images);
    }
    return fileResponse(file, lesson.title, format);
  } catch (error) {
    console.error("[presentation] Error generando", format, error);
    return NextResponse.json({ error: "No se pudo generar la presentación." }, { status: 500 });
  }
}

function fileResponse(file: Buffer, title: string, format: string) {
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type":
        format === "pptx" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "application/pdf",
      "Content-Disposition": `attachment; filename="${deckFileName(title, format)}"`,
      "Content-Length": String(file.length),
      "Cache-Control": "no-store",
    },
  });
}

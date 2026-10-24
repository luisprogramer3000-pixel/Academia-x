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
import { getLibraryModelBytes, getLibraryTemplate } from "@/modules/presentation/presentation.library";
import { generatePresentation, type GeneratePresentationResult } from "@/modules/presentation/engine";
import type { DesignMode } from "@/modules/presentation/engine/types";
import { PresentationEngineError } from "@/modules/presentation/engine/errors";
import { imageGenerator, librarySearch, loadImage } from "@/modules/presentation/engine/sources";
import type { DeckTheme } from "@/modules/presentation/presentation.themes";
import { contentCapacity, fillPptxTemplate, splitForCapacity } from "@/modules/presentation/pptx-template";
import { loadDeckImages } from "@/modules/presentation/presentation.images";
import { fitDeckToCount, lessonToPlainText, MAX_SLIDES, MIN_SLIDES } from "@/modules/presentation/presentation.deck";
import { flattenAiDeck } from "@/modules/presentation/ai-deck.schema";
import { renderRichPptx } from "@/modules/presentation/rich-pptx";
import { renderLessonDocument } from "@/modules/presentation/lesson-document";
import { AIService } from "@/modules/ai/ai.service";
import { AICreditError } from "@/modules/ai/ai.credit-engine";
import { requireActiveSubscription } from "@/modules/billing/entitlements";
import { startAIJob } from "@/modules/ai/ai.background";
import { putUpload } from "@/lib/storage";
import type { PresentationJobResult } from "@/modules/presentation/presentation.job";
import { randomBytes } from "crypto";

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
  if (format === "pptx" && engineV2()) return respondV2(lessonId, { density: "estandar", design: { kind: "preset", preset: "marca" } });
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

  if (format === "pptx" && engineV2()) {
    const preset = String(form.get("preset") || "marca");
    const file = form.get("file");
    return respondV2(lessonId, {
      density,
      // "auto" (o vacío): el motor decide por la complejidad de la clase
      slideCount: String(form.get("slides") || "auto") === "auto" ? undefined : slideCount,
      templateMode: String(form.get("templateMode") || "inspired") === "adapt" ? "ADAPT_TEMPLATE" : "INSPIRED_BY_TEMPLATE",
      design:
        design === "upload" ? { kind: "upload", file: file instanceof File ? file : null }
        : design === "web" ? { kind: "web", url: String(form.get("url") || "").trim() }
        : { kind: "preset", preset },
      ai: quality === "ai"
        ? {
            imageCount: Math.max(0, Math.min(24, Number(form.get("imageCount") || 0))),
            idempotencyKey: String(form.get("idempotencyKey") || crypto.randomUUID()).slice(0, 100),
          }
        : undefined,
      // Básica: fotos solo para las tarjetas de vocabulario (1 crédito por foto generada)
      vocabPhotos: quality !== "ai" && form.get("vocabPhotos") === "1"
        ? { idempotencyKey: String(form.get("idempotencyKey") || crypto.randomUUID()).slice(0, 100) }
        : undefined,
    });
  }
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
      const images = await loadDeckImages(blocks.filter((b) => b.type === "image" || b.type === "text").map((b) => b.url));
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

const PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function fileResponse(file: Buffer, title: string, format: string) {
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": format === "pptx" ? PPTX_TYPE : "application/pdf",
      "Content-Disposition": `attachment; filename="${deckFileName(title, format)}"`,
      "Content-Length": String(file.length),
      "Cache-Control": "no-store",
    },
  });
}

// ─── Motor de presentaciones v2 ──────────────────────────────────────────────

/** Interruptor: PRESENTATION_ENGINE=v1 vuelve al generador anterior sin desplegar código. */
function engineV2(): boolean {
  return (process.env.PRESENTATION_ENGINE || "v2").toLowerCase() !== "v1";
}

type DesignSpec =
  | { kind: "preset"; preset: string }
  | { kind: "upload"; file: File | null }
  | { kind: "web"; url: string };

interface V2Options {
  density: TextDensity;
  slideCount?: number;
  templateMode?: DesignMode;
  design: DesignSpec;
  ai?: { imageCount: number; idempotencyKey: string };
  vocabPhotos?: { idempotencyKey: string };
}

/** Máximo de fotos de vocabulario en la básica (las tarjetas que ya tienen foto de la lección no se cobran). */
const MAX_VOCAB_PHOTOS = 12;

const isZip = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

/** Traduce la elección del profesor a un modo de diseño del motor. */
async function resolveDesignChoice(spec: DesignSpec, primary: string, templateMode: DesignMode): Promise<{
  mode: DesignMode; theme?: DeckTheme; template?: { id: string; bytes: Uint8Array };
}> {
  if (spec.kind === "upload") {
    if (!spec.file || spec.file.size === 0) throw new TemplateError("Sube un archivo con tu modelo.");
    if (spec.file.size > 36 * 1024 * 1024) throw new TemplateError("El archivo supera los 36 MB.");
    const bytes = new Uint8Array(await spec.file.arrayBuffer());
    if (isZip(bytes)) return { mode: templateMode, template: { id: spec.file.name.slice(0, 80) || "modelo", bytes } };
    return { mode: "BASIC", theme: (await resolveUploadedModel(bytes)).theme };
  }
  if (spec.kind === "web") {
    if (!spec.url) throw new TemplateError("Pega el enlace del modelo que quieres replicar.");
    const model = await resolveWebModel(spec.url);
    if (model.template) return { mode: templateMode, template: { id: "web", bytes: model.template.bytes } };
    return { mode: "BASIC", theme: model.theme };
  }
  if (spec.preset === "smart") return { mode: "SMART_DESIGN" };
  if (spec.preset.startsWith("lib:")) {
    const id = spec.preset.slice(4);
    const bytes = await getLibraryModelBytes(id);
    if (!bytes) throw new TemplateError("Ese modelo ya no está disponible.");
    return { mode: templateMode, template: { id, bytes } };
  }
  return { mode: "BASIC", theme: getPresetTheme(spec.preset, primary) };
}

async function respondV2(lessonId: string, opts: V2Options) {
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
    blocks = Array.isArray(parsed.blocks) ? parsed.blocks : Array.isArray(parsed) ? parsed : [];
  } catch {
    blocks = [];
  }
  const course = lesson.module.course;
  const primary = normalizeHex(course.tenant.primaryColor || "#2563EB");

  let design: Awaited<ReturnType<typeof resolveDesignChoice>>;
  try {
    design = await resolveDesignChoice(opts.design, primary, opts.templateMode ?? "INSPIRED_BY_TEMPLATE");
  } catch (error) {
    const message = error instanceof TemplateError ? error.message : "No se pudo cargar el modelo.";
    if (!(error instanceof TemplateError)) console.error("[presentation-v2] Modelo", error);
    return NextResponse.json({ error: message }, { status: 422 });
  }

  // Inteligente con IA: planificación con IA (créditos) + ilustraciones opcionales
  let planner: Awaited<ReturnType<typeof AIService.presentationPlanner>> | undefined;
  if (opts.ai) {
    try {
      await requireActiveSubscription(auth.tenantId);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Tu plan no permite usar la IA." }, { status: 402 });
    }
    try {
      planner = await AIService.presentationPlanner({ tenantId: auth.tenantId, userId: auth.userId, idempotencyKey: opts.ai.idempotencyKey, lessonId });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === AICreditError.INSUFFICIENT_AI_CREDITS) {
        return NextResponse.json({ error: "No tienes créditos de IA suficientes. Usa la versión básica (gratis) o recarga créditos." }, { status: 402 });
      }
      console.error("[presentation-v2] Créditos", error);
      return NextResponse.json({ error: "No se pudo iniciar la presentación inteligente." }, { status: 500 });
    }
  }

  if (opts.vocabPhotos) {
    try {
      await requireActiveSubscription(auth.tenantId);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Tu plan no permite generar imágenes." }, { status: 402 });
    }
  }
  const vocabOnly = !planner && opts.vocabPhotos;

  // Solo lanza mensajes que se pueden mostrar al profesor
  const run = async (): Promise<GeneratePresentationResult> => {
    try {
      const result = await generatePresentation({
        lesson: {
          lessonId,
          title: lesson.title,
          courseTitle: course.title,
          academyName: course.tenant.name,
          language: course.language || "es",
          level: course.level,
          blocks,
          teacherPlan: (lesson.teacherPlan as never) ?? null,
        },
        density: opts.density,
        targetSlides: opts.slideCount,
        design: { ...design, brandPrimary: primary },
        planner: planner ? { kind: "llm", call: planner.call } : { kind: "heuristic" },
        images: {
          load: loadImage,
          searchLibrary: librarySearch(auth.userId),
          generate: planner && opts.ai?.imageCount
            ? imageGenerator({ tenantId: auth.tenantId, userId: auth.userId, idempotencyKey: opts.ai.idempotencyKey })
            : vocabOnly ? imageGenerator({ tenantId: auth.tenantId, userId: auth.userId, idempotencyKey: `vocab-${vocabOnly.idempotencyKey}` }) : undefined,
        },
        imageBudget: vocabOnly ? MAX_VOCAB_PHOTOS : opts.ai?.imageCount ?? 0,
        imagePurposes: vocabOnly ? ["vocabulary"] : undefined,
      });
      await planner?.finish(result.plan.metadata.planner === "llm");
      return result;
    } catch (error) {
      await planner?.finish(false, error).catch(() => undefined);
      console.error("[presentation-v2] Error generando", error);
      throw new Error(error instanceof PresentationEngineError ? error.message : "No se pudo generar la presentación.");
    }
  };

  // Con IA o fotos tarda más de lo que deja pasar el proxy del hosting (~30 s):
  // se genera en segundo plano, se guarda y el navegador la descarga al terminar
  if (planner || vocabOnly) {
    const jobId = await startAIJob<PresentationJobResult>(
      auth,
      "PRESENTATION",
      async () => {
        const result = await run();
        const fileName = `pres-${auth.tenantId}-${randomBytes(12).toString("hex")}.pptx`;
        const url = await putUpload("presentations", fileName, result.file, PPTX_TYPE);
        return {
          url,
          fileName: deckFileName(lesson.title, "pptx"),
          slides: result.slides.length,
          quality: result.quality.finalScore,
          planner: result.plan.metadata.planner,
          warnings: result.warnings,
        };
      },
      (error) => (error instanceof Error && error.message ? error.message : "No se pudo generar la presentación.")
    );
    return NextResponse.json({ jobId }, { status: 202 });
  }

  let result: GeneratePresentationResult;
  try {
    result = await run();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const res = fileResponse(result.file, lesson.title, "pptx");
  res.headers.set("X-Presentation-Engine", String(result.engineVersion));
  res.headers.set("X-Presentation-Quality", String(result.quality.finalScore));
  res.headers.set("X-Presentation-Slides", String(result.slides.length));
  res.headers.set("X-Presentation-Planner", result.plan.metadata.planner);
  if (result.warnings.length) res.headers.set("X-Presentation-Warnings", encodeURIComponent(result.warnings.join(" | ").slice(0, 600)));
  return res;
}

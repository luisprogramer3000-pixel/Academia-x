import { randomUUID } from "crypto";
import type { DesignMode, LessonContent, PresentationPlan, PresentationQuality, ResolvedDesignSystem, ResolvedImage, ResolvedSlide, SlidePlan, VisualAssetRequest } from "./types";
import { PRESENTATION_ENGINE_VERSION } from "./types";
import type { DeckTheme } from "../presentation.themes";
import { extractLessonContent, type ExtractInput } from "./planner/extract";
import { planFromContent, type TextDensity } from "./planner/heuristic";
import { planWithLlm, type JsonCaller } from "./planner/llm";
import { getDesignDNA } from "./design/dna-cache";
import { resolveDesignStyle } from "./design/resolver";
import { planAssets, generationPrompt } from "./assets/planner";
import { AssetResolver, type AssetSources } from "./assets/resolver";
import { labels } from "./i18n";
import { SlideBuilder } from "./layout/components";
import { rankCandidates, scoreLayouts, type SelectionHistory } from "./layout/selector";
import type { LayoutContext, LayoutDef } from "./layout/types";
import { getLayout } from "./layout/registry";
import { analyzeSlide, SLIDE_QUALITY_THRESHOLD, type SlideAnalysis } from "./validation/slide-validator";
import { evaluatePresentation } from "./validation/presentation-validator";
import { renderPptx } from "./render/pptx-renderer";
import { normalize, seededRandom } from "./text";
import { PresentationEngineError, SlideRenderError } from "./errors";

/**
 * Motor de presentaciones v2.
 *
 *   lección → extracción semántica → plan pedagógico (IA o heurístico)
 *   → sistema de diseño (modelo/básico/inteligente) → recursos visuales
 *   → layout por puntuación → elementos → validación + autocorrección
 *   → calidad global → PPTX editable
 */

export type GenerationStage = "PLANNING" | "RESOLVING_DESIGN" | "GENERATING_ASSETS" | "RENDERING" | "VALIDATING" | "UPLOADING" | "COMPLETED" | "FAILED";

export interface GeneratePresentationInput {
  lesson: ExtractInput;
  density: TextDensity;
  targetSlides?: number;
  design: {
    mode: DesignMode;
    theme?: DeckTheme;
    template?: { id: string; bytes: Uint8Array };
    brandPrimary: string;
  };
  planner: { kind: "heuristic" } | { kind: "llm"; call: JsonCaller };
  images: Omit<AssetSources, "generated"> & {
    /** Genera imágenes para las consultas dadas y devuelve consulta normalizada → URL */
    generate?: (requests: Array<{ key: string; prompt: string }>) => Promise<Map<string, string>>;
  };
  /** Cuántas imágenes puede generar (créditos aprobados por el profesor) */
  imageBudget?: number;
  /** Solo genera imágenes para estos usos (p. ej. la básica: solo las tarjetas de vocabulario) */
  imagePurposes?: VisualAssetRequest["purpose"][];
  onProgress?: (stage: GenerationStage, percent: number) => void;
}

export interface GeneratePresentationResult {
  generationId: string;
  engineVersion: number;
  file: Buffer;
  plan: PresentationPlan;
  content: LessonContent;
  slides: Array<{ order: number; role: string; layout: string; score: number; attempts: number; issues: string[] }>;
  quality: PresentationQuality;
  design: { id: string; name: string; mode: DesignMode; dnaCached?: boolean };
  warnings: string[];
  durationMs: number;
}

const MASCOT_ROLES = new Set(["cover", "hook", "production", "summary", "exit_ticket"]);

function log(event: string, data: Record<string, unknown>) {
  console.info(JSON.stringify({ scope: "presentation-v2", event, ...data }));
}

function notesFor(slide: SlidePlan): string {
  const lines = slide.speakerNotes.filter(Boolean);
  if (slide.visualIntent) lines.push(`[${slide.visualIntent}]`);
  return lines.join("\n");
}

/** Decide en qué diapositivas aparece el personaje del modelo (con moderación, sin seguidas). */
function mascotPlan(plan: PresentationPlan, design: ResolvedDesignSystem): Map<string, ResolvedImage> {
  const out = new Map<string, ResolvedImage>();
  if (!design.mascots.length) return out;
  const max = design.mode === "ADAPT_TEMPLATE" ? 6 : 4;
  let lastIndex = -3;
  let n = 0;
  plan.slides.forEach((s, i) => {
    if (n >= max || i - lastIndex < 2 || !MASCOT_ROLES.has(s.pedagogicalRole)) return;
    // La portada con foto propia no muestra el personaje
    if (s.pedagogicalRole === "cover" && s.visualAssetRequests.some((r) => r.preferredUrl)) return;
    out.set(s.id, design.mascots[n % design.mascots.length]);
    lastIndex = i;
    n++;
  });
  return out;
}

interface Attempt {
  layout: LayoutDef;
  reduction: number;
  elements: ResolvedSlide["elements"];
  analysis: SlideAnalysis;
}

export async function generatePresentation(input: GeneratePresentationInput): Promise<GeneratePresentationResult> {
  const started = Date.now();
  const generationId = randomUUID();
  const warnings: string[] = [];
  const progress = (stage: GenerationStage, pct: number) => input.onProgress?.(stage, pct);
  const base = { generationId, lessonId: input.lesson.lessonId, templateId: input.design.template?.id, mode: input.design.mode };

  try {
    // 1. Plan pedagógico
    progress("PLANNING", 10);
    const content = extractLessonContent(input.lesson);
    const plannerOpts = { density: input.density, targetSlides: input.targetSlides, designMode: input.design.mode, templateId: input.design.template?.id };
    let plan: PresentationPlan;
    if (input.planner.kind === "llm") {
      try {
        plan = await planWithLlm(content, input.planner.call, plannerOpts);
      } catch (error) {
        warnings.push("La IA no devolvió un plan válido: se usó el planificador pedagógico interno.");
        log("planner_fallback", { ...base, error: error instanceof Error ? error.message : String(error) });
        plan = planFromContent(content, plannerOpts);
      }
    } else {
      plan = planFromContent(content, plannerOpts);
    }

    // 2. Sistema de diseño
    progress("RESOLVING_DESIGN", 25);
    let dnaCached: boolean | undefined;
    let template: { bytes: Uint8Array; dna: Awaited<ReturnType<typeof getDesignDNA>>["dna"] } | undefined;
    if (input.design.template) {
      const { dna, cached } = await getDesignDNA(input.design.template.bytes, input.design.template.id);
      dnaCached = cached;
      template = { bytes: input.design.template.bytes, dna };
    }
    const design = await resolveDesignStyle({ mode: input.design.mode, tone: content.tone, brandPrimary: input.design.brandPrimary, theme: input.design.theme, template });

    // 3. Recursos visuales
    progress("GENERATING_ASSETS", 40);
    const assetPlan = planAssets(plan, input.images.generate ? input.imageBudget ?? 0 : 0, input.imagePurposes);
    let generated = new Map<string, string>();
    if (assetPlan.toGenerate.length && input.images.generate) {
      const style = { imageStyle: template?.dna.imageStyle.type ?? (content.tone === "kids" ? "illustration" : "illustration"), tone: content.tone, language: content.language };
      try {
        generated = await input.images.generate(assetPlan.toGenerate.map((r) => ({ key: normalize(r.semanticQuery), prompt: generationPrompt(r, style) })));
      } catch (error) {
        warnings.push("No se pudieron generar las ilustraciones: se usaron iconos.");
        log("asset_generation_failed", { ...base, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const resolver = new AssetResolver({ ...input.images, generated }, assetPlan);
    await resolver.warm([
      ...plan.slides.flatMap((s) => s.visualAssetRequests.map((r) => r.preferredUrl).filter((u): u is string => Boolean(u))),
      ...generated.values(),
    ]);
    await resolver.prefetchLibrary(assetPlan.toSearch);

    // 4. Layouts + elementos + autocorrección
    progress("RENDERING", 60);
    const L = labels(content.language);
    const mascots = mascotPlan(plan, design);
    const history: SelectionHistory = { layouts: [], families: [] };
    const rnd = seededRandom(`${content.lessonId ?? content.title}:${design.id}`);
    const resolved: ResolvedSlide[] = [];

    for (const [index, slidePlan] of plan.slides.entries()) {
      const assets = await resolver.resolve(slidePlan);
      const ctxFor = (layout: LayoutDef, reduction = 0): LayoutContext => ({
        plan: slidePlan, design, labels: L, assets, academyName: content.academyName, lessonTitle: content.title, level: content.level,
        index, total: plan.slides.length, mascot: mascots.get(slidePlan.id), variant: index, reduction,
      });
      const assetFlags = {
        hasImage: assets.some((a) => a.kind === "image"),
        hasEmoji: assets.some((a) => a.kind === "emoji"),
        hasMascot: mascots.has(slidePlan.id),
      };
      let scored = scoreLayouts(slidePlan, design, history, assetFlags);
      // Si la regla anti-repetición deja la diapositiva sin layout, se relaja antes que perder contenido
      if (!scored.length) scored = scoreLayouts(slidePlan, design, { layouts: [], families: [] }, assetFlags);
      if (!scored.length) {
        warnings.push(`Diapositiva ${index + 1} (${slidePlan.pedagogicalRole}) sin layout compatible: se omitió.`);
        resolver.release(assets);
        continue;
      }
      const ranked = rankCandidates(scored, (l) => ctxFor(l), rnd);

      const attempts: Attempt[] = [];
      const tryBuild = (layout: LayoutDef, reduction: number): Attempt | null => {
        try {
          const ctx = ctxFor(layout, reduction);
          const b = new SlideBuilder(design, slidePlan.pedagogicalRole === "cover");
          layout.build(ctx, b);
          if (slidePlan.pedagogicalRole !== "cover") b.footer(content.academyName);
          const analysis = analyzeSlide(b.elements, slidePlan, design, {
            repeatedLayout: history.layouts[history.layouts.length - 1] === layout.id,
            sameFamilyAsPrevious: history.families[history.families.length - 1] === layout.family,
          });
          return { layout, reduction, elements: b.elements, analysis };
        } catch (error) {
          log("layout_build_failed", { ...base, slideId: slidePlan.id, layout: layout.id, error: error instanceof Error ? error.message : String(error) });
          return null;
        }
      };
      const ok = (a: Attempt) => a.analysis.score >= SLIDE_QUALITY_THRESHOLD && !a.analysis.issues.some((i) => i.severity === "error");

      // Hasta 3 layouts candidatos; después, reducir contenido en el mejor
      for (const cand of ranked.slice(0, 3)) {
        const a = tryBuild(cand.layout, 0);
        if (a) attempts.push(a);
        if (a && ok(a)) break;
      }
      let best = attempts.sort((a, b) => b.analysis.score - a.analysis.score)[0];
      if (best && !ok(best)) {
        for (const reduction of [1, 2]) {
          const a = tryBuild(best.layout, reduction);
          if (!a) continue;
          attempts.push(a);
          if (a.analysis.score > best.analysis.score) best = a;
          if (ok(a)) break;
        }
      }
      if (!best) throw new SlideRenderError(slidePlan.id, `Ningún layout pudo construir la diapositiva ${index + 1}.`);

      history.layouts.push(best.layout.id);
      history.families.push(best.layout.family);
      resolved.push({
        plan: slidePlan,
        layoutId: best.layout.id,
        design,
        assets,
        elements: best.elements,
        notes: notesFor(slidePlan),
        attempts: attempts.length,
        quality: { ...best.analysis.metrics, score: best.analysis.score, issues: best.analysis.issues.map((i) => `${i.code}: ${i.detail}`) },
      });
      log("slide", { ...base, slideId: slidePlan.id, order: index + 1, role: slidePlan.pedagogicalRole, layout: best.layout.id, score: best.analysis.score, attempts: attempts.length });
    }

    // 5. Validación global
    progress("VALIDATING", 85);
    const finalPlan = { ...plan, slides: resolved.map((r) => r.plan) };
    const quality = evaluatePresentation(finalPlan, resolved, content);
    if (quality.missingIds.length) warnings.push(`Contenido no cubierto: ${quality.missingIds.join(", ")}`);

    // 6. Exportación
    progress("UPLOADING", 92);
    const file = await renderPptx(resolved, { title: content.title, author: content.academyName, design });
    progress("COMPLETED", 100);

    const durationMs = Date.now() - started;
    log("completed", { ...base, slides: resolved.length, qualityScore: quality.finalScore, durationMs, planner: plan.metadata.planner, dnaCached });
    return {
      generationId,
      engineVersion: PRESENTATION_ENGINE_VERSION,
      file,
      plan: finalPlan,
      content,
      slides: resolved.map((r) => ({ order: r.plan.order, role: r.plan.pedagogicalRole, layout: r.layoutId, score: r.quality?.score ?? 0, attempts: r.attempts, issues: r.quality?.issues ?? [] })),
      quality,
      design: { id: design.id, name: design.name, mode: design.mode, dnaCached },
      warnings,
      durationMs,
    };
  } catch (error) {
    progress("FAILED", 100);
    log("failed", { ...base, errorCode: error instanceof PresentationEngineError ? error.code : "UNEXPECTED", error: error instanceof Error ? error.message : String(error), durationMs: Date.now() - started });
    throw error;
  }
}

export { getLayout };
export type { TextDensity };

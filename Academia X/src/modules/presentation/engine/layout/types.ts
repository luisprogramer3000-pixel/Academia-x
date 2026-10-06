import type { ActivityKind, PedagogicalRole, ResolvedAsset, ResolvedDesignSystem, ResolvedImage, SlideContentBlock, SlidePlan } from "../types";
import type { Labels } from "../i18n";
import type { SlideBuilder } from "./components";
import { normalize } from "../text";

export interface LayoutContext {
  plan: SlidePlan;
  design: ResolvedDesignSystem;
  labels: Labels;
  /** Recursos resueltos, en el mismo orden que plan.visualAssetRequests */
  assets: ResolvedAsset[];
  academyName: string;
  lessonTitle: string;
  level?: string;
  index: number;
  total: number;
  /** Personaje del modelo para esta diapositiva (el motor decide cuándo aparece) */
  mascot?: ResolvedImage;
  /** Variante de composición (alternancia controlada) */
  variant: number;
  /** Nivel de reducción aplicado por la autocorrección (0 = contenido completo) */
  reduction: number;
}

export interface LayoutDef {
  id: string;
  /** Familia visual: dos layouts seguidos de la misma familia penalizan la variedad */
  family: string;
  roles: PedagogicalRole[];
  activities?: ActivityKind[];
  /** Cuánto depende de una imagen */
  image: "required" | "preferred" | "optional" | "none";
  /** Compatibilidad con el tamaño del contenido (0 = imposible, 1 = ideal) */
  fit: (plan: SlidePlan) => number;
  /** ¿Funciona bien para alumnos pequeños / adultos? (−1..1) */
  toneBias?: Partial<Record<"kids" | "adult", number>>;
  build: (ctx: LayoutContext, b: SlideBuilder) => void;
}

type Kind = SlideContentBlock["kind"];
export type BlockOf<K extends Kind> = Extract<SlideContentBlock, { kind: K }>;

export function blocksOf<K extends Kind>(plan: SlidePlan, kind: K): Array<BlockOf<K>> {
  return plan.contentBlocks.filter((b): b is BlockOf<K> => b.kind === kind);
}

export function firstOf<K extends Kind>(plan: SlidePlan, kind: K): BlockOf<K> | undefined {
  return blocksOf(plan, kind)[0];
}

export function items(plan: SlidePlan) {
  return blocksOf(plan, "item");
}

/** Viñetas visibles tras aplicar la reducción de la autocorrección. */
export function bulletsOf(ctx: LayoutContext, max = 4): string[] {
  const all = blocksOf(ctx.plan, "bullets").flatMap((b) => b.items);
  return all.slice(0, Math.max(1, max - ctx.reduction));
}

/** Recurso visual de un término (por consulta semántica) o el principal de la diapositiva. */
export function assetFor(ctx: LayoutContext, term?: string): ResolvedAsset | undefined {
  if (term) {
    const t = normalize(term);
    const hit = ctx.assets.find((a) => a.request.label && normalize(a.request.label) === t)
      ?? ctx.assets.find((a) => normalize(a.request.semanticQuery) === t)
      ?? ctx.assets.find((a) => t.includes(normalize(a.request.semanticQuery)));
    if (hit) return hit;
  }
  return ctx.assets.find((a) => a.kind !== "none");
}

export function mainImage(ctx: LayoutContext): ResolvedAsset | undefined {
  return ctx.assets.find((a) => a.kind === "image");
}

/** 1 si n está en [min, ideal], decrece fuera. */
export function countFit(n: number, min: number, max: number, ideal = max): number {
  if (n < min || n > max) return 0;
  return n <= ideal ? 0.7 + 0.3 * ((n - min + 1) / (ideal - min + 1)) : 0.85;
}

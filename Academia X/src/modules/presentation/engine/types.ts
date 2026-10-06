/**
 * Motor de presentaciones v2 — contratos entre capas.
 *
 *   LessonContent ─▶ PresentationPlan (planner) ─▶ ResolvedDesignSystem (design)
 *        ─▶ layout elegido por puntuación (layout) ─▶ SlideElement[] (validados)
 *        ─▶ PPTX (render)
 *
 * El planificador decide QUÉ se enseña en cada diapositiva (rol pedagógico,
 * idea principal, bloques de contenido, intención visual). Nunca da
 * coordenadas: la geometría es responsabilidad exclusiva de los layouts.
 */

export const PRESENTATION_ENGINE_VERSION = 2;

// ─── Contenido de la lección (extracción semántica) ──────────────────────────

export interface LessonConcept {
  /** ID semántico estable, p. ej. CONCEPT_AUTOBUS */
  id: string;
  term: string;
  definition: string;
  /** Detalles adicionales (frases), solo para notas del profesor o viñetas cortas */
  details: string[];
  example?: string;
  imageUrl?: string;
  emoji?: string;
}

export interface VocabularyItem {
  id: string;
  term: string;
  meaning?: string;
  emoji?: string;
  imageUrl?: string;
}

export interface LessonCategory {
  id: string;
  label: string;
  items: string[];
}

export interface LessonExample {
  id: string;
  text: string;
}

export interface LessonQuiz {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface LessonExercise {
  id: string;
  instruction: string;
  /** practica | produccion | reflexion | texto libre */
  kind: string;
  solution?: string;
}

export interface LessonDialogue {
  id: string;
  title?: string;
  lines: Array<{ speaker: string; text: string }>;
}

export interface LessonImageRef {
  url: string;
  caption: string;
  /** Concepto al que pertenece (imagen dentro de un bloque de concepto) */
  conceptId?: string;
}

export interface LessonReading {
  id: string;
  title: string;
  paragraphs: string[];
  /** Preguntas de comprensión de opción múltiple */
  questions: LessonQuiz[];
  /** Preguntas abiertas / tareas de lectura */
  tasks: string[];
  imageUrl?: string;
  /** true si se compuso con los ejemplos de la lección (no venía una lectura) */
  composed?: boolean;
}

export type EducationTone = "kids" | "school" | "teen" | "academic" | "corporate" | "professional" | "mixed";

export interface LessonContent {
  lessonId?: string;
  title: string;
  courseTitle?: string;
  academyName: string;
  language: string;
  level?: string;
  tone: EducationTone;
  objectives: string[];
  explanation: string[];
  concepts: LessonConcept[];
  vocabulary: VocabularyItem[];
  categories: LessonCategory[];
  /** true si las categorías son la clasificación real del tema (mapa de la lección o de la IA), no grupos deducidos */
  realClassification?: boolean;
  /** Centro del mapa mental, si la lección lo tiene */
  mindMapCenter?: string;
  examples: LessonExample[];
  quizzes: LessonQuiz[];
  exercises: LessonExercise[];
  dialogues: LessonDialogue[];
  /** Lecturas de comprensión (de la lección o compuestas con sus ejemplos) */
  readings: LessonReading[];
  grammar: Array<{ id: string; title: string; formula: string; examples: string[] }>;
  images: LessonImageRef[];
  homework?: string;
  teacherNotes: string[];
  durationMinutes?: number;
}

// ─── Plan pedagógico ─────────────────────────────────────────────────────────

export type PedagogicalRole =
  | "cover" | "hook" | "objectives" | "explanation" | "concept" | "vocabulary" | "grammar" | "example"
  | "comparison" | "process" | "mind_map" | "dialogue" | "practice" | "production" | "reflection"
  | "quiz" | "assessment" | "summary" | "exit_ticket" | "reading";

/** Bloques de contenido semánticos (sin geometría). */
export type SlideContentBlock =
  | { kind: "heading"; text: string }
  | { kind: "text"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "item"; term: string; detail?: string; emoji?: string; imageUrl?: string; refId?: string; translation?: string; imageQuery?: string }
  /** Tabla (conjugaciones, artículos, matriz de clasificación). **x** resalta (p. ej. la terminación) */
  | { kind: "table"; headers: string[]; rows: string[][] }
  /** Nota destacada: "Regla de oro", "Nota del profesor", "Cultura"… */
  | { kind: "note"; label?: string; text: string }
  | { kind: "example"; text: string }
  | { kind: "question"; text: string }
  | { kind: "options"; options: string[]; correctIndex?: number }
  | { kind: "pairs"; left: string[]; right: string[]; answers: number[]; leftEmoji?: string[] }
  | { kind: "columns"; columns: Array<{ heading: string; emoji?: string; items: string[] }> }
  | { kind: "steps"; steps: Array<{ heading: string; text?: string }> }
  | { kind: "tree"; center: string; branches: Array<{ label: string; emoji?: string; children: string[] }> }
  | { kind: "formula"; parts: string[]; examples: string[]; result?: string }
  | { kind: "dialogue"; lines: Array<{ speaker: string; text: string }> }
  | { kind: "blank"; sentence: string; answer?: string }
  | { kind: "statements"; items: Array<{ text: string; isTrue?: boolean }> }
  /** Texto de lectura (párrafos completos: es la única excepción a "nada de párrafos") */
  | { kind: "passage"; title?: string; paragraphs: string[] };

export type ActivityKind = "matching" | "multiple_choice" | "true_false" | "fill_blank" | "speaking" | "classify" | "ordering" | "guess";

export interface VisualAssetRequest {
  type: "photo" | "illustration" | "icon" | "diagram" | "shape" | "background";
  semanticQuery: string;
  purpose: "hero" | "concept" | "example" | "vocabulary" | "activity" | "decoration";
  style?: string;
  orientation?: "landscape" | "portrait" | "square";
  /** 0-1 */
  importance: number;
  /** Imagen ya existente en la lección que cumple la petición */
  preferredUrl?: string;
  /** Emoji de respaldo */
  emoji?: string;
  /** Término al que pertenece (para encontrar su imagen en una rejilla) */
  label?: string;
}

export interface SlidePlan {
  id: string;
  order: number;
  pedagogicalRole: PedagogicalRole;
  activity?: ActivityKind;
  title: string;
  mainIdea: string;
  contentBlocks: SlideContentBlock[];
  visualIntent: string;
  preferredLayouts: string[];
  visualAssetRequests: VisualAssetRequest[];
  speakerNotes: string[];
  /** IDs semánticos de la lección que cubre esta diapositiva */
  covers: string[];
  difficulty?: string;
  /** 1-5: cuánto pierde la clase si se elimina */
  importance: number;
}

export type DesignMode = "SMART_DESIGN" | "INSPIRED_BY_TEMPLATE" | "ADAPT_TEMPLATE" | "BASIC";

export interface PresentationPlan {
  id: string;
  title: string;
  language: string;
  cefrLevel?: string;
  tone: EducationTone;
  estimatedDuration?: number;
  learningObjectives: string[];
  /** IDs esenciales que deben aparecer en alguna diapositiva */
  essentialIds: string[];
  slides: SlidePlan[];
  metadata: {
    sourceLessonId?: string;
    templateId?: string;
    designMode: DesignMode;
    planner: "heuristic" | "llm";
    generatedAt: string;
  };
}

// ─── Diseño ──────────────────────────────────────────────────────────────────

export interface DnaImageAsset {
  /** Ruta dentro del .pptx (ppt/media/...) */
  path: string;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
  /** Caja de referencia normalizada (0-1) donde aparece en el modelo */
  box: NormBox;
  /** En cuántas diapositivas del modelo aparece */
  recurrence: number;
  /** Giro (grados) con el que el modelo coloca la imagen; `box` es la caja sin girar */
  rotation?: number;
}

export interface PresentationDesignDNA {
  id: string;
  fileHash: string;
  analyzerVersion: number;
  aspectRatio: "16:9" | "4:3" | "custom";
  slideWidthIn: number;
  slideHeightIn: number;
  palette: { primary: string[]; secondary: string[]; neutral: string[]; accent: string[]; background: string[]; text: string[] };
  typography: { headingFonts: string[]; bodyFonts: string[]; titleSizes: number[]; bodySizes: number[]; weights: number[] };
  shapes: { borderRadiusStyle: "square" | "soft" | "rounded" | "mixed"; cardFill?: string };
  imageStyle: { type: "photography" | "illustration" | "cartoon" | "editorial" | "mixed" };
  composition: {
    visualDensity: "low" | "medium" | "high";
    whitespace: "low" | "medium" | "high";
    titleAlign: "left" | "center";
    titlePosition: "top" | "middle";
    textImageRatio: number;
    avgObjectsPerSlide: number;
  };
  /** Fondo base que se repite en el modelo (textura, papel, mapa…) */
  backgroundImage?: DnaImageAsset;
  backgroundColor?: string;
  /** Personajes o ilustraciones de marca que se repiten (se reutilizan con moderación) */
  mascots: DnaImageAsset[];
  /** Adornos pequeños (esquinas, iconos de marca) */
  ornaments: DnaImageAsset[];
  /** Composición de la portada original (imágenes no textuales) y caja del título */
  cover?: { images: DnaImageAsset[]; titleBox?: NormBox; backgroundColor?: string };
  mood: string[];
  educationTone: EducationTone;
}

export interface ResolvedImage {
  data: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export interface ResolvedDesignSystem {
  id: string;
  name: string;
  mode: DesignMode;
  slide: { widthIn: number; heightIn: number };
  colors: {
    background: string; surface: string; surfaceAlt: string; primary: string; secondary: string; accent: string;
    text: string; mutedText: string; onPrimary: string; title: string;
    /** Paleta para tarjetas/opciones (fondo suave + color fuerte) */
    tones: Array<{ soft: string; strong: string }>;
  };
  fonts: { heading: string; body: string; emoji: string };
  sizes: { title: number; subtitle: number; body: number; small: number; hero: number };
  radius: { small: number; medium: number; large: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  /** Transparencia (0-100) de las superficies sobre fondos con imagen */
  surfaceTransparency: number;
  backgroundImage?: ResolvedImage;
  /** Colocación exacta del fondo cuando el modelo lo gira o lo desborda (Canva) */
  backgroundPlacement?: { box: NormBox; rotation: number };
  /** Formas decorativas (en coordenadas normalizadas) por tipo de diapositiva */
  decorations: { content: DecoShape[]; cover: DecoShape[] };
  coverBackground?: string;
  coverTitleColor?: string;
  coverImages: Array<{ image: ResolvedImage; box: NormBox }>;
  coverTitleBox?: NormBox;
  mascots: ResolvedImage[];
  /** 0-1: cuánto se apega a la composición del modelo (inspirado ≈ 0.75, adaptar ≈ 0.9) */
  fidelity: number;
  titleAlign: "left" | "center";
  visualStyle: string;
  tone: EducationTone;
}

export interface DecoShape {
  shape: "rect" | "ellipse" | "roundRect";
  box: NormBox;
  color: string;
  transparency?: number;
}

// ─── Geometría y elementos ───────────────────────────────────────────────────

/** Caja normalizada: 0-1 relativo al ancho/alto de la diapositiva. */
export interface NormBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BaseElement {
  box: NormBox;
  /** Los decorativos pueden salir del área segura y solaparse */
  decorative?: boolean;
  /** Elementos del mismo grupo pueden solaparse (texto dentro de su tarjeta) */
  group?: string;
}

export interface TextRun {
  text: string;
  bold?: boolean;
  color?: string;
  italic?: boolean;
  breakLine?: boolean;
}

export interface TextElement extends BaseElement {
  kind: "text";
  role: "title" | "subtitle" | "body" | "label" | "icon" | "caption";
  text: string;
  runs?: TextRun[];
  fontSize: number;
  font: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  bullets?: boolean;
  lineSpacing?: number;
  /** Color del fondo inmediato (para validar contraste) */
  backgroundColor?: string;
  /** true si el texto no cabía ni con el tamaño mínimo */
  overflow?: boolean;
}

export interface ShapeElement extends BaseElement {
  kind: "shape";
  shape: "rect" | "roundRect" | "ellipse" | "triangle" | "rightArrow" | "chevron";
  fill: string;
  transparency?: number;
  line?: { color: string; width: number; dash?: "dash" | "solid" };
  radius?: number;
  shadow?: boolean;
}

export interface ImageElement extends BaseElement {
  kind: "image";
  image: ResolvedImage;
  fit: "contain" | "cover";
  rounding?: boolean;
  /** Relevancia semántica de la imagen (0-1) */
  relevance: number;
  altText?: string;
}

export interface LineElement extends BaseElement {
  kind: "line";
  /** Punto inicial y final (normalizados) */
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  width: number;
  arrow?: boolean;
}

export type SlideElement = TextElement | ShapeElement | ImageElement | LineElement;

export interface ResolvedAsset {
  request: VisualAssetRequest;
  kind: "image" | "emoji" | "none";
  image?: ResolvedImage;
  emoji?: string;
  source: "lesson" | "generated" | "library" | "template" | "icon" | "none";
  relevance: number;
}

export interface ResolvedSlide {
  plan: SlidePlan;
  layoutId: string;
  design: ResolvedDesignSystem;
  assets: ResolvedAsset[];
  elements: SlideElement[];
  notes: string;
  quality?: SlideQualityMetrics & { score: number; issues: string[] };
  attempts: number;
}

// ─── Calidad ─────────────────────────────────────────────────────────────────

export interface SlideQualityMetrics {
  readability: number;
  contentFit: number;
  visualBalance: number;
  imageRelevance: number;
  contrast: number;
  layoutVariety: number;
  pedagogicalValue: number;
  overflowPenalty: number;
}

export interface PresentationQuality {
  contentCoverage: number;
  pedagogicalProgression: number;
  layoutDiversity: number;
  readability: number;
  visualConsistency: number;
  visualRelevance: number;
  technicalIntegrity: number;
  finalScore: number;
  missingIds: string[];
}

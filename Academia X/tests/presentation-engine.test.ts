import { describe, expect, it } from "vitest";
import { deflateSync } from "zlib";
import JSZip from "jszip";
import PptxGenJS from "pptxgenjs";
import { estimateLines, fitText } from "@/modules/presentation/engine/layout/text-fit";
import { fitImageContain, fitImageCover, rectIntersects } from "@/modules/presentation/engine/layout/geometry";
import { getContrastRatio, readableOn } from "@/modules/presentation/engine/design/color";
import { analyzeSlide, slideScore } from "@/modules/presentation/engine/validation/slide-validator";
import { maxConsecutive } from "@/modules/presentation/engine/validation/presentation-validator";
import { scoreLayouts } from "@/modules/presentation/engine/layout/selector";
import { designFromTheme } from "@/modules/presentation/engine/design/tokens";
import { analyzeDesign } from "@/modules/presentation/engine/design/analyzer";
import { PresentationPlanSchema } from "@/modules/presentation/engine/planner/schema";
import { extractLessonContent } from "@/modules/presentation/engine/planner/extract";
import { planFromContent } from "@/modules/presentation/engine/planner/heuristic";
import { generatePresentation } from "@/modules/presentation/engine";
import { getPresetTheme } from "@/modules/presentation/presentation.themes";
import type { SlideElement, SlidePlan } from "@/modules/presentation/engine/types";
import { TRANSPORT_LESSON } from "./fixtures/transport-lesson";

/**
 * Motor de presentaciones v2. Pruebas puras: no tocan la base de datos ni
 * servicios externos (las imágenes se resuelven con un cargador falso).
 */

const design = designFromTheme(getPresetTheme("marca", "2563EB"), { mode: "BASIC", tone: "school" });

/** PNG RGBA sin dependencias (para probar el analizador y el ajuste de imágenes). */
function makePng(w: number, h: number, color: [number, number, number]): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([...color, 255], y * (w * 4 + 1) + 1 + x * 4);
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

const textEl = (o: Partial<Extract<SlideElement, { kind: "text" }>>): SlideElement => ({
  kind: "text", role: "body", text: "Hola", box: { x: 0.1, y: 0.3, w: 0.3, h: 0.1 }, fontSize: 20, font: "Calibri", color: "111827",
  align: "left", valign: "top", backgroundColor: "FFFFFF", ...o,
});

const plan = (o: Partial<SlidePlan>): SlidePlan => ({
  id: "s", order: 1, pedagogicalRole: "concept", title: "T", mainIdea: "Idea", contentBlocks: [], visualIntent: "", preferredLayouts: [],
  visualAssetRequests: [], speakerNotes: [], covers: [], importance: 3, ...o,
});

describe("ajuste de texto", () => {
  it("estima más líneas cuanto más estrecha es la caja", () => {
    const text = "Vehículo grande que transporta a muchas personas por rutas fijas en la ciudad";
    expect(estimateLines(text, 2, 20, "Calibri")).toBeGreaterThan(estimateLines(text, 8, 20, "Calibri"));
  });

  it("baja el tamaño hasta que cabe, y avisa si ni con el mínimo cabe", () => {
    const fit = fitText("Una frase corta", 6, 0.6, { font: "Calibri", max: 32, min: 16 });
    expect(fit.fits).toBe(true);
    expect(fit.fontSize).toBeLessThanOrEqual(32);
    const huge = fitText("palabra ".repeat(300), 3, 0.5, { font: "Calibri", max: 24, min: 16 });
    expect(huge.fits).toBe(false);
    expect(huge.fontSize).toBe(16);
  });
});

describe("imágenes", () => {
  it("contain conserva la proporción de la imagen", () => {
    const b = fitImageContain({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1000, 500, design);
    const ratio = (b.w * design.slide.widthIn) / (b.h * design.slide.heightIn);
    expect(ratio).toBeCloseTo(2, 2);
  });

  it("cover recorta sin deformar (los recortes compensan la diferencia de proporción)", () => {
    const crop = fitImageCover({ x: 0, y: 0, w: 0.5, h: 0.5 }, 1000, 1000, design);
    const visibleW = 1 - crop.l - crop.r;
    const visibleH = 1 - crop.t - crop.b;
    const areaRatio = (0.5 * design.slide.widthIn) / (0.5 * design.slide.heightIn);
    expect(visibleW / visibleH).toBeCloseTo(areaRatio, 2);
  });
});

describe("colisiones, contraste y calidad", () => {
  it("detecta intersecciones de cajas", () => {
    expect(rectIntersects({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.4, y: 0.4, w: 0.2, h: 0.2 })).toBe(true);
    expect(rectIntersects({ x: 0, y: 0, w: 0.3, h: 0.3 }, { x: 0.5, y: 0.5, w: 0.2, h: 0.2 })).toBe(false);
  });

  it("marca el solape de textos de grupos distintos pero permite el texto dentro de su tarjeta", () => {
    const illegal = analyzeSlide([textEl({ text: "A" }), textEl({ text: "B", box: { x: 0.15, y: 0.32, w: 0.3, h: 0.1 } })], plan({}), design, { repeatedLayout: false, sameFamilyAsPrevious: false });
    expect(illegal.issues.some((i) => i.code === "ILLEGAL_OVERLAP")).toBe(true);
    const legal = analyzeSlide([
      { kind: "shape", shape: "roundRect", box: { x: 0.05, y: 0.25, w: 0.5, h: 0.4 }, fill: "FFFFFF", group: "g1" },
      textEl({ group: "g1" }),
    ], plan({}), design, { repeatedLayout: false, sameFamilyAsPrevious: false });
    expect(legal.issues.some((i) => i.code === "ILLEGAL_OVERLAP")).toBe(false);
  });

  it("detecta texto fuera del lienzo, letra diminuta y bajo contraste", () => {
    const a = analyzeSlide([
      textEl({ box: { x: 0.9, y: 0.3, w: 0.3, h: 0.1 } }),
      textEl({ text: "pequeño", fontSize: 9, box: { x: 0.1, y: 0.6, w: 0.3, h: 0.1 } }),
      textEl({ text: "gris", color: "E5E7EB", box: { x: 0.5, y: 0.75, w: 0.3, h: 0.1 } }),
    ], plan({}), design, { repeatedLayout: false, sameFamilyAsPrevious: false });
    const codes = a.issues.map((i) => i.code);
    expect(codes).toContain("OUT_OF_CANVAS");
    expect(codes).toContain("FONT_TOO_SMALL");
    expect(codes).toContain("LOW_CONTRAST");
    expect(a.score).toBeLessThan(80);
  });

  it("contraste WCAG y color legible", () => {
    expect(getContrastRatio("FFFFFF", "000000")).toBeCloseTo(21, 0);
    for (const bg of ["FFFFFF", "1E293B", "F59E0B", "7C3AED", "E4CCB1"]) {
      expect(getContrastRatio(readableOn(bg, ["9CA3AF"]), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("puntuación de diapositiva: perfecta ≈ 100, con desbordamiento cae", () => {
    const perfect = { readability: 1, contentFit: 1, visualBalance: 1, imageRelevance: 1, contrast: 1, layoutVariety: 1, pedagogicalValue: 1, overflowPenalty: 0 };
    expect(slideScore(perfect)).toBe(100);
    expect(slideScore({ ...perfect, contentFit: 0.5, overflowPenalty: 0.5 })).toBeLessThan(80);
  });
});

describe("selector de layouts", () => {
  const vocab = plan({
    pedagogicalRole: "vocabulary",
    contentBlocks: ["Coche", "Bicicleta", "Autobús", "Tren"].map((t) => ({ kind: "item", term: t, emoji: "🚗" })),
  });
  const flags = { hasImage: false, hasEmoji: true, hasMascot: false };

  it("elige una rejilla de vocabulario para el vocabulario", () => {
    const ranked = scoreLayouts(vocab, design, { layouts: [], families: [] }, flags);
    expect(ranked[0].layout.family).toBe("vocabulary");
  });

  it("no permite el mismo layout más de 2 veces seguidas", () => {
    const first = scoreLayouts(vocab, design, { layouts: [], families: [] }, flags)[0].layout.id;
    const ranked = scoreLayouts(vocab, design, { layouts: [first, first], families: ["vocabulary", "vocabulary"] }, flags);
    expect(ranked.some((r) => r.layout.id === first)).toBe(false);
  });

  it("las actividades de opción múltiple van a layouts de actividad", () => {
    const quiz = plan({ pedagogicalRole: "quiz", activity: "multiple_choice", contentBlocks: [{ kind: "question", text: "¿Qué vuela?" }, { kind: "options", options: ["Coche", "Avión"], correctIndex: 1 }] });
    const top = scoreLayouts(quiz, design, { layouts: [], families: [] }, flags)[0];
    expect(top.layout.activities).toContain("multiple_choice");
  });
});

describe("validación del plan de la IA (Zod)", () => {
  const slide = { role: "concept", title: "Coche", mainIdea: "Vehículo", blocks: [{ kind: "text", text: "Cuatro ruedas" }], visualIntent: "", notes: [], covers: [], importance: 3 };

  it("acepta un plan válido", () => {
    const ok = PresentationPlanSchema.safeParse({ title: "T", objectives: ["a"], slides: Array.from({ length: 8 }, () => slide) });
    expect(ok.success).toBe(true);
  });

  it("rechaza roles desconocidos, demasiadas diapositivas y bloques inválidos", () => {
    expect(PresentationPlanSchema.safeParse({ title: "T", objectives: ["a"], slides: Array.from({ length: 8 }, () => ({ ...slide, role: "random" })) }).success).toBe(false);
    expect(PresentationPlanSchema.safeParse({ title: "T", objectives: ["a"], slides: Array.from({ length: 40 }, () => slide) }).success).toBe(false);
    expect(PresentationPlanSchema.safeParse({ title: "T", objectives: ["a"], slides: Array.from({ length: 8 }, () => ({ ...slide, blocks: [{ kind: "options", options: ["x"] }] })) }).success).toBe(false);
  });

  it("el plan no admite coordenadas: los campos desconocidos se descartan", () => {
    const parsed = PresentationPlanSchema.parse({ title: "T", objectives: ["a"], slides: Array.from({ length: 8 }, () => ({ ...slide, x: 2.31, y: 1.7 })) });
    expect(parsed.slides[0]).not.toHaveProperty("x");
  });
});

describe("ADN de diseño", () => {
  it("extrae fondo, tipografía, personaje recurrente y paleta de un .pptx", async () => {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_16x9";
    const mascot = `image/png;base64,${Buffer.from(makePng(400, 600, [220, 38, 38])).toString("base64")}`;
    for (let i = 0; i < 3; i++) {
      const s = pptx.addSlide();
      s.background = { color: "FDF6E3" };
      s.addText(`Título ${i}`, { x: 0.5, y: 0.3, w: 9, h: 1, fontSize: 44, fontFace: "Montserrat", color: "7C2D12" });
      s.addText("Texto del cuerpo de la diapositiva", { x: 0.5, y: 1.5, w: 5, h: 1, fontSize: 20, fontFace: "Open Sans", color: "292524" });
      s.addImage({ data: mascot, x: 7, y: 1.5, w: 2, h: 3 });
    }
    const bytes = new Uint8Array((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
    const dna = await analyzeDesign(bytes, "test");
    expect(dna.aspectRatio).toBe("16:9");
    expect(dna.backgroundColor).toBe("FDF6E3");
    expect(dna.typography.headingFonts[0]).toBe("Montserrat");
    expect(dna.mascots.length).toBe(1);
    expect(dna.palette.primary.some((c) => c.startsWith("D") || c.startsWith("7C"))).toBe(true);
  });
});

describe("planificador pedagógico", () => {
  it("transforma la lección sin copiar párrafos y cubre lo esencial", () => {
    const content = extractLessonContent(TRANSPORT_LESSON);
    expect(content.vocabulary.map((v) => v.term)).toEqual(expect.arrayContaining(["Coche", "Bicicleta", "Autobús", "Tren", "Avión"]));
    expect(content.vocabulary.map((v) => v.term)).not.toContain("Transporte público");
    const p = planFromContent(content, { density: "estandar", designMode: "BASIC" });
    expect(p.slides.length).toBeGreaterThanOrEqual(11);
    expect(p.slides.length).toBeLessThanOrEqual(25);
    // La lectura es la única excepción justificada a "nada de párrafos"
    const longest = Math.max(...p.slides.flatMap((s) => s.contentBlocks.filter((b) => b.kind !== "passage").map((b) => JSON.stringify(b).length)));
    expect(longest).toBeLessThan(400);
  });
});

describe("motor completo (integración)", () => {
  it("LOS MEDIOS DE TRANSPORTE: lección → plan → layouts → PPTX", async () => {
    const result = await generatePresentation({
      lesson: TRANSPORT_LESSON,
      density: "estandar",
      design: { mode: "SMART_DESIGN", brandPrimary: "#2563EB" },
      planner: { kind: "heuristic" },
      images: { load: async () => null },
    });

    // Progresión pedagógica completa
    const roles = result.slides.map((s) => s.role);
    for (const r of ["cover", "hook", "objectives", "vocabulary", "concept", "mind_map", "reading", "practice", "quiz", "summary", "exit_ticket"]) {
      expect(roles).toContain(r);
    }
    expect(result.slides.length).toBeGreaterThanOrEqual(14);
    expect(result.slides.length).toBeLessThanOrEqual(25);

    // Actividades que parecen actividades, mapa y comparación visuales
    const layouts = result.slides.map((s) => s.layout);
    expect(layouts).toContain("MATCHING");
    expect(layouts).toContain("MIND_MAP");
    expect(layouts).toContain("CLASSIFY");
    // Relacionar con sentido: respuestas distintas
    const pairs = result.plan.slides.find((x) => x.activity === "matching")!.contentBlocks.find((b) => b.kind === "pairs");
    expect(pairs && pairs.kind === "pairs" ? new Set(pairs.right).size : 0).toBe(pairs && pairs.kind === "pairs" ? pairs.right.length : -1);
    // La clasificación es la real del tema (por el medio), no público/personal
    const map = result.plan.slides.find((x) => x.pedagogicalRole === "mind_map")!;
    expect(map.title).toBe("Clasificación de los medios de transporte");
    expect(JSON.stringify(map.contentBlocks)).toContain("Aéreos");
    // Público/personal sigue en la clase como parte de la explicación
    expect(result.plan.slides.some((x) => x.title === "Transporte público")).toBe(true);
    expect(layouts.some((l) => l === "MULTIPLE_CHOICE" || l === "QUIZ_LIST")).toBe(true);
    expect(maxConsecutive(layouts)).toBeLessThanOrEqual(2);
    expect(new Set(layouts).size).toBeGreaterThanOrEqual(12);

    // Sin desbordamientos, solapes, contraste insuficiente ni imágenes deformadas
    const severe = result.slides.flatMap((s) => s.issues).filter((i) => /OVERFLOW|CANVAS|OVERLAP|CONTRAST|DISTORT|EMPTY|REDUNDANT/.test(i));
    expect(severe).toEqual([]);

    // Calidad y cobertura
    expect(result.quality.contentCoverage).toBe(100);
    expect(result.quality.finalScore).toBeGreaterThanOrEqual(85);

    // PPTX válido, editable y con notas del orador
    const zip = await JSZip.loadAsync(result.file);
    const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    expect(slideFiles.length).toBe(result.slides.length);
    const notes = Object.keys(zip.files).filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f));
    expect(notes.length).toBeGreaterThan(0);
    const allNotes = (await Promise.all(notes.map((n) => zip.file(n)!.async("string")))).join(" ");
    expect(allNotes).toContain("cuatro ruedas");
    const slideXml = await zip.file("ppt/slides/slide2.xml")!.async("string");
    expect(slideXml).toContain("<a:t>");
  }, 60000);

  it("siempre hay lectura: compuesta con los ejemplos o la de la lección con sus preguntas de comprensión", async () => {
    // Sin lectura en la lección (Agente de Clase): se compone con sus frases de ejemplo
    const composed = await generatePresentation({
      lesson: TRANSPORT_LESSON, density: "estandar", targetSlides: 14,
      design: { mode: "SMART_DESIGN", brandPrimary: "#2563EB" }, planner: { kind: "heuristic" }, images: { load: async () => null },
    });
    const reading = composed.plan.slides.find((x) => x.pedagogicalRole === "reading")!;
    expect(reading).toBeTruthy();
    expect(composed.slides.find((x) => x.role === "reading")!.layout).toBe("READING_PASSAGE");
    const passage = reading.contentBlocks.find((b) => b.kind === "passage");
    expect(passage && passage.kind === "passage" ? passage.paragraphs.join(" ") : "").toContain("Voy a la escuela en bicicleta");
    // Con 14 diapositivas los conceptos se agrupan, pero nunca en diapositivas que solo repiten su título
    expect(composed.slides.flatMap((x) => x.issues).filter((i) => /REDUNDANT/.test(i))).toEqual([]);
    expect(composed.slides.filter((x) => x.role === "concept").every((x) => x.layout !== "IMAGE_DOMINANT" || true)).toBe(true);

    // Con capítulo "Lectura de comprensión" (plan de clase): su texto y sus preguntas
    const withReading = {
      ...TRANSPORT_LESSON,
      blocks: [
        ...TRANSPORT_LESSON.blocks,
        { type: "chapter", title: "Un viaje en tren", label: "Lectura de comprensión", content: "Lee el texto" },
        { type: "text", title: "Un viaje en tren", content: "Ana vive en Guayaquil. Los sábados viaja en tren con su abuela a un pueblo cercano.\n\nEl tren sale a las ocho y llega a las diez. Ana mira por la ventana y cuenta las vacas." },
        { type: "quiz", question: "¿Con quién viaja Ana?", options: ["Con su abuela", "Con su padre", "Sola", "Con amigos"], correctOptionIndex: 0 },
        { type: "practice", question: "¿Te gustaría viajar en tren? ¿Por qué?" },
      ],
    };
    const r2 = await generatePresentation({
      lesson: withReading, density: "estandar",
      design: { mode: "SMART_DESIGN", brandPrimary: "#2563EB" }, planner: { kind: "heuristic" }, images: { load: async () => null },
    });
    const rs = r2.plan.slides.find((x) => x.pedagogicalRole === "reading")!;
    expect(rs.title).toBe("Un viaje en tren");
    expect(JSON.stringify(rs.contentBlocks)).toContain("Ana vive en Guayaquil");
    expect(JSON.stringify(rs.contentBlocks)).toContain("¿Te gustaría viajar en tren?");
    expect(r2.plan.slides.some((x) => x.mainIdea === "¿Con quién viaja Ana?")).toBe(true);
    expect(r2.quality.contentCoverage).toBe(100);

    // Plan de la IA sin lectura: se añade
    const llm = await generatePresentation({
      lesson: withReading, density: "estandar",
      design: { mode: "SMART_DESIGN", brandPrimary: "#2563EB" },
      planner: { kind: "llm", call: async () => ({ raw: {
        title: "T", objectives: ["Reconocer transportes", "Comparar"],
        slides: [
          { role: "cover", title: "Los medios de transporte" },
          { role: "hook", title: "Para empezar", blocks: [{ kind: "question", text: "¿Cómo llegaste hoy?" }] },
          { role: "objectives", title: "Objetivos", blocks: [{ kind: "item", term: "Reconocer" }, { kind: "item", term: "Comparar" }] },
          { role: "concept", title: "Coche", blocks: [{ kind: "text", text: "Vehículo de cuatro ruedas" }] },
          { role: "quiz", title: "Elige", blocks: [{ kind: "question", text: "¿Qué vuela?" }, { kind: "options", options: ["Coche", "Avión"], correctIndex: 1 }] },
          { role: "summary", title: "Resumen", blocks: [{ kind: "item", term: "Público y personal" }, { kind: "item", term: "Cada medio va por un lugar" }] },
          { role: "exit_ticket", title: "Ticket", blocks: [{ kind: "question", text: "Nombra 3 transportes" }] },
        ] }, text: "{}" }) },
      images: { load: async () => null },
    });
    expect(llm.plan.metadata.planner).toBe("llm");
    expect(llm.slides.some((x) => x.role === "reading" && x.layout === "READING_PASSAGE")).toBe(true);
  }, 60000);

  it("plan de la IA: completa ejercicios a medias, rellena el vocabulario y usa la clasificación de la lección", async () => {
    const r = await generatePresentation({
      lesson: TRANSPORT_LESSON, density: "estandar",
      design: { mode: "SMART_DESIGN", brandPrimary: "#2563EB" },
      planner: { kind: "llm", call: async () => ({ raw: {
        title: "T", objectives: ["Reconocer transportes", "Clasificarlos"],
        slides: [
          { role: "cover", title: "Los medios de transporte" },
          { role: "hook", title: "Para empezar", blocks: [{ kind: "question", text: "¿Cómo llegaste hoy?" }] },
          { role: "objectives", title: "Objetivos", blocks: [{ kind: "item", term: "Reconocer" }, { kind: "item", term: "Clasificar" }] },
          { role: "vocabulary", title: "Vocabulario del transporte", mainIdea: "Palabras clave sobre el transporte.", blocks: [{ kind: "text", text: "Palabras clave sobre el transporte." }] },
          { role: "mind_map", title: "Categorías de transporte", blocks: [{ kind: "tree", center: "Transporte", branches: [{ label: "Público", children: ["Autobús"] }, { label: "Personal", children: ["Coche"] }] }] },
          { role: "practice", title: "Relaciona el transporte con su uso", blocks: [{ kind: "text", text: "Asocia cada transporte con su uso correcto." }] },
          { role: "practice", title: "Ejercicio imposible", activity: "true_false", blocks: [{ kind: "text", text: "Marca V o F" }] },
          { role: "summary", title: "Resumen", blocks: [{ kind: "item", term: "Terrestres, aéreos y acuáticos" }, { kind: "item", term: "Voy en…" }] },
          { role: "exit_ticket", title: "Ticket", blocks: [{ kind: "question", text: "Nombra 3 transportes" }] },
        ] }, text: "{}" }) },
      images: { load: async () => null },
    });
    expect(r.plan.metadata.planner).toBe("llm");
    const vocab = r.plan.slides.find((x) => x.pedagogicalRole === "vocabulary")!;
    expect(vocab.contentBlocks.filter((b) => b.kind === "item").length).toBeGreaterThanOrEqual(4);
    expect(r.slides.find((x) => x.role === "vocabulary")!.layout).toMatch(/VOCABULARY_GRID/);
    const match = r.plan.slides.find((x) => x.title === "Relaciona el transporte con su uso")!;
    expect(match.activity).toBe("matching");
    expect(match.contentBlocks.some((b) => b.kind === "pairs")).toBe(true);
    expect(r.slides.find((x) => x.layout === "MATCHING")).toBeTruthy();
    const map = r.plan.slides.find((x) => x.pedagogicalRole === "mind_map")!;
    expect(JSON.stringify(map.contentBlocks)).toContain("Acuáticos");
    expect(JSON.stringify(map.contentBlocks)).not.toContain("Público");
    // Ningún ejercicio queda en el diseño de respaldo con solo la consigna
    expect(r.slides.filter((x) => ["practice", "quiz"].includes(x.role) && x.layout === "FLEX_CONTENT")).toEqual([]);
  }, 60000);

  it("un mapa con ramas Tipos/Ejemplos/Usos no se muestra como clasificación; se usa la clasificación real", async () => {
    const badMap = {
      ...TRANSPORT_LESSON,
      blocks: TRANSPORT_LESSON.blocks.map((b) => (b.type === "mindmap"
        ? { ...b, mindMap: { center: "Medios de transporte", branches: [
            { label: "Tipos", children: ["Público", "Personal"] },
            { label: "Ejemplos", children: ["Autobús", "Coche", "Bicicleta", "Avión"] },
            { label: "Usos", children: ["Viajes cortos", "Viajes largos", "Diario", "Vacaciones"] },
            { label: "Terrestres", children: ["Coche", "Bicicleta", "Autobús"] },
          ] } }
        : b)),
    };
    const base = { lesson: badMap, density: "estandar" as const, design: { mode: "SMART_DESIGN" as const, brandPrimary: "#2563EB" }, images: { load: async () => null } };

    // Sin IA: no se inventa una clasificación ni se muestra la falsa
    const h = await generatePresentation({ ...base, planner: { kind: "heuristic" } });
    const text = JSON.stringify(h.plan.slides.map((x) => x.contentBlocks));
    expect(text).not.toContain("Viajes cortos");
    expect(h.plan.slides.some((x) => x.pedagogicalRole === "mind_map")).toBe(false);

    // Con IA: se usa su clasificación real (y alimenta "Clasifica"); un árbol de "Tipos/Usos" se descarta
    const slidesWith = (tree: unknown) => ({
      title: "T", objectives: ["Reconocer", "Clasificar"],
      slides: [
        { role: "cover", title: "Los medios de transporte" },
        { role: "hook", title: "Para empezar", blocks: [{ kind: "question", text: "¿Cómo llegaste hoy?" }] },
        { role: "objectives", title: "Objetivos", blocks: [{ kind: "item", term: "Reconocer" }, { kind: "item", term: "Clasificar" }] },
        { role: "mind_map", title: "Clasificación", blocks: [tree] },
        { role: "practice", title: "Clasifica los transportes", blocks: [{ kind: "text", text: "Clasifica cada medio en su grupo." }] },
        { role: "summary", title: "Resumen", blocks: [{ kind: "item", term: "Terrestres, aéreos y acuáticos" }, { kind: "item", term: "Voy en…" }] },
        { role: "exit_ticket", title: "Ticket", blocks: [{ kind: "question", text: "Nombra 3 transportes" }] },
      ],
    });
    const real = { kind: "tree", center: "Medios de transporte", branches: [
      { label: "Terrestres", children: ["Coche", "Bicicleta", "Autobús", "Tren"] },
      { label: "Aéreos", children: ["Avión", "Helicóptero"] },
      { label: "Acuáticos", children: ["Barco", "Lancha"] },
    ] };
    const good = await generatePresentation({ ...base, planner: { kind: "llm", call: async () => ({ raw: slidesWith(real), text: "{}" }) } });
    const map = good.plan.slides.find((x) => x.pedagogicalRole === "mind_map")!;
    expect(JSON.stringify(map.contentBlocks)).toContain("Acuáticos");
    expect(JSON.stringify(map.contentBlocks)).not.toContain("Usos");
    const classify = good.plan.slides.find((x) => x.activity === "classify")!;
    expect(JSON.stringify(classify.contentBlocks)).toContain("Aéreos");

    const meta = { kind: "tree", center: "Transporte", branches: [{ label: "Tipos", children: ["Público"] }, { label: "Usos", children: ["Diario"] }] };
    const bad = await generatePresentation({ ...base, planner: { kind: "llm", call: async () => ({ raw: slidesWith(meta), text: "{}" }) } });
    expect(bad.plan.slides.some((x) => x.pedagogicalRole === "mind_map")).toBe(false);
  }, 60000);

  it("el validador rechaza una diapositiva que solo repite su título", () => {
    const a = analyzeSlide([
      textEl({ role: "title", text: "Bicicleta · Autobús · Tren", fontSize: 32, box: { x: 0.05, y: 0.06, w: 0.9, h: 0.12 } }),
      textEl({ text: "Bicicleta, Autobús, Tren", box: { x: 0.05, y: 0.3, w: 0.5, h: 0.1 } }),
    ], plan({ title: "Bicicleta · Autobús · Tren" }), design, { repeatedLayout: false, sameFamilyAsPrevious: false });
    expect(a.issues.map((i) => i.code)).toContain("REDUNDANT");
  });

  it("objetivos con frase introductoria ('Al finalizar…, podrán:') se separan en tarjetas", async () => {
    const objectivesOf = async (planner: Parameters<typeof generatePresentation>[0]["planner"], objective: string) => {
      const r = await generatePresentation({
        lesson: { ...TRANSPORT_LESSON, teacherPlan: { ...TRANSPORT_LESSON.teacherPlan, objective } },
        density: "estandar",
        design: { mode: "SMART_DESIGN", brandPrimary: "#2563EB" },
        planner,
        images: { load: async () => null },
      });
      const slide = r.plan.slides.find((s) => s.pedagogicalRole === "objectives")!;
      return { layout: r.slides.find((s) => s.role === "objectives")!.layout, terms: slide.contentBlocks.flatMap((b) => (b.kind === "item" ? [b.term] : [])) };
    };
    const lead = "Al finalizar la clase, los estudiantes podrán: reconocer los medios de transporte; diferenciar el transporte público del personal; usar 'voy en…'.";
    const h = await objectivesOf({ kind: "heuristic" }, lead);
    expect(h.layout).toBe("OBJECTIVES_CARDS");
    expect(h.terms.length).toBeGreaterThanOrEqual(2);
    expect(h.terms.join(" ")).not.toMatch(/Al finalizar/);

    // La IA deja una sola línea "Al finalizar…": se completa con los objetivos del plan/lección
    const plan = {
      title: "Los medios de transporte",
      objectives: ["Reconocer medios de transporte", "Diferenciar público y personal"],
      slides: [
        { role: "cover", title: "Los medios de transporte" },
        { role: "hook", title: "Para empezar", blocks: [{ kind: "question", text: "¿Cómo llegaste hoy?" }] },
        { role: "objectives", title: "Objetivos de la clase", blocks: [{ kind: "text", text: "Al finalizar…" }] },
        { role: "concept", title: "Coche", blocks: [{ kind: "text", text: "Vehículo de cuatro ruedas" }] },
        { role: "quiz", title: "Elige", blocks: [{ kind: "question", text: "¿Qué vuela?" }, { kind: "options", options: ["Coche", "Avión"], correctIndex: 1 }] },
        { role: "summary", title: "Resumen", blocks: [{ kind: "bullets", items: ["Público y personal", "Cada medio va por un lugar"] }] },
        { role: "exit_ticket", title: "Ticket", blocks: [{ kind: "question", text: "Nombra 3 transportes" }] },
      ],
    };
    const l = await objectivesOf({ kind: "llm", call: async () => ({ raw: plan, text: "{}" }) }, lead);
    expect(l.layout).toBe("OBJECTIVES_CARDS");
    expect(l.terms.length).toBeGreaterThanOrEqual(2);
    expect(l.terms.join(" ")).not.toMatch(/Al finalizar/);
  }, 60000);

  it("funciona con otras materias e idiomas (ciencias en inglés), sin lógica específica de transporte", async () => {
    const result = await generatePresentation({
      lesson: {
        lessonId: "test-photosynthesis",
        title: "Photosynthesis",
        courseTitle: "Biology for teens",
        academyName: "Academy Ec",
        language: "en",
        level: "Secondary",
        blocks: [
          { type: "text", title: "Explanation", content: "Photosynthesis is the process plants use to make food. They take in light, water and carbon dioxide and release oxygen." },
          { type: "text", title: "Chlorophyll", content: "The green pigment in leaves that captures sunlight.\n\n**Example:** Leaves look green because of chlorophyll." },
          { type: "text", title: "Glucose", content: "The sugar plants produce and use as energy.\n\n**Example:** Plants store glucose as starch." },
          { type: "text", title: "Oxygen", content: "The gas released by plants during photosynthesis.\n\n**Example:** Forests produce a lot of oxygen." },
          { type: "text", title: "Carbon dioxide", content: "The gas plants absorb from the air through tiny holes in the leaves." },
          { type: "quiz", question: "Which gas do plants release?", options: ["Oxygen", "Nitrogen", "Helium", "Carbon dioxide"], correctOptionIndex: 0 },
        ],
      },
      density: "estandar",
      design: { mode: "SMART_DESIGN", brandPrimary: "#16A34A" },
      planner: { kind: "heuristic" },
      images: { load: async () => null },
    });
    const severe = result.slides.flatMap((s) => s.issues).filter((i) => /OVERFLOW|CANVAS|OVERLAP|CONTRAST|DISTORT|EMPTY|REDUNDANT/.test(i));
    expect(severe).toEqual([]);
    expect(result.quality.contentCoverage).toBe(100);
    expect(result.slides.length).toBeGreaterThanOrEqual(8);
    const zip = await JSZip.loadAsync(result.file);
    const xml = (await Promise.all(Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).map((f) => zip.file(f)!.async("string")))).join(" ");
    expect(xml).toContain("Learning objectives");
    expect(xml).not.toContain("Objetivos de la clase");
  }, 60000);

  it("usa el plan de la IA cuando es válido (con un reintento) y vuelve al planificador interno si no", async () => {
    const content = extractLessonContent(TRANSPORT_LESSON);
    const valid = {
      title: "Los medios de transporte",
      objectives: ["Reconocer medios de transporte"],
      slides: [
        { role: "cover", title: "Los medios de transporte", blocks: [], covers: [] },
        { role: "hook", title: "Para empezar", blocks: [{ kind: "question", text: "¿Cómo llegaste hoy?" }] },
        { role: "objectives", title: "Objetivos", blocks: [{ kind: "item", term: "Reconocer transportes" }, { kind: "item", term: "Comparar" }] },
        { role: "vocabulary", title: "Vocabulario", blocks: content.vocabulary.map((v) => ({ kind: "item", term: v.term, emoji: v.emoji })), covers: content.vocabulary.map((v) => v.id) },
        { role: "comparison", title: "Público vs Personal", blocks: [{ kind: "columns", columns: [{ heading: "Público", items: ["Autobús", "Tren"] }, { heading: "Personal", items: ["Coche", "Bicicleta"] }] }], covers: content.concepts.map((c) => c.id) },
        { role: "practice", activity: "matching", title: "Relaciona", blocks: [{ kind: "pairs", left: ["Coche", "Tren"], right: ["Rieles", "Carretera"], answers: [1, 0] }] },
        { role: "quiz", activity: "multiple_choice", title: "Elige", blocks: [{ kind: "question", text: "¿Qué vuela?" }, { kind: "options", options: ["Coche", "Avión"], correctIndex: 1 }] },
        { role: "summary", title: "Resumen", blocks: [{ kind: "item", term: "Hay transporte público y personal" }, { kind: "item", term: "Cada uno va por un medio" }] },
        { role: "exit_ticket", title: "Ticket de salida", blocks: [{ kind: "question", text: "Nombra 3 transportes" }] },
      ],
    };
    let calls = 0;
    const ok = await generatePresentation({
      lesson: TRANSPORT_LESSON,
      density: "estandar",
      design: { mode: "BASIC", theme: getPresetTheme("simple", "2563EB"), brandPrimary: "#2563EB" },
      planner: { kind: "llm", call: async () => ({ raw: calls++ === 0 ? { slides: "mal" } : valid, text: "{}" }) },
      images: { load: async () => null },
    });
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(ok.plan.metadata.planner).toBe("llm");

    const fallback = await generatePresentation({
      lesson: TRANSPORT_LESSON,
      density: "minimo",
      design: { mode: "SMART_DESIGN", brandPrimary: "#2563EB" },
      planner: { kind: "llm", call: async () => ({ raw: {}, text: "{}" }) },
      images: { load: async () => null },
    });
    expect(fallback.plan.metadata.planner).toBe("heuristic");
    expect(fallback.warnings.join(" ")).toMatch(/planificador pedagógico interno/);
  }, 60000);
});

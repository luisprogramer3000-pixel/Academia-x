import { describe, expect, it } from "vitest";
import { extractLessonContent, type ExtractInput } from "@/modules/presentation/engine/planner/extract";
import { generatePresentation } from "@/modules/presentation/engine";
import { normalize } from "@/modules/presentation/engine/text";
import lesson from "./fixtures/city-places-lesson.json";

/**
 * Caso real: "Lugares de la Ciudad". El reto práctico (escenario, imagen,
 * diálogo, misión, pistas y 2 preguntas) salía en el PowerPoint como una
 * pregunta suelta: "¿Dónde crees que está escondido el objeto?".
 */
const INPUT: ExtractInput = {
  lessonId: "test-city",
  title: lesson.title,
  courseTitle: "Español A1",
  academyName: "JL Global School",
  language: "es",
  level: "A1",
  blocks: lesson.blocks as ExtractInput["blocks"],
  teacherPlan: null,
};

const HIDDEN = "¿Dónde crees que está escondido el objeto?";

describe("reto práctico en la presentación", () => {
  it("el reto se extrae como una unidad completa", () => {
    const c = extractLessonContent(INPUT);
    expect(c.challenges).toHaveLength(1);
    const ch = c.challenges![0];
    expect(ch.scenario.join(" ")).toContain("objeto valioso");
    expect(ch.mission).toContain("pistas");
    expect(ch.clues).toEqual(["El lugar está lleno de libros.", "Está cerca de una fuente y rodeado de árboles."]);
    expect(ch.imageUrl).toMatch(/class-images/);
    expect(ch.questions.map((q) => q.question)).toContain(HIDDEN);
    // Ni sus textos son conceptos ni sus preguntas van sueltas al quiz
    expect(c.concepts.map((x) => x.term)).not.toContain("El escenario");
    expect(c.concepts.map((x) => x.term)).not.toContain("Pistas");
    expect(c.quizzes.map((q) => q.question)).not.toContain(HIDDEN);
  });

  it("se proyecta completo en una diapositiva: escenario, misión, pistas, imagen y opciones", async () => {
    const result = await generatePresentation({
      lesson: INPUT,
      density: "estandar",
      design: { mode: "SMART_DESIGN", brandPrimary: "#2563EB" },
      planner: { kind: "heuristic" },
      images: { load: async () => null },
    });
    const i = result.plan.slides.findIndex((s) => s.preferredLayouts.includes("CHALLENGE_SCENE"));
    expect(i).toBeGreaterThan(-1);
    expect(result.slides[i].layout).toBe("CHALLENGE_SCENE");
    const s = result.plan.slides[i];
    const kinds = s.contentBlocks.map((b) => b.kind);
    expect(kinds).toEqual(["passage", "bullets", "question", "options"]);
    expect(s.visualAssetRequests[0].preferredUrl).toMatch(/class-images/);
    // Va justo después de la portada y es la única activación
    expect(result.plan.slides[i - 1].pedagogicalRole).toBe("cover");
    expect(result.plan.slides.filter((x) => x.pedagogicalRole === "hook")).toHaveLength(1);
    // Ninguna otra diapositiva repite una pregunta del reto sin su escenario
    const loose = result.plan.slides.filter((x, j) => j !== i && x.contentBlocks.some((b) => b.kind === "question" && normalize(b.text) === normalize(HIDDEN)));
    expect(loose).toEqual([]);
  });

  it("si el reto no cabe entero, no se proyecta y la clase sigue con conceptos y vocabulario", async () => {
    const long = {
      ...INPUT,
      blocks: INPUT.blocks.map((b) => ((b as { id?: string }).id === "m1_s0" ? { ...b, content: `${b.content} ${"La ciudad tiene muchas calles, plazas y edificios antiguos. ".repeat(12)}` } : b)),
    };
    const result = await generatePresentation({
      lesson: long,
      density: "estandar",
      design: { mode: "SMART_DESIGN", brandPrimary: "#2563EB" },
      planner: { kind: "heuristic" },
      images: { load: async () => null },
    });
    expect(result.slides.map((s) => s.layout)).not.toContain("CHALLENGE_SCENE");
    const questions = result.plan.slides.flatMap((x) => x.contentBlocks).filter((b) => b.kind === "question").map((b) => (b.kind === "question" ? normalize(b.text) : ""));
    expect(questions).not.toContain(normalize(HIDDEN));
    const roles = result.plan.slides.map((x) => x.pedagogicalRole);
    expect(roles).toContain("vocabulary");
    expect(roles).toContain("concept");
  });
});

import { describe, expect, it, vi } from "vitest";

// class-plan.schema carga documentos .md (solo los entiende Next): no hacen falta aquí
vi.mock("@/modules/ai/class-structure", () => ({ classStructureFor: () => "", methodologyStructureFor: () => "" }));
import { deepenTheoryIfThin, depthTarget, levelBand, measureTheory } from "@/modules/ai/class-depth";
import type { ClassPlanOutput, ClassPlanParams } from "@/modules/ai/class-plan.schema";

const params = (grade: string): ClassPlanParams =>
  ({ topic: "El subjuntivo en oraciones concesivas", grade, subject: "Preparación DELE B2", language: "español", duration: 60 }) as unknown as ClassPlanParams;

const sentence = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");

function planWithTheory(sections: number, wordsEach: number): ClassPlanOutput {
  return {
    materials: [
      {
        id: "m2",
        kind: "resumen",
        title: "Teoría",
        description: "",
        sections: Array.from({ length: sections }, (_, i) => ({ heading: `Concepto ${i + 1}`, body: sentence(wordsEach), bullets: [] })),
        questions: [],
      },
    ],
  } as unknown as ClassPlanOutput;
}

describe("profundidad por nivel", () => {
  it("clasifica los niveles", () => {
    expect(levelBand("Nivel B2")).toBe("advanced");
    expect(levelBand("C1")).toBe("advanced");
    expect(levelBand("Nivel B1")).toBe("intermediate");
    expect(levelBand("Nivel A1")).toBe("basic");
    expect(levelBand("")).toBe("basic");
  });

  it("un B2 exige más teoría y ejercicios que un A1", () => {
    const b2 = depthTarget("Nivel B2");
    const a1 = depthTarget("Nivel A1");
    expect(b2.theorySections).toBeGreaterThan(a1.theorySections);
    expect(b2.wordsPerSection).toBeGreaterThan(a1.wordsPerSection);
    expect(b2.exercises).toBeGreaterThan(a1.exercises);
  });

  it("no cuenta la sección Resumen como concepto", () => {
    const plan = planWithTheory(3, 100);
    plan.materials[0].sections.push({ heading: "Resumen", body: sentence(10), bullets: [] });
    expect(measureTheory(plan.materials[0])).toEqual({ sections: 3, avgWords: 100 });
  });

  it("reescribe la teoría corta de un B2 con el marco investigado", async () => {
    const plan = planWithTheory(3, 40);
    let system = "";
    const ok = await deepenTheoryIfThin(plan, { ...params("Nivel B2"), research: "MARCO: Instituto Cervantes, prueba de expresión escrita" }, async (s) => {
      system = s;
      return {
        title: "Teoría a fondo",
        description: "",
        sections: Array.from({ length: 8 }, (_, i) => ({ heading: `Concepto ${i + 1}`, body: sentence(160), bullets: [] })),
        questions: [],
      };
    });
    expect(ok).toBe(true);
    expect(system).toContain("Instituto Cervantes");
    expect(measureTheory(plan.materials[0]).sections).toBeGreaterThanOrEqual(7);
    expect(plan.materials[0].id).toBe("m2");
  });

  it("no toca una teoría que ya tiene la profundidad del nivel", async () => {
    const plan = planWithTheory(7, 160);
    let called = false;
    const ok = await deepenTheoryIfThin(plan, params("Nivel B2"), async () => {
      called = true;
      return null;
    });
    expect(ok).toBe(false);
    expect(called).toBe(false);
  });

  it("si la reescritura sale peor, conserva la original", async () => {
    const plan = planWithTheory(4, 90);
    const ok = await deepenTheoryIfThin(plan, params("Nivel B2"), async () => ({
      title: "x",
      description: "",
      sections: [{ heading: "Uno", body: sentence(20), bullets: [] }],
      questions: [],
    }));
    expect(ok).toBe(false);
    expect(measureTheory(plan.materials[0])).toEqual({ sections: 4, avgWords: 90 });
  });
});

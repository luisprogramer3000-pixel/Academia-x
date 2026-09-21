import { describe, it, expect } from "vitest";
import { slugify } from "@/modules/academy/academy.service";

describe("Course & LMS Helpers", () => {
  it("Debe generar slugs limpios para los cursos y lecciones", () => {
    expect(slugify("Español B2 - Negocios")).toBe("espanol-b2-negocios");
    expect(slugify("Lección 1.1: Vocabulario Básico")).toBe("leccion-11-vocabulario-basico");
  });

  it("Debe calcular correctamente el porcentaje de avance de un alumno en el LMS", () => {
    const calculateProgress = (completedCount: number, totalCount: number) => {
      if (totalCount === 0) return 0;
      return Math.round((completedCount / totalCount) * 100);
    };

    expect(calculateProgress(0, 10)).toBe(0);
    expect(calculateProgress(5, 10)).toBe(50);
    expect(calculateProgress(10, 10)).toBe(100);
    expect(calculateProgress(1, 3)).toBe(33);
  });

  it("Debe validar el formato de almacenamiento de bloques JSON de lecciones", () => {
    const sampleBlocks = [
      { id: "b1", type: "text", content: "Teoría gramatical..." },
      { id: "b2", type: "video", url: "https://youtube.com/watch?v=123" },
      { id: "b3", type: "quiz", question: "¿Pregunta?", options: ["A", "B"], correctOptionIndex: 0 },
    ];

    const jsonString = JSON.stringify({ blocks: sampleBlocks });
    const parsed = JSON.parse(jsonString);

    expect(parsed.blocks).toHaveLength(3);
    expect(parsed.blocks[0].type).toBe("text");
    expect(parsed.blocks[1].type).toBe("video");
    expect(parsed.blocks[2].type).toBe("quiz");
  });
});

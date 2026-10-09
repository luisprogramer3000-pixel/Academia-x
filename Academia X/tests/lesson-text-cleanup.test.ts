import { describe, expect, it } from "vitest";
import { cleanTitle, stripStrayImageUrls } from "@/components/lesson/lesson-blocks";

describe("limpieza del texto de la lección", () => {
  it("quita la dirección de una imagen soltada dentro de una palabra", () => {
    const t = "En el tronco, destacan el pecho, la espalda y el abdomhttp://localhost:3000/api/uploads/class-images/lib-cmuy9beyg0002bg7k5tb1zsuy-1065ed3c2b845ce7.pngen. Las extremidades";
    expect(stripStrayImageUrls(t)).toBe("En el tronco, destacan el pecho, la espalda y el abdomen. Las extremidades");
  });
  it("no toca otros enlaces", () => {
    expect(stripStrayImageUrls("Mira https://cervantes.es/dele.html")).toBe("Mira https://cervantes.es/dele.html");
  });
  it("títulos sin marcas de Markdown", () => {
    expect(cleanTitle("### Partes del Cuerpo")).toBe("Partes del Cuerpo");
    expect(cleanTitle("**Resumen**")).toBe("Resumen");
  });
});

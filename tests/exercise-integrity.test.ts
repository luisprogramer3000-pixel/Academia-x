import { describe, it, expect } from "vitest";
import { enforceSelfContained, missingMaterial, type ExerciseRef } from "@/modules/ai/exercise-integrity";

/**
 * Regla de calidad de la plataforma: ningún ejercicio generado por IA puede
 * llegar al alumno pidiendo un material que no incluye ("Lee el siguiente
 * párrafo…" sin párrafo, "Observa la imagen…" sin imagen).
 */
describe("Ejercicios autosuficientes", () => {
  const broken: Array<[string, boolean]> = [
    ["Lee el siguiente párrafo y escribe la idea principal.", true],
    ["Escribe la idea principal del texto sobre el cambio climático.", true],
    ["Selecciona la idea principal del párrafo sobre alimentación saludable.", true],
    ["Subraya la idea principal del párrafo.", true],
    ["Completa las siguientes oraciones con el verbo correcto.", true],
    ["Observa la imagen y describe lo que hace la familia.", true],
    ["Escucha el audio y responde las preguntas.", true],
    ["¿Cuál es la idea principal del artículo?", false],
    ["Read the following text and answer the questions.", true],
  ];
  it.each(broken)("detecta como incompleto: %s", (text, reading) => {
    expect(missingMaterial(text, { readingAvailable: reading })).not.toBeNull();
  });

  const fine: Array<[string, boolean]> = [
    ["Lee el siguiente párrafo y escribe la idea principal: «María se levanta temprano todos los días porque trabaja en un hospital lejos de su casa.»", false],
    ["Escribe la idea principal del siguiente texto: La alimentación saludable incluye frutas, verduras y agua. Comer bien ayuda a tener energía.", false],
    ["¿Cuál es la idea principal del artículo?", true],
    ["Escribe un párrafo sobre tu rutina diaria usando tres verbos reflexivos.", false],
    ["Completa: Yo ___ (ir) al colegio en autobús.", false],
    ["En un texto narrativo, ¿cómo suele presentarse la idea principal?", false],
  ];
  it.each(fine)("acepta como completo: %s", (text, reading) => {
    expect(missingMaterial(text, { readingAvailable: reading })).toBeNull();
  });

  function exercises(texts: string[]) {
    const list = texts.map((text) => ({ text }));
    const refs: ExerciseRef[] = list.map((item) => ({
      text: item.text,
      set: (t) => { item.text = t; },
      remove: () => { list.splice(list.indexOf(item), 1); },
    }));
    return { list, refs };
  }

  it("repara con la IA el ejercicio incompleto y deja intactos los demás", async () => {
    const { list, refs } = exercises(["Completa: Yo ___ (ir) al colegio.", "Lee el siguiente párrafo y escribe la idea principal."]);
    const ask = async () => ({ items: [{ id: 1, text: "Lee el siguiente párrafo y escribe la idea principal: «Los medios de transporte han cambiado mucho. Hoy hay bicicletas eléctricas, autobuses híbridos y trenes muy rápidos que cuidan el ambiente.»", answer: "Los transportes son más modernos y ecológicos." }] });
    const res = await enforceSelfContained(refs, ask, { topic: "Ideas principales" });
    expect(res).toMatchObject({ repaired: 1, removed: 0 });
    expect(list).toHaveLength(2);
    expect(missingMaterial(list[1].text)).toBeNull();
  });

  it("si la IA no lo arregla, el ejercicio roto se elimina (nunca llega al alumno)", async () => {
    const { list, refs } = exercises(["Observa la imagen y describe lo que ves.", "Completa: Ella ___ (ser) profesora."]);
    const ask = async () => { throw new Error("proveedor caído"); };
    const res = await enforceSelfContained(refs, ask, { topic: "Descripciones" });
    expect(res).toMatchObject({ repaired: 0, removed: 1 });
    expect(list.map((x) => x.text)).toEqual(["Completa: Ella ___ (ser) profesora."]);
  });

  it("una reparación que sigue incompleta también se elimina", async () => {
    const { list, refs } = exercises(["Lee el siguiente texto y resume la idea principal."]);
    const ask = async () => ({ items: [{ id: 0, text: "Lee el siguiente texto con atención y resume la idea principal." }] });
    await enforceSelfContained(refs, ask, { topic: "Resumen" });
    expect(list).toHaveLength(0);
  });
});

import { describe, expect, it } from "vitest";
import { planAssets } from "@/modules/presentation/engine/assets/planner";
import { emojiFor } from "@/modules/presentation/engine/icons";
import type { PresentationPlan, SlidePlan, VisualAssetRequest } from "@/modules/presentation/engine/types";

const req = (q: string, purpose: VisualAssetRequest["purpose"], extra: Partial<VisualAssetRequest> = {}) =>
  ({ type: "illustration", semanticQuery: q, purpose, importance: purpose === "hero" ? 1 : 0.6, orientation: "square", ...extra }) as VisualAssetRequest;

const slide = (role: string, requests: VisualAssetRequest[]) => ({ id: role, pedagogicalRole: role, visualAssetRequests: requests }) as unknown as SlidePlan;

const VOCAB = ["Biblioteca", "Café", "Cine", "Parque", "Explorar"];

function deck(): PresentationPlan {
  return {
    slides: [
      slide("cover", [req("ciudad moderna", "hero")]),
      slide("vocabulary", VOCAB.map((t) => req(t, "vocabulary"))),
      slide("example", [req("dos amigos en el cine", "example", { importance: 0.9 })]),
    ],
  } as unknown as PresentationPlan;
}

describe("tarjetas de vocabulario", () => {
  it("cada lugar tiene su propio icono (no el mismo 📍 para todos)", () => {
    const icons = VOCAB.map((t) => emojiFor(t));
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(VOCAB.length);
  });

  it("con imágenes suficientes, todas las tarjetas del vocabulario reciben foto", () => {
    const plan = planAssets(deck(), 6);
    const vocab = plan.toGenerate.filter((r) => r.purpose === "vocabulary").map((r) => r.semanticQuery);
    expect(vocab).toEqual(VOCAB);
    expect(plan.toGenerate[0].purpose).toBe("hero");
  });

  it("si no alcanzan para todas, no se gastan a medias en el vocabulario", () => {
    const plan = planAssets(deck(), 4);
    expect(plan.toGenerate.some((r) => r.purpose === "vocabulary")).toBe(false);
    expect(plan.toGenerate.map((r) => r.purpose)).toEqual(["hero", "example"]);
  });

  it("la básica con fotos de vocabulario solo genera las tarjetas (ni portada ni ejemplos)", () => {
    const plan = planAssets(deck(), 12, ["vocabulary"]);
    expect(plan.toGenerate.map((r) => r.semanticQuery)).toEqual(VOCAB);
  });

  it("las tarjetas que ya tienen foto de la lección no se vuelven a generar", () => {
    const d = deck();
    d.slides[1].visualAssetRequests[3] = req("Parque", "vocabulary", { preferredUrl: "https://x/parque.webp" });
    const plan = planAssets(d, 5);
    expect(plan.toGenerate.filter((r) => r.purpose === "vocabulary").map((r) => r.semanticQuery)).toEqual(["Biblioteca", "Café", "Cine", "Explorar"]);
  });
});

import { describe, it, expect } from "vitest";
import { slugify } from "@/modules/academy/academy.service";

describe("AcademyService Helper Utilities & Branding", () => {
  it("Debe convertir nombres de academias en URL slugs amigables", () => {
    expect(slugify("JL Global Institute")).toBe("jl-global-institute");
    expect(slugify("Academia de Español & ELE!")).toBe("academia-de-espanol-ele");
    expect(slugify("  Escuela   de  Inglés   ")).toBe("escuela-de-ingles");
    expect(slugify("École de Français Paris")).toBe("ecole-de-francais-paris");
  });

  it("Debe validar colores hexadecimales válidos para el branding de marca", () => {
    const validColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    expect(validColorRegex.test("#3B82F6")).toBe(true);
    expect(validColorRegex.test("#1E293B")).toBe(true);
    expect(validColorRegex.test("invalid-color")).toBe(false);
  });
});

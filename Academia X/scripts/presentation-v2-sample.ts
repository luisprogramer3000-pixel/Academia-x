/**
 * Genera la presentación de prueba "Los medios de transporte" con el motor v2
 * (planificador interno, sin IA ni créditos) y muestra el informe de calidad.
 *
 *   npx tsx scripts/presentation-v2-sample.ts <carpeta-salida> [diseño...]
 *
 * Diseños: "smart", "preset:<id>" (marca, cuaderno, confeti…) o
 * "model:<archivo>" (un .pptx de public/modelos powerpoint) o "adapt:<archivo>".
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { generatePresentation } from "../src/modules/presentation/engine";
import { lessonImageFromBytes } from "../src/modules/presentation/presentation.images";
import { getPresetTheme } from "../src/modules/presentation/presentation.themes";
import { TRANSPORT_LESSON } from "../tests/fixtures/transport-lesson";
import type { ExtractInput } from "../src/modules/presentation/engine/planner/extract";

/** Lección corta "Las frutas y los colores" (como la unidad del profesor), para probar la calidad con IA */
const FRUITS_LESSON: ExtractInput = {
  lessonId: "test-frutas",
  title: "Las frutas y los colores",
  courseTitle: "Español A1 para adolescentes",
  academyName: "Academy Ec",
  language: "es",
  level: "A1",
  blocks: [
    { type: "text", title: "Explicación", content: "En esta unidad aprendemos los nombres de las frutas y los colores en español. Los colores son adjetivos: concuerdan en género y número con la fruta. Usamos gustar y preferir para expresar gustos y querer para comprar en el mercado." },
    { type: "text", title: "Concordancia de género", content: "Si el color termina en -o, cambia a -a con frutas femeninas: la manzana roja, el plátano amarillo. Los colores en -e o consonante no cambian: la pera verde, la uva azul." },
    { type: "text", title: "El verbo gustar", content: "Me gusta + singular (la piña); me gustan + plural (las uvas). El verbo cambia según la fruta, no según la persona." },
    { type: "text", title: "Preferir (e → ie)", content: "Yo prefiero, tú prefieres, él prefiere, nosotros preferimos, ellos prefieren." },
  ],
  teacherPlan: { objective: "Describir frutas con colores; expresar gustos con gustar y preferir; comprar en el mercado con querer" },
};

// tsx no carga .env.local: lo necesitamos para el planificador con IA (--llm)
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const out_dir = () => process.argv[2] ?? ".";

async function main() {
  const out = out_dir();
  const args = process.argv.slice(3);
  const llm = args.includes("--llm");
  const designs = args.filter((a) => a !== "--llm").length ? args.filter((a) => a !== "--llm") : ["smart"];
  // Misma llamada que OpenAIAdapter.generatePresentationPlan (el adaptador importa .md que solo entiende Next)
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 150000 });
  const model = process.env.AI_MODEL_PREMIUM || process.env.OPENAI_MODEL || "gpt-4o-mini";
  let dumpN = 0;
  const generatePlan = async (c: { system: string; user: string; history?: Array<{ role: "assistant" | "user"; content: string }> }) => {
    const r = await client.chat.completions.create({
      model,
      messages: [{ role: "system", content: c.system }, { role: "user", content: c.user }, ...(c.history ?? [])],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    const text = r.choices[0]?.message?.content ?? "{}";
    console.log(`  IA (${model}): ${r.usage?.prompt_tokens}+${r.usage?.completion_tokens} tokens`);
    if (process.env.DUMP_PLAN) require("fs").writeFileSync(`${process.env.DUMP_PLAN}.${++dumpN}.json`, text);
    return { raw: JSON.parse(text), text };
  };
  mkdirSync(out, { recursive: true });
  const testImage = process.env.TEST_IMAGE;

  for (const spec of designs) {
    const [kind, value] = spec.split(":");
    const design =
      kind === "model" || kind === "adapt"
        ? { mode: kind === "adapt" ? ("ADAPT_TEMPLATE" as const) : ("INSPIRED_BY_TEMPLATE" as const), template: { id: value, bytes: new Uint8Array(readFileSync(path.join("public", "modelos powerpoint", value))) }, brandPrimary: "#2563EB" }
        : kind === "preset"
          ? { mode: "BASIC" as const, theme: getPresetTheme(value, "2563EB"), brandPrimary: "#2563EB" }
          : { mode: "SMART_DESIGN" as const, brandPrimary: "#2563EB" };

    const result = await generatePresentation({
      // BADMAP=1: el mapa de la lección mezcla "Tipos / Ejemplos / Usos" (no es una clasificación)
      lesson: process.env.LESSON === "frutas" ? FRUITS_LESSON : process.env.BADMAP
        ? { ...TRANSPORT_LESSON, blocks: TRANSPORT_LESSON.blocks.map((b) => (b.type === "mindmap" ? { ...b, mindMap: { center: "Medios de transporte", branches: [{ label: "Tipos", children: ["Público", "Personal"] }, { label: "Usos", children: ["Viajes cortos", "Diario"] }, { label: "Terrestres", children: ["Coche", "Autobús"] }] } } : b)) }
        : TRANSPORT_LESSON,
      density: "estandar",
      targetSlides: process.env.TARGET ? Number(process.env.TARGET) : undefined,
      design,
      planner: llm
        ? { kind: "llm", call: generatePlan }
        : { kind: "heuristic" },
      images: {
        load: async (url) => {
          if (url.startsWith("file://")) return lessonImageFromBytes(new Uint8Array(readFileSync(url.slice(7))));
          return testImage && existsSync(testImage) && url.includes("bicicleta") ? lessonImageFromBytes(new Uint8Array(readFileSync(testImage))) : null;
        },
        // IMAGES=n: fotos reales con fal.ai (sin créditos de la academia), 4 en paralelo
        generate: process.env.IMAGES
          ? async (reqs) => {
              const { generateClassImage } = await import("../src/modules/ai/image.adapter");
              const out = new Map<string, string>();
              const dir = path.join(out_dir(), "gen");
              mkdirSync(dir, { recursive: true });
              for (let i = 0; i < reqs.length; i += 4) {
                await Promise.all(reqs.slice(i, i + 4).map(async (r, j) => {
                  try {
                    const img = await generateClassImage({ prompt: r.prompt });
                    const f = path.join(dir, `img${i + j}.jpg`);
                    writeFileSync(f, img.buffer);
                    out.set(r.key, `file://${f}`);
                  } catch (e) { console.warn("imagen", r.key, e instanceof Error ? e.message : e); }
                }));
              }
              console.log(`  Fotos generadas: ${out.size}/${reqs.length}`);
              return out;
            }
          : undefined,
      },
      imageBudget: process.env.IMAGES ? Number(process.env.IMAGES) : 0,
    });
    const name = `${spec.replace(/[^a-z0-9]+/gi, "_")}${llm ? "_llm" : ""}`;
    const file = path.join(out, `transporte_${name}.pptx`);
    writeFileSync(file, result.file);
    console.log(`\n=== ${spec} → ${file} (${(result.file.length / 1024).toFixed(0)} KB, ${result.durationMs} ms)`);
    console.log(`Diseño: ${result.design.name} · planificador ${result.plan.metadata.planner} · calidad ${result.quality.finalScore}/100`, result.quality);
    const map = result.plan.slides.find((x) => x.pedagogicalRole === "mind_map");
    console.log("Clasificación:", map ? JSON.stringify(map.contentBlocks) : "(ninguna)");
    for (const s of result.slides) console.log(`  ${String(s.order).padStart(2)} ${s.role.padEnd(12)} ${s.layout.padEnd(20)} ${s.score} ${s.attempts > 1 ? `(${s.attempts} intentos)` : ""} ${s.issues.join(" | ")}`);
    if (result.warnings.length) console.log("Avisos:", result.warnings);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

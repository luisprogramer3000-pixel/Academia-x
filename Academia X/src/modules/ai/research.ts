/**
 * Investigación del tema de un curso antes de escribir sus lecciones: la IA
 * busca en internet fuentes profesionales (organismos oficiales, marcos de
 * referencia, exámenes, cursos y estudios del área) y devuelve un marco de
 * referencia con los conceptos, contenidos, estructura, criterios y tipos de
 * tareas que debe cubrir el curso, citando sus fuentes.
 *
 * Usa la búsqueda web de la API de OpenAI (Responses + web_search_preview). Si
 * no está disponible, se arma con el conocimiento del modelo y queda marcado
 * como "sin búsqueda web" (webSearch: false), para no presentarlo como investigado.
 */

export interface ResearchSource {
  title: string;
  url: string;
}

export interface ResearchBrief {
  /** Marco de referencia en texto (se pasa como contexto a cada lección) */
  brief: string;
  sources: ResearchSource[];
  webSearch: boolean;
  generatedAt: string;
  estimatedCost: number;
}

export interface ResearchInput {
  courseTitle: string;
  description?: string | null;
  level?: string | null;
  language: string;
  /** Títulos de los módulos y lecciones del curso */
  outline: string[];
}

const SYSTEM = [
  "Eres un investigador educativo y diseñador curricular senior.",
  "Investiga el tema del curso con fuentes profesionales y fiables: organismos oficiales (p. ej. Instituto Cervantes, Consejo de Europa/MCER, ministerios), marcos curriculares (p. ej. Plan Curricular del Instituto Cervantes), exámenes oficiales y sus guías, universidades y cursos de referencia del área.",
  "Escribe en español un MARCO DE REFERENCIA para el diseñador de las lecciones, con estas secciones:",
  "1. Qué exige el tema/nivel según las fuentes (descriptores, competencias, contenidos gramaticales, léxicos y funcionales).",
  "2. Si el curso prepara un examen o certificación: estructura exacta (pruebas, tareas, número de ítems, tiempos, puntuación, criterios de calificación y de aprobado).",
  "3. Conceptos clave que no pueden faltar, con una línea de explicación cada uno.",
  "4. Tipos de ejercicios y tareas que usan los cursos y materiales profesionales del tema.",
  "5. Errores y dificultades frecuentes de los estudiantes, y estrategias recomendadas.",
  "Sé concreto y fiel a las fuentes: no inventes cifras. Si una fuente no confirma un dato, no lo incluyas. Máximo 900 palabras.",
].join("\n");

const userPrompt = (i: ResearchInput) =>
  [
    `Curso: «${i.courseTitle}». Nivel: ${i.level || "no indicado"}. Idioma de enseñanza: ${i.language}.`,
    i.description ? `Descripción del profesor: ${i.description.slice(0, 1200)}` : "",
    i.outline.length ? `Temario previsto:\n- ${i.outline.slice(0, 40).join("\n- ")}` : "",
  ].filter(Boolean).join("\n");

/** Búsqueda web con la API Responses de OpenAI. */
async function researchWithWebSearch(input: ResearchInput): Promise<ResearchBrief> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY no está configurada.");
  const model = process.env.AI_RESEARCH_MODEL || process.env.AI_MODEL_PREMIUM || "gpt-4o";
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      tools: [{ type: "web_search_preview", search_context_size: "medium" }],
      input: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt(input) },
      ],
    }),
    signal: AbortSignal.timeout(150_000),
  });
  if (!res.ok) throw new Error(`OpenAI respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url?: string; title?: string }> }> }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const parts = (data.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text");
  const brief = parts.map((p) => p.text ?? "").join("\n").trim();
  if (brief.length < 200) throw new Error("La investigación llegó vacía.");
  const seen = new Set<string>();
  const sources = parts
    .flatMap((p) => p.annotations ?? [])
    .filter((a) => a.type === "url_citation" && a.url)
    .map((a) => ({ title: (a.title || a.url!).slice(0, 160), url: a.url!.replace(/[?&]utm_source=openai$/, "") }))
    .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
    .slice(0, 12);
  // gpt-4o: ~2,5 $/M de entrada y 10 $/M de salida, más ~0,03 $ por búsqueda
  const cost = ((data.usage?.input_tokens ?? 0) * 2.5 + (data.usage?.output_tokens ?? 0) * 10) / 1_000_000 + 0.03;
  return { brief: brief.slice(0, 9000), sources, webSearch: true, generatedAt: new Date().toISOString(), estimatedCost: Math.round(cost * 10000) / 10000 };
}

/**
 * Investiga el tema. `fallback` (sin búsqueda web) recibe system/user y devuelve
 * el texto del modelo: se usa si la búsqueda falla o el proveedor no es OpenAI.
 */
export async function researchCourseTopic(input: ResearchInput, fallback: (system: string, user: string) => Promise<string>): Promise<ResearchBrief> {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    try {
      return await researchWithWebSearch(input);
    } catch (error) {
      console.warn("[research] Búsqueda web no disponible, se usa el conocimiento del modelo:", error instanceof Error ? error.message : error);
    }
  }
  const text = await fallback(`${SYSTEM}\nNo tienes acceso a internet: basa el marco en tu conocimiento de esas fuentes y no cites direcciones web.`, userPrompt(input));
  return { brief: text.trim().slice(0, 9000), sources: [], webSearch: false, generatedAt: new Date().toISOString(), estimatedCost: 0.01 };
}

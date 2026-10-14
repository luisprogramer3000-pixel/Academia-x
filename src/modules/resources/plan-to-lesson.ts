import type { ClassPlanMaterial, ClassPlanOutput, ClassPlanQuestion } from "@/modules/ai/class-plan.schema";

/** Un material suelto se trata como un plan de un solo momento para reutilizar la conversión. */
export function materialAsPlan(material: ClassPlanMaterial, title: string): ClassPlanOutput {
  return {
    title,
    summary: material.description,
    durationMinutes: 0,
    methodology: "",
    objectives: [],
    competencies: [],
    moments: [{ phase: "Material", title, minutes: 0, guide: [], steps: [], materialIds: [material.id] }],
    materials: [material],
    promptTokens: 0,
    completionTokens: 0,
    estimatedCost: 0,
  };
}

/** Preguntas de opción múltiple de un plan o material, para el quiz en vivo. */
export function collectMultipleChoice(plan: ClassPlanOutput): ClassPlanQuestion[] {
  const order: Record<string, number> = { quiz: 0, ejercicios: 1, lectura: 2, reto: 3 };
  return [...plan.materials]
    .sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9))
    .flatMap((m) => m.questions)
    .filter((q) => q.options.length >= 2 && q.correctIndex >= 0);
}

export interface StoredResourceData {
  plan: ClassPlanOutput;
  material: ClassPlanMaterial | null;
}

/** Normaliza el JSON guardado de cualquier tipo de recurso a un plan. */
export function readResourceData(kind: string, data: unknown, title: string): StoredResourceData {
  if (kind === "MATERIAL") {
    const material = (data as { material: ClassPlanMaterial }).material;
    return { plan: materialAsPlan(material, title), material };
  }
  return { plan: { ...(data as ClassPlanOutput), title }, material: null };
}

type Block = Record<string, unknown> & { id: string; type: string };

/** Etiqueta del capítulo que ve el alumno para cada tipo de material */
const CHAPTER_LABEL: Record<string, { label: string; emoji: string }> = {
  reto: { label: "Reto práctico", emoji: "🧩" },
  resumen: { label: "Teoría", emoji: "📘" },
  lectura: { label: "Lectura de comprensión", emoji: "📖" },
  ejercicios: { label: "Ejercicios", emoji: "📝" },
  quiz: { label: "Comprueba lo aprendido", emoji: "🎯" },
  flashcards: { label: "Repaso", emoji: "🃏" },
  rubrica: { label: "Rúbrica", emoji: "📊" },
};

/** Orden pedagógico de la lección del alumno, independiente del guion del profesor */
const CHAPTER_ORDER = ["reto", "resumen", "lectura", "ejercicios", "quiz", "rubrica", "flashcards"];

/**
 * El orden de los capítulos depende de la metodología (el plan guarda su nombre):
 * en la clase invertida y la expositiva, la teoría va primero; en el enfoque
 * comunicativo, el texto modelo (lectura) sirve de entrada antes de la teoría.
 */
function chapterOrderFor(methodology: string): string[] {
  const m = methodology.toLowerCase();
  if (/invertida|expositiva/.test(m)) return ["resumen", "flashcards", "ejercicios", "lectura", "reto", "quiz", "rubrica"];
  if (/comunicativo/.test(m)) return ["reto", "lectura", "resumen", "ejercicios", "quiz", "rubrica", "flashcards"];
  return CHAPTER_ORDER;
}

function sectionBlocks(m: ClassPlanMaterial): Block[] {
  const out: Block[] = [];
  m.sections.forEach((s, i) => {
    const bullets = s.bullets.map((b) => b.replace(/^[-*•]\s+/, ""));
    const body = [s.body, bullets.length ? "" : null, ...bullets.map((b) => `- ${b}`)].filter((l) => l !== null).join("\n");
    if (!s.heading && !body.trim() && !s.dialogue?.length) return;
    out.push({ id: `${m.id}_s${i}`, type: "text", title: s.heading || m.title, content: body });
    // Como en un libro de idiomas: la ilustración de la escena y, debajo, el diálogo
    if (s.imageUrl) out.push({ id: `${m.id}_img${i}`, type: "image", url: s.imageUrl, title: s.heading, content: s.imagePrompt ?? s.heading });
    if (s.dialogue?.length) out.push({ id: `${m.id}_dlg${i}`, type: "dialogue", title: s.heading, lines: s.dialogue });
  });
  return out;
}

function questionBlock(q: ClassPlanQuestion, id: string): Block {
  if (q.options.length >= 2 && q.correctIndex >= 0) {
    return {
      id,
      type: "quiz",
      difficulty: q.difficulty,
      question: q.prompt,
      options: q.options,
      correctOptionIndex: q.correctIndex,
      explanation: q.explanation,
    };
  }
  return { id, type: "practice", difficulty: q.difficulty, question: q.prompt, answer: q.answer, explanation: q.explanation };
}


/**
 * Convierte un plan de clase (o un material suelto) en la lección del alumno.
 *
 * Cada material se convierte en un CAPÍTULO a tamaño completo (reto → teoría →
 * lectura → ejercicios → repaso). Las preguntas del quiz se intercalan dentro
 * de la teoría, las de comprensión van justo después de la lectura y cada
 * ejercicio es una actividad: las de opción múltiple se corrigen al instante;
 * las abiertas muestran una respuesta modelo. El guion del profesor va aparte.
 */
export function planToLessonBlocks(plan: ClassPlanOutput): Block[] {
  const order = chapterOrderFor(plan.methodology);
  const rank = (kind: string) => (order.indexOf(kind) + 99) % 99;
  const materials = [...plan.materials].sort((a, b) => rank(a.kind) - rank(b.kind));
  const theory = materials.find((m) => m.kind === "resumen");
  const quiz = materials.find((m) => m.kind === "quiz");
  // Si hay teoría, las preguntas del quiz se reparten dentro de ella
  const quizInsideTheory = Boolean(theory && quiz && theory.sections.length > 1);

  const out: Block[] = [];

  if (plan.objectives.length || plan.summary) {
    out.push({
      id: "intro",
      type: "text",
      title: plan.objectives.length ? "Lo que vas a aprender" : "Introducción",
      content: [plan.summary, plan.objectives.length ? "" : null, ...plan.objectives.map((o) => `- ${o}`)].filter((l) => l !== null).join("\n"),
    });
  }

  for (const m of materials) {
    if (m === quiz && quizInsideTheory) continue;
    const meta = CHAPTER_LABEL[m.kind] ?? { label: "Material", emoji: "📄" };
    out.push({ id: `${m.id}_chapter`, type: "chapter", title: m.title, content: m.description, label: meta.label, emoji: meta.emoji });

    const sections = sectionBlocks(m);
    const questions = m.questions.map((q, i) => questionBlock(q, `${m.id}_q${i}`));

    if (m === theory && quizInsideTheory) {
      // Sin preguntas tras la sección final de resumen
      const quizBlocks = quiz!.questions.map((q, i) => questionBlock(q, `${quiz!.id}_q${i}`));
      const last = sections.length > 2 ? sections.slice(-1) : [];
      const concepts = sections.slice(0, sections.length - last.length);
      // El ejercicio i de la teoría va justo después del concepto i; las preguntas del quiz se reparten después
      // Grupos "concepto (+ su imagen) + su ejercicio": las preguntas del quiz van entre grupos, nunca dentro
      const groups: Block[][] = [];
      for (const s of concepts) {
        if (s.type === "image" && groups.length) groups[groups.length - 1].push(s);
        else groups.push([s]);
      }
      groups.forEach((g, n) => questions[n] && g.push(questions[n]));
      const extra = questions.slice(groups.length);
      const quizItems = [...extra, ...quizBlocks];
      groups.forEach((g, i) => {
        out.push(...g);
        const from = Math.floor((i * quizItems.length) / groups.length);
        const to = Math.floor(((i + 1) * quizItems.length) / groups.length);
        out.push(...quizItems.slice(from, to));
      });
      out.push(...last);
    } else {
      out.push(...sections, ...questions);
    }

    if (m.cards.length) out.push({ id: `${m.id}_cards`, type: "flashcards", title: m.title, cards: m.cards });
  }

  return out;
}

export function planToTeacherPlan(plan: ClassPlanOutput) {
  let minute = 0;
  const classFlow = plan.moments.slice(0, 20).map((m) => {
    const step = { minute, durationMinutes: m.minutes, activity: `${m.phase}: ${m.title}`.slice(0, 500) };
    minute += m.minutes;
    return step;
  });
  return {
    objective: plan.objectives.join(" ").slice(0, 1000),
    prerequisites: [] as string[],
    classFlow,
    homework: "",
    teacherNotes: plan.moments.flatMap((m) => m.guide.map((g) => `[${m.phase}] ${g}`.slice(0, 500))).slice(0, 15),
  };
}


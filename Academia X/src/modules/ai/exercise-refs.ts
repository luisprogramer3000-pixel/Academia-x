import type { ClassPlanMaterial, ClassPlanOutput } from "./class-plan.schema";
import type { ClassAgentOutput } from "./class-agent.schema";
import type { LessonGenOutput, QuizGenOutput } from "./ai.adapter";
import { enforceSelfContained, type ExerciseRef, type JsonAsk } from "./exercise-integrity";

/**
 * Recorre los ejercicios de cada tipo de salida de la IA para pasarlos por el
 * control de calidad (exercise-integrity). Cada referencia sabe reescribir o
 * quitar su ejercicio de la estructura original (por identidad, no por índice).
 */

const removeFrom = <T>(list: T[], item: T) => () => {
  const i = list.indexOf(item);
  if (i >= 0) list.splice(i, 1);
};

function materialRefs(m: ClassPlanMaterial): ExerciseRef[] {
  return m.questions.map((q) => ({
    text: q.prompt,
    answer: q.answer,
    options: q.options,
    set: (text, answer) => {
      q.prompt = text;
      // En opción múltiple la respuesta es la opción correcta: solo se cambia en las abiertas
      if (answer && !q.options.length) q.answer = answer;
    },
    remove: removeFrom(m.questions, q),
  }));
}

export function classPlanRefs(plan: Pick<ClassPlanOutput, "materials">) {
  return {
    refs: plan.materials.flatMap(materialRefs),
    readingAvailable: plan.materials.some((m) => m.kind === "lectura" && m.sections.some((s) => s.body.length > 200)),
  };
}

export function materialToolRefs(material: ClassPlanMaterial) {
  return { refs: materialRefs(material), readingAvailable: material.kind === "lectura" };
}

export function classAgentRefs(out: ClassAgentOutput) {
  const refs: ExerciseRef[] = [
    ...out.exercises.map((e) => ({
      text: e.instruction,
      answer: e.solution,
      set: (text: string, answer?: string) => { e.instruction = text; if (answer) e.solution = answer; },
      remove: removeFrom(out.exercises, e),
    })),
    ...out.quiz.map((q) => ({
      text: q.question,
      options: q.options,
      set: (text: string) => { q.question = text; },
      remove: removeFrom(out.quiz, q),
    })),
    ...(out.reading?.questions ?? []).map((q) => ({
      text: q.question,
      options: q.options,
      set: (text: string) => { q.question = text; },
      remove: removeFrom(out.reading!.questions, q),
    })),
  ];
  return { refs, readingAvailable: Boolean(out.reading?.text && out.reading.text.length > 200) };
}

export function lessonGenRefs(out: LessonGenOutput) {
  const refs: ExerciseRef[] = [];
  for (const block of out.blocks.filter((b) => b.type === "exercise")) {
    const items = block.items ?? [];
    if (items.length) {
      for (const item of [...items]) {
        refs.push({
          text: `${block.content ? `${block.content}\n` : ""}${item}`,
          set: (text) => { const i = items.indexOf(item); if (i >= 0) items[i] = text; },
          remove: removeFrom(items, item),
        });
      }
    } else {
      refs.push({ text: block.content, set: (text) => { block.content = text; }, remove: removeFrom(out.blocks, block) });
    }
  }
  return { refs, readingAvailable: out.blocks.some((b) => b.type === "text" && b.content.length > 400) };
}

export function quizRefs(out: QuizGenOutput) {
  return {
    refs: out.questions.map((q) => ({ text: q.question, options: q.options, set: (text: string) => { q.question = text; }, remove: removeFrom(out.questions, q) })),
    readingAvailable: false,
  };
}

/** Aplica el control de calidad a los ejercicios dados (no lanza: si la reparación falla, se quitan los rotos). */
export async function ensureSelfContained(
  found: { refs: ExerciseRef[]; readingAvailable: boolean },
  ask: JsonAsk,
  ctx: { topic: string; level?: string; language?: string }
) {
  try {
    return await enforceSelfContained(found.refs, ask, { ...ctx, readingAvailable: found.readingAvailable });
  } catch (error) {
    console.warn("[exercise-integrity]", error);
    return { checked: found.refs.length, repaired: 0, removed: 0 };
  }
}

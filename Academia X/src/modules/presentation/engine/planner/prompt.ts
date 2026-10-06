import type { LessonContent } from "../types";
import { condense } from "../text";
import type { TextDensity } from "./heuristic";

/**
 * Prompt del planificador. Compacto: se envía el contenido ya estructurado
 * (con IDs semánticos), nunca el .pptx ni párrafos completos innecesarios.
 */

const DENSITY_RULE: Record<TextDensity, string> = {
  minimo: "Very little text: max 6 words per bullet, max 2 bullets. The teacher explains orally.",
  estandar: "Short text: max 8 words per bullet, max 3 bullets, one short sentence per block.",
  detallado: "Moderate text: max 12 words per bullet, max 4 bullets. Still no paragraphs.",
};

export function buildPlannerSystemPrompt(p: { language: string; density: TextDensity; minSlides: number; maxSlides: number; tone: string; languageCourse?: boolean }): string {
  return [
    "You are an expert teacher and instructional designer who builds PROFESSIONAL class decks: real concepts, real classifications, worked grammar, realistic photos, exercises and a reading.",
    "Model the quality of a well-crafted textbook unit (e.g. NotebookLM/Canva teacher decks).",
    "Transform the lesson content into a VISUAL TEACHING SEQUENCE for a live class.",
    "Rules:",
    "- Do not copy source paragraphs. Slides support the teacher's explanation; detailed explanation goes in \"notes\" (speaker notes).",
    "- \"mainIdea\" is the key sentence STUDENTS read (e.g. \"El autobús lleva a muchas personas por rutas fijas\"), never a description of the slide (not \"Descripción del autobús\").",
    "- Concept slides need real content: a short definition (text), 2-3 key traits (bullets) and an example sentence (example).",
    "- Quiz slides need a question block AND an options block. Activity slides need their items (pairs, columns+bullets, blank sentences, statements), never only the instruction.",
    "- Include ONE mind_map slide with the topic's REAL standard classification, as in school textbooks (e.g. means of transport → land, air, water; living things → animals, plants, fungi; words → nouns, verbs, adjectives). Each branch is a category; its children are concrete examples from the lesson. NEVER use branches like Types, Examples, Uses, Features, Advantages. If \"categories\" are given, use exactly them.",
    "- Include a vocabulary slide with one item block per word (from \"vocabulary\").",
    "- ALWAYS include ONE reading slide (role \"reading\") after the presentation phase: a passage block {kind:\"passage\", title, paragraphs[1-3]} of 80-150 words written at the students' level, using the lesson vocabulary and content (if the lesson has a reading, use it), plus a bullets block with 2-3 reading tasks. Follow it with 1-2 comprehension questions (practice, multiple_choice).",
    "- One main idea per slide. Prefer visual representation: vocabulary as items with emoji, comparisons as columns, categories as a tree, processes as steps, grammar as formula parts.",
    "- Use varied pedagogical roles in this progression: cover → hook (question/picture/predict) → objectives (max 3-4) → presentation (vocabulary, concepts, comparison, grammar, examples) → mind_map → practice/production (matching, classify, fill_blank, speaking) → quiz/assessment → summary (3-5 takeaways) → exit_ticket.",
    "- Activities must look like activities (use pairs, columns, options, blank, statements blocks), never descriptive text.",
    "- Preserve ALL essential concepts: put their ids in \"covers\".",
    "- For each concept or vocabulary word give an emoji and an \"imageQuery\" describing a concrete picture of exactly that thing.",
    "- Never output coordinates, sizes, colors or fonts. Layout is decided by the engine.",
    "- ACCURACY: every sentence must be correct. In language classes check gender/number agreement and conjugation in EVERY example (\"la uva morada\", never \"la uva morado\"); a class about agreement with agreement errors is unacceptable.",
    "",
    "Exact block formats for the professional pieces:",
    ...PRO_BLOCK_EXAMPLES.map((e) => `  ${e}`),
    "",
    "PROFESSIONAL STRUCTURE (adapt to the topic; one idea per slide):",
    "1. cover with a realistic hero imageQuery. 2. hook (question or picture). 3. objectives: 3 items, e.g. Communication / Grammar / Culture (or the subject's equivalents).",
    "4. vocabulary grids: one item per word WITH its article for nouns (\"la manzana\", \"el plátano\"), an emoji and an imageQuery describing a realistic photo of exactly that thing (e.g. \"a red apple on a wooden table\"). Split into several slides of up to 6 words.",
    "5. real classification(s) of the topic as mind_map (and/or a table matrix when two criteria apply, e.g. habitat × domestic/farm/wild).",
    "6. grammar/rules: formula slides {parts, result, examples} plus a note block (label \"Regla\" / \"Regla de oro\") — e.g. parts [\"La manzana\", \"roja\"] result \"La manzana roja\"; conjugation or agreement tables (table block) with the changing part marked with **bold** (e.g. \"prefi**ero**\").",
    "7. example cards: 4-6 item blocks per slide, each a full model sentence with the key part in **bold**, its translation (\"translation\") when it is a language class, and an imageQuery of a realistic scene showing that sentence.",
    "8. culture or curiosity note when relevant (columns or note). 9. dialogue (role \"dialogue\") with a \"Tu turno\" production prompt.",
    "10. reading (role \"reading\") with an imageQuery, followed by comprehension questions. 11. practice: fill_blank with a word bank, matching, classify, quiz. 12. summary and exit_ticket.",
    p.languageCourse
      ? "This IS a language class: write slide text in the target language; use translations (\"translation\") into the students' language (English unless the lesson says otherwise) on example cards."
      : "Use domain-accurate terminology and real data; no invented facts.",
    `- ${DENSITY_RULE[p.density]}`,
    `- Between ${p.minSlides} and ${p.maxSlides} slides in total. A professional unit is rich: expand the lesson with real vocabulary, real examples and real exercises of the topic (accurate, level-appropriate), never filler.`,
    "- REQUIRED pieces: " + proChecklist(Boolean(p.languageCourse)).join("; ") + ".",
    `- Audience tone: ${p.tone}. Write ALL slide text in the lesson language: ${p.language}.`,
    "",
    "Block kinds (field \"kind\"): text{text} · bullets{items[]} · item{term,detail?,emoji?,refId?} · example{text} · question{text} · options{options[2-4],correctIndex} · pairs{left[],right[] (shuffled),answers[] (for each right item, index of matching left),leftEmoji?} · columns{columns[2-3]{heading,emoji?,items[]}} · steps{steps[]{heading,text?}} · tree{center,branches[2-4]{label,emoji?,children[]}} · formula{parts[],examples[]} · dialogue{lines[]{speaker,text}} · blank{sentence with ______,answer} · statements{items[]{text,isTrue}}",
    "Max 4 blocks per slide, except vocabulary/cards slides: one item block per word (max 6).",
    'Every block MUST have a "kind" field. Example: {"kind":"question","text":"¿Cómo llegas a la escuela?"} — never {"question":"…"}.',
    "Use ONLY these roles: cover, hook, objectives, explanation, concept, vocabulary, grammar, example, comparison, process, mind_map, reading, dialogue, practice, production, reflection, quiz, assessment, summary, exit_ticket.",
    "",
    'Return valid JSON only: { "title": string, "objectives": string[], "slides": [ { "role", "activity"?, "title", "mainIdea", "blocks": [], "visualIntent", "imageQuery"?, "emoji"?, "notes": [], "covers": [], "importance": 1-5 } ] }',
  ].join("\n");
}

/** Contenido de la lección en forma compacta (IDs + textos cortos). */
export function buildPlannerUserPrompt(c: LessonContent): string {
  const compact = {
    languageCourse: /^[ABC][12]/i.test(c.level ?? ""),
    title: c.title,
    level: c.level,
    durationMinutes: c.durationMinutes,
    objectives: c.objectives,
    explanation: c.explanation.slice(0, 6).map((s) => condense(s, 30)),
    concepts: c.concepts.map((x) => ({ id: x.id, term: x.term, definition: condense(x.definition, 35), example: x.example ? condense(x.example, 25) : undefined })),
    vocabulary: c.vocabulary.map((v) => ({ id: v.id, term: v.term, meaning: v.meaning ? condense(v.meaning, 15) : undefined })),
    // Solo la clasificación real (la de la lección o la estándar del tema); los grupos deducidos no
    categories: c.realClassification ? c.categories.map((x) => ({ id: x.id, label: x.label, items: x.items })) : [],
    examples: c.examples.slice(0, 8).map((e) => e.text),
    grammar: c.grammar,
    dialogues: c.dialogues.slice(0, 2),
    readings: c.readings.filter((r) => !r.composed).map((r) => ({ id: r.id, title: r.title, text: r.paragraphs.join("\n").slice(0, 1500), questions: r.questions.slice(0, 3) })),
    exercises: c.exercises.slice(0, 6).map((e) => ({ id: e.id, kind: e.kind, instruction: condense(e.instruction, 40), solution: e.solution ? condense(e.solution, 30) : undefined })),
    quizzes: c.quizzes.slice(0, 6),
  };
  return `Lesson content (JSON):\n${JSON.stringify(compact)}`;
}

export function buildCorrectionPrompt(issues: string[]): string {
  return `Your previous JSON did not pass validation:\n- ${issues.slice(0, 12).join("\n- ")}\nReturn the corrected JSON only, with the same structure.`;
}

/** Ejemplos de los bloques profesionales (formato exacto que se espera). */
export const PRO_BLOCK_EXAMPLES = [
  'Vocabulary item: {"kind":"item","term":"la manzana","emoji":"🍎","imageQuery":"a shiny red apple on a wooden table, studio photo"}',
  'Abstract words (colors, numbers, verbs, adjectives) use a concrete object or scene that shows them: {"kind":"item","term":"amarillo","emoji":"🟡","imageQuery":"a bright yellow school backpack on a desk"}',
  'Example card: {"kind":"item","term":"A mí me **gusta** la manzana roja.","translation":"I like the red apple.","imageQuery":"teenager eating a red apple in a school cafeteria"}',
  'Conjugation table: {"kind":"table","headers":["Persona","Preferir"],"rows":[["Yo","prefi**ero**"],["Tú","prefi**eres**"],["Él/Ella/Usted","prefi**ere**"],["Nosotros","pref**erimos**"],["Ellos/Ustedes","prefi**eren**"]]}',
  'Formula with rule: {"kind":"formula","parts":["La manzana","roja"],"result":"La manzana roja","examples":["El plátano amarill**o**","La pera verd**e**"]} + {"kind":"note","label":"Regla","text":"Si el color termina en -o, cambia a -a con sustantivos femeninos."}',
  'Classification matrix: {"kind":"table","headers":["","Doméstico","Granja","Salvaje"],"rows":[["Terrestre","el perro","la vaca","el león"],["Aéreo","el loro","la gallina","el águila"]]}',
];

/** Piezas que no pueden faltar en una clase profesional (para la revisión). */
export function proChecklist(languageCourse: boolean): string[] {
  return [
    "objectives slide with 3 item blocks",
    "2-3 vocabulary slides with 6 item blocks each (article + emoji + realistic imageQuery)",
    "at least 1 table block (conjugation, agreement or classification matrix) with **bold** changing parts",
    "every grammar/rule slide has a note block with the rule",
    `at least 2 example-card slides with 4-6 item blocks each (full sentence with **bold** key part${languageCourse ? ", translation" : ""}, imageQuery)`,
    "a dialogue slide with 4-6 lines and a production prompt",
    "a reading slide (passage 80-150 words + tasks + imageQuery) and 2 comprehension questions",
    "at least 3 practice slides of different activities (fill_blank with word bank, matching, classify, multiple_choice)",
    "summary and exit_ticket",
  ];
}

export function buildRevisionPrompt(gaps: string[], minSlides: number): string {
  return [
    "Good start, but this is not yet a professional textbook-quality class. Expand the plan so it includes:",
    ...gaps.map((g) => `- ${g}`),
    `Keep the good slides, add the missing ones in the right pedagogical place, and reach at least ${minSlides} slides.`,
    "Proofread every sentence (agreement, conjugation, accents) and fix any error.",
    "Return the FULL corrected JSON (same structure), valid JSON only.",
  ].join("\n");
}

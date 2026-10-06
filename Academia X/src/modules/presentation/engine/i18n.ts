/**
 * Textos fijos de las diapositivas (etiquetas, consignas). Español e inglés;
 * cualquier otro idioma usa español para las etiquetas, y el contenido de la
 * lección se mantiene en su idioma original.
 */

export type UiLang = "es" | "en";

const LABELS = {
  es: {
    objectives: "Objetivos de la clase",
    objectivesShort: "Hoy vas a…",
    vocabulary: "Vocabulario",
    example: "Ejemplo",
    summary: "Lo que aprendimos",
    exitTicket: "Ticket de salida",
    quiz: "Elige la respuesta correcta",
    matching: "Relaciona",
    trueFalse: "¿Verdadero o falso?",
    fillBlank: "Completa",
    speaking: "Habla con tu compañero",
    classify: "Clasifica",
    mindMap: "Mapa visual",
    comparison: "Compara",
    practice: "Practica",
    reflection: "Reflexiona",
    hook: "Para empezar",
    answers: "Respuestas",
    true: "Verdadero",
    false: "Falso",
    vs: "VS",
    level: "Nivel",
    dialogue: "Diálogo",
    grammar: "Estructura",
    process: "Paso a paso",
    explanation: "¿Qué es?",
    concept: "Concepto",
    reading: "Lectura",
    tasks: "Tareas",
    guess: "¿Qué ves?",
    nameThree: (topic: string) => `Nombra 3 ideas que aprendiste sobre ${topic}.`,
    classificationOf: (topic: string) => `Clasificación de ${topic}`,
    hookQuestion: (topic: string) => `¿Qué sabes sobre ${topic}?`,
    hookPrompt: "Piensa 30 segundos y compártelo con la clase.",
    speakingPrompt: "Pregunta y responde con tu compañero.",
    matchingPrompt: "Une cada elemento con su pareja.",
    classifyPrompt: "Coloca cada palabra en su grupo.",
    selfCheck: "¿Cómo te sientes con el tema?",
    selfCheckScale: ["😕 Necesito repasar", "🙂 Casi lo tengo", "😄 ¡Lo domino!"],
  },
  en: {
    objectives: "Learning objectives",
    objectivesShort: "Today you will…",
    vocabulary: "Vocabulary",
    example: "Example",
    summary: "Key takeaways",
    exitTicket: "Exit ticket",
    quiz: "Choose the correct answer",
    matching: "Match",
    trueFalse: "True or false?",
    fillBlank: "Fill in the blank",
    speaking: "Talk to your partner",
    classify: "Classify",
    mindMap: "Visual map",
    comparison: "Compare",
    practice: "Practice",
    reflection: "Reflect",
    hook: "Warm-up",
    answers: "Answers",
    true: "True",
    false: "False",
    vs: "VS",
    level: "Level",
    dialogue: "Dialogue",
    grammar: "Structure",
    process: "Step by step",
    explanation: "What is it?",
    concept: "Concept",
    reading: "Reading",
    tasks: "Tasks",
    guess: "What can you see?",
    nameThree: (topic: string) => `Name 3 things you learned about ${topic}.`,
    classificationOf: (topic: string) => `How we classify ${topic}`,
    hookQuestion: (topic: string) => `What do you know about ${topic}?`,
    hookPrompt: "Think for 30 seconds and share with the class.",
    speakingPrompt: "Ask and answer with your partner.",
    matchingPrompt: "Match each item with its pair.",
    classifyPrompt: "Put each word in the right group.",
    selfCheck: "How do you feel about this topic?",
    selfCheckScale: ["😕 I need to review", "🙂 Almost there", "😄 I've got it!"],
  },
} as const;

export type Labels = (typeof LABELS)["es"] | (typeof LABELS)["en"];

export function uiLang(language: string | undefined): UiLang {
  const l = (language ?? "").toLowerCase();
  return l.startsWith("en") || l.startsWith("ingl") || l === "english" ? "en" : "es";
}

export function labels(language: string | undefined): Labels {
  return LABELS[uiLang(language)];
}

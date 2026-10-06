import type { LayoutDef } from "./types";
import { COVER_HERO, COVER_MINIMAL, COVER_TEMPLATE } from "./layouts/cover";
import { HOOK_PICTURE, HOOK_QUESTION } from "./layouts/hook";
import { CONCEPT_CARD, FULL_BLEED_IMAGE, IMAGE_DOMINANT, STATEMENT_CHIPS, TITLE_IMAGE_LEFT, TITLE_IMAGE_RIGHT } from "./layouts/text-image";
import { CARDS_ROW, OBJECTIVES_CARDS, PROCESS_STEPS, SUMMARY_CHECKLIST, VOCABULARY_GRID_4, VOCABULARY_GRID_6 } from "./layouts/cards";
import { COMPARISON_SPLIT, DIALOGUE, GRAMMAR_FORMULA, MIND_MAP, VS_LAYOUT } from "./layouts/diagrams";
import { FLEX_CONTENT } from "./layouts/fallback";
import { READING_PASSAGE } from "./layouts/reading";
import { FORMULA_RULE, PHOTO_EXAMPLES, TABLE_GRID } from "./layouts/pro";
import { CLASSIFY, EXIT_TICKET, FILL_BLANK, MATCHING, MULTIPLE_CHOICE, PRACTICE_PROMPT, QUIZ_LIST, SPEAKING, TRUE_FALSE } from "./layouts/activities";

/**
 * Biblioteca de layouts SEMÁNTICOS (no ligados a ninguna plantilla). Cada uno
 * declara para qué roles sirve, cuánto contenido admite y si necesita imagen.
 */
export const LAYOUTS: LayoutDef[] = [
  COVER_HERO, COVER_MINIMAL, COVER_TEMPLATE,
  HOOK_QUESTION, HOOK_PICTURE,
  OBJECTIVES_CARDS, PROCESS_STEPS,
  TITLE_IMAGE_RIGHT, TITLE_IMAGE_LEFT, CONCEPT_CARD, IMAGE_DOMINANT, FULL_BLEED_IMAGE, STATEMENT_CHIPS,
  CARDS_ROW, VOCABULARY_GRID_4, VOCABULARY_GRID_6,
  VS_LAYOUT, COMPARISON_SPLIT, MIND_MAP, GRAMMAR_FORMULA, DIALOGUE,
  MATCHING, MULTIPLE_CHOICE, QUIZ_LIST, TRUE_FALSE, FILL_BLANK, SPEAKING, CLASSIFY, PRACTICE_PROMPT,
  SUMMARY_CHECKLIST, EXIT_TICKET,
  READING_PASSAGE,
  TABLE_GRID, PHOTO_EXAMPLES, FORMULA_RULE,
  FLEX_CONTENT,
];

export const layoutRenderers: Record<string, LayoutDef> = Object.fromEntries(LAYOUTS.map((l) => [l.id, l]));

export function getLayout(id: string): LayoutDef | undefined {
  return layoutRenderers[id];
}

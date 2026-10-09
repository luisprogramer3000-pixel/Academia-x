-- Investigación del tema del curso (fuentes profesionales) para las lecciones con IA. Solo aditiva.
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "researchBrief" JSONB;

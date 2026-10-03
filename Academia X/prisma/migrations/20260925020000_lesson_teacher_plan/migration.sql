-- Plan del profesor para cada lección (guion de clase, notas, tarea)
ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "teacherPlan" JSONB;

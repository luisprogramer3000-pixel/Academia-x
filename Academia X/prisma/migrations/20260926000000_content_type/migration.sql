-- Distingue entre cursos completos (con landing, módulos, precio) y lecciones sueltas (recurso interno)
CREATE TYPE "ContentType" AS ENUM ('COURSE', 'STANDALONE_LESSON');
ALTER TABLE "Course" ADD COLUMN "contentType" "ContentType" NOT NULL DEFAULT 'COURSE';

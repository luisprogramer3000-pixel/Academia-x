-- Papelera: cursos (y lecciones sueltas) y recursos borrados se pueden restaurar
-- durante 30 días. deletedAt NULL = activo. Las filas existentes no cambian.
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "TeachingResource" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Course_tenantId_deletedAt_idx" ON "Course"("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "TeachingResource_tenantId_deletedAt_idx" ON "TeachingResource"("tenantId", "deletedAt");

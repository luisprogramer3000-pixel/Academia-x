-- Plantillas de certificado, trazabilidad de emisión y fecha de entrega de tareas
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "certificateTemplate" TEXT NOT NULL DEFAULT 'CLASSIC';
ALTER TABLE "Certificate" ADD COLUMN IF NOT EXISTS "template" TEXT NOT NULL DEFAULT 'CLASSIC';
ALTER TABLE "Certificate" ADD COLUMN IF NOT EXISTS "issuedByUserId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

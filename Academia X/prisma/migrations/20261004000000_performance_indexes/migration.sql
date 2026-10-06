-- Rendimiento: índices en columnas de relación (PostgreSQL no los crea solo) y
-- en las consultas más repetidas. Los de una sola columna (tenantId) se
-- sustituyen por compuestos que empiezan por la misma columna: sin duplicados.
-- Primero se crean los nuevos y después se borran los sustituidos.

CREATE INDEX IF NOT EXISTS "Membership_tenantId_role_idx" ON "Membership"("tenantId", "role");
CREATE INDEX IF NOT EXISTS "Course_tenantId_status_idx" ON "Course"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Module_courseId_order_idx" ON "Module"("courseId", "order");
CREATE INDEX IF NOT EXISTS "Lesson_moduleId_order_idx" ON "Lesson"("moduleId", "order");
CREATE INDEX IF NOT EXISTS "Enrollment_courseId_idx" ON "Enrollment"("courseId");
CREATE INDEX IF NOT EXISTS "Progress_lessonId_idx" ON "Progress"("lessonId");
CREATE INDEX IF NOT EXISTS "Assignment_lessonId_idx" ON "Assignment"("lessonId");
CREATE INDEX IF NOT EXISTS "Submission_assignmentId_idx" ON "Submission"("assignmentId");
CREATE INDEX IF NOT EXISTS "Submission_userId_idx" ON "Submission"("userId");
CREATE INDEX IF NOT EXISTS "Certificate_tenantId_issuedAt_idx" ON "Certificate"("tenantId", "issuedAt");
CREATE INDEX IF NOT EXISTS "Certificate_userId_idx" ON "Certificate"("userId");
CREATE INDEX IF NOT EXISTS "Certificate_courseId_idx" ON "Certificate"("courseId");
CREATE INDEX IF NOT EXISTS "AIUsage_tenantId_createdAt_idx" ON "AIUsage"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Subscription_tenantId_updatedAt_idx" ON "Subscription"("tenantId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Invitation_tenantId_email_idx" ON "Invitation"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "LiveParticipant_sessionId_score_idx" ON "LiveParticipant"("sessionId", "score");

DROP INDEX IF EXISTS "Membership_tenantId_idx";
DROP INDEX IF EXISTS "Course_tenantId_idx";
DROP INDEX IF EXISTS "Certificate_tenantId_idx";
DROP INDEX IF EXISTS "AIUsage_tenantId_idx";
DROP INDEX IF EXISTS "Subscription_tenantId_idx";

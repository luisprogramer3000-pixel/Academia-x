-- 1. Integridad: el progreso de un usuario se borra con él (antes quedaba huérfano).
--    Antes se eliminan posibles filas huérfanas, que impedirían crear la restricción.
DELETE FROM "Progress" p WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = p."userId");
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Índices duplicados: ya los cubren (tenantId, createdAt) y (tenantId, read)
DROP INDEX IF EXISTS "AICreditTransaction_tenantId_idx";
DROP INDEX IF EXISTS "Notification_tenantId_idx";

-- 3. Fechas con zona horaria. Los valores guardados ya están en UTC (Prisma siempre escribe
--    en UTC): se convierten indicándolo explícitamente, sin depender del TimeZone de la sesión.
ALTER TABLE "AICreditPurchase"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "AICreditTransaction"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "AICreditWallet"
  ALTER COLUMN "resetAt" TYPE TIMESTAMPTZ(3) USING "resetAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "AIUsage"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Assignment"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "dueDate" TYPE TIMESTAMPTZ(3) USING "dueDate" AT TIME ZONE 'UTC';
ALTER TABLE "AuditLog"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Certificate"
  ALTER COLUMN "issuedAt" TYPE TIMESTAMPTZ(3) USING "issuedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Course"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Enrollment"
  ALTER COLUMN "enrolledAt" TYPE TIMESTAMPTZ(3) USING "enrolledAt" AT TIME ZONE 'UTC';
ALTER TABLE "EnrollmentRequest"
  ALTER COLUMN "reviewedAt" TYPE TIMESTAMPTZ(3) USING "reviewedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Invitation"
  ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Lesson"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "LiveAnswer"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "LiveParticipant"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "LiveSession"
  ALTER COLUMN "questionStartedAt" TYPE TIMESTAMPTZ(3) USING "questionStartedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "endedAt" TYPE TIMESTAMPTZ(3) USING "endedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Membership"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Module"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Notification"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "PasswordResetToken"
  ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(3) USING "expiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "usedAt" TYPE TIMESTAMPTZ(3) USING "usedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Progress"
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "QuizAttempt"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "ScheduledClass"
  ALTER COLUMN "startsAt" TYPE TIMESTAMPTZ(3) USING "startsAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "StripeEvent"
  ALTER COLUMN "processedAt" TYPE TIMESTAMPTZ(3) USING "processedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Submission"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC';
ALTER TABLE "Subscription"
  ALTER COLUMN "currentPeriodEnd" TYPE TIMESTAMPTZ(3) USING "currentPeriodEnd" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "TeachingResource"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "deletedAt" TYPE TIMESTAMPTZ(3) USING "deletedAt" AT TIME ZONE 'UTC';
ALTER TABLE "Tenant"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';
ALTER TABLE "User"
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(3) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(3) USING "updatedAt" AT TIME ZONE 'UTC';

-- Zona horaria de cada academia (para las fechas que se muestran desde el servidor)
ALTER TABLE "Tenant" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Guayaquil';

-- 4. Clases programadas: estado y enlace de la reunión online
CREATE TYPE "ScheduledClassStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED');
ALTER TABLE "ScheduledClass" ADD COLUMN "status" "ScheduledClassStatus" NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE "ScheduledClass" ADD COLUMN "meetingUrl" TEXT;

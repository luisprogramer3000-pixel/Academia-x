-- Inscripción a cursos de pago: solicitud del alumno + aprobación del profesor
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "paymentInstructions" TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "freePreview" BOOLEAN NOT NULL DEFAULT true;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ENROLLMENT_REQUEST';

DO $$ BEGIN
    CREATE TYPE "EnrollmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "EnrollmentRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" "EnrollmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "proofUrl" TEXT,
    "message" TEXT,
    "reviewNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnrollmentRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EnrollmentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EnrollmentRequest_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EnrollmentRequest_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "EnrollmentRequest_membershipId_courseId_key" ON "EnrollmentRequest"("membershipId", "courseId");
CREATE INDEX IF NOT EXISTS "EnrollmentRequest_tenantId_status_idx" ON "EnrollmentRequest"("tenantId", "status");
ALTER TABLE "EnrollmentRequest" ENABLE ROW LEVEL SECURITY;

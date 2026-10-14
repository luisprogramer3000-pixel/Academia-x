-- Biblioteca "Mis recursos" y calendario de clases programadas
CREATE TABLE IF NOT EXISTS "TeachingResource" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CLASS_PLAN',
    "title" TEXT NOT NULL,
    "subject" TEXT,
    "grade" TEXT,
    "topic" TEXT,
    "data" JSONB NOT NULL,
    "lessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeachingResource_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TeachingResource_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeachingResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "TeachingResource_tenantId_createdAt_idx" ON "TeachingResource"("tenantId", "createdAt");
ALTER TABLE "TeachingResource" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "ScheduledClass" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 50,
    "groupName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledClass_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScheduledClass_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledClass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ScheduledClass_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "TeachingResource"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ScheduledClass_tenantId_startsAt_idx" ON "ScheduledClass"("tenantId", "startsAt");
ALTER TABLE "ScheduledClass" ENABLE ROW LEVEL SECURITY;

-- Generaciones con IA en segundo plano (el proxy del hosting corta las peticiones largas).
CREATE TABLE "AIJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AIJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIJob_createdAt_idx" ON "AIJob"("createdAt");

ALTER TABLE "AIJob" ADD CONSTRAINT "AIJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cerrada a la API pública de Supabase, como el resto
ALTER TABLE "AIJob" ENABLE ROW LEVEL SECURITY;

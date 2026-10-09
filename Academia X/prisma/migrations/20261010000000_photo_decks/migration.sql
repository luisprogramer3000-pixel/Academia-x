-- Presentaciones "foto + texto": guion revisable y una foto por diapositiva.
CREATE TABLE "PhotoDeck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCRIPT',
    "script" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PhotoDeck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhotoDeck_tenantId_lessonId_updatedAt_idx" ON "PhotoDeck"("tenantId", "lessonId", "updatedAt");

ALTER TABLE "PhotoDeck" ADD CONSTRAINT "PhotoDeck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cerrada a la API pública de Supabase, como el resto
ALTER TABLE "PhotoDeck" ENABLE ROW LEVEL SECURITY;

-- Quiz en vivo: sesiones, participantes (sin cuenta) y respuestas
CREATE TABLE IF NOT EXISTS "LiveSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "resourceId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "currentIndex" INTEGER NOT NULL DEFAULT -1,
    "questionStartedAt" TIMESTAMP(3),
    "timeLimitSec" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LiveSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiveSession_code_key" ON "LiveSession"("code");
CREATE INDEX IF NOT EXISTS "LiveSession_tenantId_createdAt_idx" ON "LiveSession"("tenantId", "createdAt");
ALTER TABLE "LiveSession" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "LiveParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveParticipant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiveParticipant_sessionId_nickname_key" ON "LiveParticipant"("sessionId", "nickname");
ALTER TABLE "LiveParticipant" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "LiveAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "questionIndex" INTEGER NOT NULL,
    "selected" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveAnswer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LiveAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LiveAnswer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "LiveParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "LiveAnswer_participantId_questionIndex_key" ON "LiveAnswer"("participantId", "questionIndex");
CREATE INDEX IF NOT EXISTS "LiveAnswer_sessionId_questionIndex_idx" ON "LiveAnswer"("sessionId", "questionIndex");
ALTER TABLE "LiveAnswer" ENABLE ROW LEVEL SECURITY;

-- Pagos externos por curso, clases en vivo, entregas con archivo y firma de certificados premium

ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "paymentType" TEXT NOT NULL DEFAULT 'EXTERNAL';
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "paymentLink" TEXT;

ALTER TABLE "Lesson" ADD COLUMN IF NOT EXISTS "liveUrl" TEXT;

ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;

ALTER TABLE "Certificate" ADD COLUMN IF NOT EXISTS "cryptoHash" TEXT;

-- Seguridad: RLS activado en TODAS las tablas del esquema public.
--
-- La clave pública de Supabase (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) permite
-- consultar las tablas de "public" por su API REST. Sin políticas, RLS activado
-- = nadie puede leerlas ni escribirlas por esa vía. Prisma se conecta como
-- propietario de las tablas y no se ve afectado.
--
-- Hasta ahora solo 7 tablas lo activaban en las migraciones; las demás lo tenían
-- por configuración del proyecto de Supabase, que no se copia a un proyecto nuevo.
-- Es idempotente: en una base que ya lo tiene activado no cambia nada.

ALTER TABLE "AICreditPurchase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AICreditTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AICreditWallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AIUsage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Assignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Certificate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EnrollmentRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Module" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuizAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduledClass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StripeEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TeachingResource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Row Level Security en todo el esquema público.
--
-- Supabase publica automáticamente las tablas de "public" a través de su API REST,
-- accesible con la clave publishable que viaja al navegador. Sin RLS, esa API deja
-- leer y escribir cualquier fila (incluidos los passwordHash de "User").
--
-- Activamos RLS SIN políticas: la API pública queda denegada por defecto. La
-- aplicación no se ve afectada porque Prisma se conecta con el rol propietario
-- (postgres), que no está sujeto a RLS.
--
-- IMPORTANTE: si algún día se usa el cliente de Supabase desde el navegador para
-- leer datos, habrá que crear políticas explícitas para esas tablas.

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'User',
    'PasswordResetToken',
    'Tenant',
    'Membership',
    'Course',
    'Module',
    'Lesson',
    'Enrollment',
    'Progress',
    'Assignment',
    'Submission',
    'Certificate',
    'AIUsage',
    'AICreditWallet',
    'AICreditTransaction',
    'Subscription',
    'StripeEvent',
    'Invitation',
    'AuditLog',
    'Notification',
    'AICreditPurchase'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = target_table
    ) THEN
      -- Solo ENABLE (nunca FORCE): el rol propietario que usa Prisma queda exento
      -- y la aplicación sigue funcionando; la API pública de Supabase queda cerrada.
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    END IF;
  END LOOP;
END$$;

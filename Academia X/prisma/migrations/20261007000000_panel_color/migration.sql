-- Color de fondo del panel del profesor (Configuración & Branding). NULL = oscuro, el de siempre.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "panelColor" TEXT;

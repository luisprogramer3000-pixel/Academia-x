-- Página pública de la academia: modelo de diseño y textos ({ template, headline, subheadline, callToAction, heroImageUrl }).
-- NULL = diseño por defecto ("Mi marca"). Solo aditiva.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "landing" JSONB;

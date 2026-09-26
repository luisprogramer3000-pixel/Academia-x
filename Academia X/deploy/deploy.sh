#!/usr/bin/env bash
# =============================================================================
# Despliegue de Mentor Studio Global en el VPS.
#
#   cd /var/www/mentor-studio && ./deploy/deploy.sh
#
# Orden pensado para que el sitio nunca quede servido con una base de datos
# desactualizada: primero migraciones, luego build, y recién ahí se recarga PM2.
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/mentor-studio"
cd "$APP_DIR"

echo "==> Descargando cambios"
git pull --ff-only

echo "==> Instalando dependencias"
npm ci   # ejecuta prisma generate en el postinstall

echo "==> Aplicando migraciones a Supabase"
npx prisma migrate deploy

echo "==> Compilando"
npm run build

echo "==> Recargando la aplicación"
pm2 reload deploy/ecosystem.config.js --update-env

echo "==> Comprobando el estado"
sleep 5
HEALTH="$(curl -fsS -m 20 http://127.0.0.1:3000/api/health || true)"
echo "    $HEALTH"

if [[ "$HEALTH" != *'"status":"ok"'* ]]; then
  echo "‼️  La aplicación no responde correctamente. Revisá: pm2 logs mentor-studio --lines 100" >&2
  exit 1
fi

echo "✅ Despliegue completado."

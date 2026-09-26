#!/usr/bin/env bash
# =============================================================================
# Reset mensual de créditos de IA.
#
# Reemplaza al cron de vercel.json, que NO se ejecuta fuera de Vercel.
# Sin esto, los clientes pagan el segundo mes y no reciben créditos nuevos.
#
# Instalar en el crontab de root (cada hora, como en vercel.json):
#   crontab -e
#   0 * * * * /var/www/mentor-studio/deploy/cron-ai-credit-reset.sh
#
# El endpoint es idempotente: procesa solo las academias cuyo resetAt ya venció,
# así que ejecutarlo de más no duplica créditos.
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/mentor-studio"
ENV_FILE="$APP_DIR/.env.production.local"
LOG_FILE="/var/log/mentor-studio/cron.log"

log() { echo "[$(date -Is)] $*" >> "$LOG_FILE"; }

if [[ ! -f "$ENV_FILE" ]]; then
  log "ERROR: no se encontró $ENV_FILE"
  exit 1
fi

# Leer secretos sin volcarlos en el log ni en la lista de procesos
# tr -d '\042\047' elimina comillas dobles y simples (en octal, para no pelear con el entrecomillado)
CRON_SECRET="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '\042\047')"
APP_URL="$(grep -E '^NEXT_PUBLIC_APP_URL=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '\042\047')"

if [[ -z "$CRON_SECRET" ]]; then
  log "ERROR: CRON_SECRET vacío en $ENV_FILE"
  exit 1
fi

APP_URL="${APP_URL:-http://127.0.0.1:3000}"
APP_URL="${APP_URL%/}"

RESPONSE="$(curl -fsS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/cron/ai-credit-reset?limit=200" 2>&1)" || {
    log "FALLO al ejecutar el reset: $RESPONSE"
    exit 1
  }

log "OK $RESPONSE"

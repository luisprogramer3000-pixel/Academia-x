#!/usr/bin/env bash
# =============================================================================
# Vaciado diario de la papelera (cursos y recursos borrados hace más de 30 días).
#
# Reemplaza al segundo cron de vercel.json, que NO se ejecuta fuera de Vercel.
#
# Instalar en el crontab de root (todos los días a las 04:30):
#   crontab -e
#   30 4 * * * /var/www/mentor-studio/deploy/cron-purge-trash.sh
# =============================================================================
set -euo pipefail

APP_DIR="/var/www/mentor-studio"
ENV_FILE="$APP_DIR/.env.production.local"
LOG_FILE="/var/log/mentor-studio/cron.log"

log() { echo "[$(date -Is)] purge-trash: $*" >> "$LOG_FILE"; }

if [[ ! -f "$ENV_FILE" ]]; then
  log "ERROR: no se encontró $ENV_FILE"
  exit 1
fi

# tr -d '\042\047' elimina comillas dobles y simples
CRON_SECRET="$(grep -E '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d'=' -f2- | tr -d '\042\047')"
if [[ -z "$CRON_SECRET" ]]; then
  log "ERROR: CRON_SECRET vacío en $ENV_FILE"
  exit 1
fi

# Directo al proceso local: no depende del DNS ni del certificado
RESPONSE="$(curl -fsS -m 180 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://127.0.0.1:3000/api/cron/purge-trash" 2>&1)" || {
    log "FALLO: $RESPONSE"
    exit 1
  }

log "OK $RESPONSE"

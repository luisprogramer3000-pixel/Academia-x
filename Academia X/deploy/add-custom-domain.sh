#!/usr/bin/env bash
# =============================================================================
# Alta de un dominio personalizado (plan Academy Executive).
#
#   sudo ./deploy/add-custom-domain.sh escuela-del-cliente.com
#
# Qué hace:
#   1. Comprueba que el dominio ya apunte por DNS a este servidor.
#   2. Crea el server block de nginx que reenvía a Next.js.
#   3. Emite el certificado SSL con certbot y activa la renovación automática.
#
# El middleware resuelve el dominio contra Tenant.customDomain, así que el
# cliente debe haberlo guardado antes en Configuración & Branding.
# =============================================================================
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "Uso: $0 dominio-del-cliente.com" >&2
  exit 1
fi

if [[ ! "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]]; then
  echo "ERROR: '$DOMAIN' no parece un dominio válido." >&2
  exit 1
fi

SERVER_IP="$(curl -fsS https://api.ipify.org || true)"
RESOLVED="$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)"

if [[ -z "$RESOLVED" ]]; then
  echo "ERROR: $DOMAIN no resuelve todavía. El cliente debe crear un registro A hacia $SERVER_IP." >&2
  exit 1
fi

if [[ -n "$SERVER_IP" && "$RESOLVED" != "$SERVER_IP" ]]; then
  echo "AVISO: $DOMAIN resuelve a $RESOLVED, pero este servidor es $SERVER_IP."
  echo "Si el DNS se acaba de cambiar, esperá a que propague. Certbot fallará si no apunta aquí."
  read -r -p "¿Continuar de todos modos? [s/N] " answer
  [[ "$answer" == "s" || "$answer" == "S" ]] || exit 1
fi

CONF="/etc/nginx/sites-available/cliente-$DOMAIN"

cat > "$CONF" <<NGINX
# Dominio personalizado: $DOMAIN  (generado por add-custom-domain.sh)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    client_max_body_size 25m;
    proxy_read_timeout 300s;

    location /uploads/ {
        alias /var/www/mentor-studio-uploads/;
        expires 30d;
        add_header X-Content-Type-Options "nosniff" always;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf "$CONF" "/etc/nginx/sites-enabled/cliente-$DOMAIN"
nginx -t
systemctl reload nginx

# certbot --nginx reescribe el bloque anterior añadiendo TLS y la redirección
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --redirect

nginx -t
systemctl reload nginx

echo
echo "✅ $DOMAIN activo con SSL."
echo "   Verificá que el tenant lo tenga guardado en Configuración & Branding."
echo "   La renovación es automática (systemctl list-timers | grep certbot)."

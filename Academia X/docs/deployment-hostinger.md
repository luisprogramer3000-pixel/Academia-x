# Despliegue de Mentor Studio Global en VPS (Hostinger)

Guía de puesta en producción sobre un VPS Ubuntu con nginx, PM2 y Let's Encrypt.
La base de datos sigue siendo Supabase (no se instala PostgreSQL en el VPS).

Dominio de la plataforma: **mentorstudioglobal.com**. Tanto esta guía como
`deploy/nginx/mentor-studio.conf` ya están configurados con él, así que los comandos
se pueden copiar y pegar tal cual.

---

## 0. Requisitos previos

| Qué | Dónde | Notas |
|---|---|---|
| VPS Ubuntu 22.04+ con acceso root | Hostinger | 2 GB de RAM como mínimo (el `next build` es lo que más consume) |
| Dominio apuntando al VPS | Tu proveedor de DNS | Ver paso 2 |
| Proyecto Supabase | supabase.com | Con las migraciones aplicadas |
| Cuenta de Stripe en modo live | stripe.com | 3 productos × 2 precios |
| Cuenta de Resend con dominio verificado | resend.com | Para invitaciones y recuperación de contraseña |
| Base de datos de Upstash Redis | upstash.com | Para el rate limiting |

---

## 1. Preparar el servidor

```bash
# Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx git
sudo npm install -g pm2

# Carpetas
sudo mkdir -p /var/www/mentor-studio /var/www/mentor-studio-uploads /var/www/certbot /var/log/mentor-studio
sudo chown -R $USER:$USER /var/www/mentor-studio /var/www/mentor-studio-uploads /var/log/mentor-studio

# Cortafuegos
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

---

## 2. DNS

En tu proveedor de dominio, apuntando a la IP del VPS:

| Tipo | Nombre | Valor | Para qué |
|---|---|---|---|
| A | `@` | IP del VPS | mentorstudioglobal.com |
| A | `www` | IP del VPS | www.mentorstudioglobal.com |
| A | `*` | IP del VPS | **subdominio de cada academia** (`mi-academia.mentorstudioglobal.com`) |

El registro comodín `*` no es opcional: es lo que hace funcionar el multi-tenant por
subdominio que resuelve `src/middleware.ts`.

---

## 3. Código y variables de entorno

```bash
cd /var/www
git clone <URL-del-repositorio> mentor-studio
cd mentor-studio
npm ci
```

Crear `/var/www/mentor-studio/.env.production.local` (Next.js lo carga automáticamente;
está en `.gitignore`, así que nunca llega al repositorio):

```bash
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://mentorstudioglobal.com"
NEXT_PUBLIC_APP_HOST="mentorstudioglobal.com"

# Supabase — connection_limit=10 porque es un proceso permanente, no serverless
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10"
DIRECT_URL="postgresql://...pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."

# Secretos (generar valores nuevos, nunca reutilizar los de desarrollo)
JWT_SECRET="..."
CRON_SECRET="..."

# Stripe (claves live)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_STARTER_MONTHLY="price_..."
STRIPE_PRICE_STARTER_YEARLY="price_..."
STRIPE_PRICE_PRO_MONTHLY="price_..."
STRIPE_PRICE_PRO_YEARLY="price_..."
STRIPE_PRICE_ACADEMY_MONTHLY="price_..."
STRIPE_PRICE_ACADEMY_YEARLY="price_..."

# IA
AI_PROVIDER="openai"
OPENAI_API_KEY="sk-proj-..."
OPENAI_MODEL="gpt-4o-mini"

# Emails
RESEND_API_KEY="re_..."
EMAIL_FROM="Mentor Studio Global <no-reply@mentorstudioglobal.com>"

# Rate limiting
RATE_LIMIT_PROVIDER="upstash"
UPSTASH_REDIS_REST_URL="https://....upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."

# Archivos subidos (fuera del proyecto, para que sobrevivan a los despliegues)
UPLOADS_DIR="/var/www/mentor-studio-uploads"
```

Para generar los secretos:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"     # CRON_SECRET
```

`src/lib/env.ts` corta el arranque si falta alguno de los críticos, así que un
error aquí se ve enseguida y no a medias.

---

## 4. Primer arranque

```bash
cd /var/www/mentor-studio
npx prisma migrate deploy
npm run build
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup        # ejecutar el comando que imprime, para que arranque al reiniciar

curl http://127.0.0.1:3000/api/health   # debe responder {"status":"ok","db":"ok"}
```

---

## 5. nginx y SSL

```bash
sudo cp deploy/nginx/mentor-studio.conf /etc/nginx/sites-available/mentor-studio
sudo nano /etc/nginx/sites-available/mentor-studio
```

Comentá el bloque `server` de HTTPS (el que escucha en el 443): todavía no existen
los certificados y nginx se niega a arrancar si apunta a un archivo que no está.
Después activá el sitio:

```bash
sudo ln -s /etc/nginx/sites-available/mentor-studio /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Certificado wildcard

El comodín `*.mentorstudioglobal.com` **no se puede validar por HTTP**: exige el desafío
DNS-01, es decir, crear un registro TXT en tu proveedor de dominio.

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d mentorstudioglobal.com -d www.mentorstudioglobal.com -d "*.mentorstudioglobal.com"
```

Certbot te va a pedir crear un TXT `_acme-challenge.mentorstudioglobal.com`. Crealo, esperá
un par de minutos a que propague (`dig TXT _acme-challenge.mentorstudioglobal.com`) y seguí.

Después descomentá los bloques HTTPS y recargá:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> **Ojo con la renovación:** un wildcard emitido con `--manual` **no se renueva solo**;
> cada 90 días habría que repetir el TXT a mano. Para automatizarlo hace falta el
> plugin DNS de tu proveedor (`certbot-dns-cloudflare`, `certbot-dns-digitalocean`, etc.).
> Si tu DNS está en Cloudflare:
> ```bash
> sudo apt install python3-certbot-dns-cloudflare
> sudo certbot certonly --dns-cloudflare \
>   --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
>   -d mentorstudioglobal.com -d "*.mentorstudioglobal.com"
> ```
> Poné un recordatorio en el calendario si te quedás con la versión manual.

### Dominios personalizados de clientes (plan Academy Executive)

Cuando un cliente guarda su dominio en Configuración & Branding y crea el registro A
hacia el VPS:

```bash
sudo /var/www/mentor-studio/deploy/add-custom-domain.sh escuela-del-cliente.com
```

El script valida el DNS, crea el server block, emite el certificado y activa la
renovación automática (estos sí se renuevan solos porque usan validación HTTP).

---

## 6. Cron del reset mensual de créditos

`vercel.json` **no se ejecuta en un VPS**. Sin este paso, los clientes pagan el
segundo mes y no reciben créditos nuevos.

```bash
chmod +x /var/www/mentor-studio/deploy/*.sh
sudo crontab -e
```

Agregar:

```
0 * * * * /var/www/mentor-studio/deploy/cron-ai-credit-reset.sh
```

Probarlo a mano antes de confiar en él:

```bash
sudo /var/www/mentor-studio/deploy/cron-ai-credit-reset.sh
cat /var/log/mentor-studio/cron.log
```

---

## 7. Webhook de Stripe

En el panel de Stripe → Developers → Webhooks, endpoint:

```
https://mentorstudioglobal.com/api/webhooks/stripe
```

Copiá el `whsec_...` al `.env.production.local` y reiniciá (`pm2 reload mentor-studio`).
Sin esto, los pagos se cobran pero **la suscripción nunca se activa**.

---

## 8. Despliegues posteriores

```bash
cd /var/www/mentor-studio && ./deploy/deploy.sh
```

---

## 9. Copias de seguridad

Dos cosas que no están en el repositorio y se pierden si no las respaldás:

1. **La base de datos**: backups automáticos de Supabase (verificá que estén activos
   en tu plan; el gratuito los tiene limitados).
2. **Los archivos subidos**: `/var/www/mentor-studio-uploads`. Ejemplo de respaldo diario:
   ```
   30 3 * * * tar -czf /var/backups/uploads-$(date +\%F).tar.gz /var/www/mentor-studio-uploads
   ```

---

## 10. Comprobaciones finales

- [ ] `https://mentorstudioglobal.com` carga con candado y sin avisos
- [ ] `https://una-academia.mentorstudioglobal.com` muestra el portal de esa academia
- [ ] `/api/health` responde `{"status":"ok"}`
- [ ] Registro → pago con Stripe → la academia queda activa
- [ ] Subir un logo de más de 2MB da error claro, y uno válido se ve tras recargar
- [ ] Llega el email de invitación a un alumno
- [ ] `sudo crontab -l` muestra la línea del reset
- [ ] `pm2 list` muestra el proceso `online`; tras `sudo reboot` sigue levantado
- [ ] La API pública de Supabase no devuelve datos:
      `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/User?select=email" -H "apikey: $CLAVE"` → `[]`

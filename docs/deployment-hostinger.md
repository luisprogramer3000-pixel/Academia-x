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
| Cuenta de Payphone Business + Payphone Developer | payphone.app | Aplicación WEB con token y Store ID |
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
# Dirección pública oficial (con www). nginx redirige mentorstudioglobal.com → www.
NEXT_PUBLIC_APP_URL="https://www.mentorstudioglobal.com"
# Dominio BASE, SIN www: con él se reconocen los subdominios de las academias
# (academia.mentorstudioglobal.com). El middleware ya acepta www por su cuenta.
NEXT_PUBLIC_APP_HOST="mentorstudioglobal.com"

# Supabase — connection_limit=10 porque es un proceso permanente, no serverless.
# connect_timeout/pool_timeout: Supabase tarda a veces ~6 s en abrir una conexión
# y el límite por defecto de Prisma (5 s) daría errores intermitentes.
DATABASE_URL="postgresql://...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=10&connect_timeout=15&pool_timeout=20"
DIRECT_URL="postgresql://...pooler.supabase.com:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."

# Archivos subidos en Supabase Storage (bucket privado). Clave SECRETA: nunca con NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."

# Secretos (generar valores nuevos, nunca reutilizar los de desarrollo)
JWT_SECRET="..."
CRON_SECRET="..."
# Los certificados se firman con CERTIFICATE_SIGNING_SECRET o, si falta, con JWT_SECRET.
# Cambiar cualquiera de los dos después invalida la verificación de los ya emitidos.

# Payphone (Payphone Developer → aplicación WEB → Credenciales)
PAYPHONE_TOKEN="..."
PAYPHONE_STORE_ID="..."
# Cobro automático: solo cuando Payphone apruebe la tokenización (ver sección 7.3)
# PAYPHONE_TOKENIZATION_ENABLED="true"
# PAYPHONE_CODING_PASSWORD="..."
# Clave para cifrar las tarjetas guardadas (32+ caracteres; no cambiarla después)
PAYMENT_ENCRYPTION_KEY="..."

# IA
AI_PROVIDER="openai"
OPENAI_API_KEY="sk-proj-..."
OPENAI_MODEL="gpt-4o-mini"
AI_MODEL_PREMIUM="gpt-4o"
# Imágenes de las clases y las presentaciones (fal.ai)
FAL_KEY="..."

# Biblioteca de la plataforma (MongoDB Atlas). En Atlas → Network Access hay que
# permitir la IP del VPS, o la biblioteca mostrará "no está disponible".
MONGODB_URI="mongodb+srv://..."

# Soporte (lo muestra la página de Soporte VIP)
SUPPORT_EMAIL="info@mentorstudioglobal.com"

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

# Biblioteca: índices de MongoDB y prueba de GridFS (seguro repetirlo)
npx tsx scripts/setup-library.ts
```

El proceso de PM2 se llama **`mentor-studio-global`** (ver `deploy/ecosystem.config.js`):
`pm2 logs mentor-studio-global`, `pm2 reload mentor-studio-global`.

> La base de datos y la biblioteca son las mismas que en desarrollo: las academias,
> la cuenta del administrador y los 56 archivos de la biblioteca ya están ahí.
> La carpeta `public/archivos de power point para la biblioteca` **no** se sube al
> servidor (está en `.gitignore`): sus archivos ya están en la biblioteca.

---

## 5. nginx y SSL

```bash
sudo cp deploy/nginx/mentor-studio.conf /etc/nginx/sites-available/mentor-studio
sudo nano /etc/nginx/sites-available/mentor-studio
```

Comentá los dos bloques `server` de HTTPS (los que escuchan en el 443): todavía no existen
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

## 6. Tareas programadas (cron)

`vercel.json` **no se ejecuta en un VPS**. Hay dos tareas:

- **Reset de créditos de IA** (cada hora): sin él, los clientes pagan el segundo mes y
  no reciben créditos nuevos.
- **Vaciado de la papelera** (diario): borra definitivamente lo que lleva más de 30 días
  en la papelera.
- **Renovación de planes** (cada hora): cobra las tarjetas guardadas que vencen y avisa
  a las academias sin cobro automático.

```bash
chmod +x /var/www/mentor-studio/deploy/*.sh
sudo crontab -e
```

Agregar:

```
0 * * * * /var/www/mentor-studio/deploy/cron-ai-credit-reset.sh
30 4 * * * /var/www/mentor-studio/deploy/cron-purge-trash.sh
15 * * * * /var/www/mentor-studio/deploy/cron-subscription-renewals.sh
```

Probarlos a mano antes de confiar en ellos:

```bash
sudo /var/www/mentor-studio/deploy/cron-ai-credit-reset.sh
sudo /var/www/mentor-studio/deploy/cron-purge-trash.sh
sudo /var/www/mentor-studio/deploy/cron-subscription-renewals.sh
cat /var/log/mentor-studio/cron.log      # deben aparecer tres líneas "OK"
```

---

## 7. Payphone (cobros)

Payphone no tiene suscripciones: la plataforma cobra cada periodo con el **botón de
pago** (el cliente paga en el formulario de Payphone y vuelve a la web) y, cuando
Payphone aprueba la **tokenización**, cobra sola la tarjeta guardada al vencer.

### 7.1 Credenciales

1. **Payphone Business** → Usuarios → Crear usuario con rol **Desarrollador**, vinculado a tu tienda.
2. **Payphone Developer** (https://appdeveloper.payphonetodoesposible.com) → crear una aplicación tipo **WEB**:
   - Dominio web: `www.mentorstudioglobal.com`
   - URL de respuesta: `https://www.mentorstudioglobal.com/api/payphone/response`
   - Ambiente: **PRUEBAS** para probar (todo se aprueba, no se cobra nada) y **PRODUCCIÓN** para cobrar.
3. Pestaña **Credenciales** → copiar a las variables:
   - `PAYPHONE_TOKEN` (el token Bearer)
   - `PAYPHONE_STORE_ID`

Los precios de los planes incluyen IVA (15%): la plataforma informa a Payphone la base y el IVA.

### 7.2 Notificación externa (recomendada)

Si el cliente cierra el navegador justo después de pagar, la notificación de Payphone
permite confirmar el pago igual. Hay que solicitarla a Payphone (formulario con RUC y
datos de la empresa; 3 a 5 días hábiles) indicando la URL:

```
https://www.mentorstudioglobal.com/api/payphone/NotificacionPago
```

La plataforma nunca confía solo en el aviso: vuelve a confirmar cada pago con la API de Payphone.

### 7.3 Cobro automático (tokenización)

Requisito de Payphone: el botón de pago tiene que estar **funcionando en producción**.
Después se solicita la tokenización (formulario; 3 a 5 días hábiles). Payphone retiene el
**10% de lo cobrado con tarjetas guardadas durante 6 meses** y solo acepta Visa y Mastercard.

Cuando la aprueben:

```
PAYPHONE_TOKENIZATION_ENABLED="true"
PAYPHONE_CODING_PASSWORD="..."   # Payphone Developer → configuración de la aplicación
```

Desde ese momento, al pagar aparece la casilla para autorizar el cobro automático; las
tarjetas se guardan cifradas (`PAYMENT_ENCRYPTION_KEY`) y el cron de renovaciones las cobra
al vencer (un intento al día, hasta 3). Sin tarjeta guardada, la academia recibe avisos
7, 3 y 1 días antes de vencer y tiene 7 días de gracia.

### 7.4 Prueba

Con la aplicación en **PRUEBAS**: contratá el plan Starter mensual desde una academia de
prueba, comprobá que vuelve a Facturación con el plan activo y que el pago aparece en
`/dashboard/admin/sales`. Después cambiá la aplicación a **PRODUCCIÓN** y repetí con una
tarjeta real (podés anularlo el mismo día en Payphone Business → Ventas → Anular).

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

- [ ] `https://mentorstudioglobal.com` redirige a `https://www.mentorstudioglobal.com`, con candado y sin avisos
- [ ] Iniciar sesión con admin@mentorstudioglobal.com lleva a `/dashboard/admin/sales`
- [ ] La Biblioteca de la plataforma muestra los archivos (MongoDB conectado)
- [ ] El QR de un certificado abre `https://www.mentorstudioglobal.com/verify/...`
- [ ] `https://una-academia.mentorstudioglobal.com` muestra el portal de esa academia
- [ ] `/api/health` responde `{"status":"ok"}`
- [ ] Registro → pago con Payphone → vuelve a Facturación con la academia activa
- [ ] Subir un logo de más de 2MB da error claro, y uno válido se ve tras recargar
- [ ] Llega el email de invitación a un alumno
- [ ] `sudo crontab -l` muestra las tres líneas (créditos, papelera y renovaciones)
- [ ] `pm2 list` muestra el proceso `online`; tras `sudo reboot` sigue levantado
- [ ] La API pública de Supabase no devuelve datos:
      `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/User?select=email" -H "apikey: $CLAVE"` → `[]`

# Despliegue en Hostinger Business (Web App)

Guía para el plan **Business Web Hosting** usando la función **Web App** de hPanel,
que ejecuta la aplicación Next.js con Node.js gestionado.

> Si algún día se migra a VPS (para subdominios automáticos y dominios propios de
> clientes), la guía correspondiente sigue disponible en `deployment-hostinger.md`.

---

## Lo que este hosting puede y no puede hacer

| | |
|---|---|
| ✅ Ejecutar la app | Next.js está soportado como framework de backend |
| ✅ Node.js 20 (hasta 24) | Seleccionable al crear el Web App |
| ✅ Build automático desde GitHub | En cada push |
| ✅ Variables de entorno | Sección propia en el panel |
| ✅ Subdominios | Hasta 100, **creados a mano**, con certificado individual |
| ❌ SSL wildcard | Solo en VPS. Por eso cada academia usa `/a/su-slug` |
| ❌ Acceso SSH | Las migraciones de Prisma se ejecutan desde tu equipo |

Cada academia se publica en `https://www.mentorstudioglobal.com/a/su-slug`, cubierto
por el certificado del dominio principal. Si un cliente premium quiere subdominio,
se le crea a mano en hPanel y se le emite su certificado.

---

## 1. Subir el código a GitHub

El despliegue se hace desde un repositorio. Desde la carpeta del proyecto:

```bash
git add -A
git commit -m "Preparado para despliegue en Hostinger"
git remote add origin https://github.com/TU-USUARIO/mentor-studio-global.git
git push -u origin main
```

**El repositorio debe ser privado.** Aunque los `.env` están en `.gitignore`,
es código de negocio.

---

## 2. Crear el Web App en hPanel

hPanel → **Websites** → **Add Website** → **Web App**:

| Campo | Valor |
|---|---|
| Framework | Next.js |
| Repositorio | el de GitHub |
| Rama | `main` |
| Versión de Node | 20 (o 22) |
| Gestor de paquetes | npm |
| Comando de build | `npm run build` |
| Comando de inicio | `npm start` |
| Dominio | mentorstudioglobal.com (con `www` como alias) |

`npm install` se ejecuta solo, y con él el `postinstall` que genera el cliente de
Prisma. No hay que hacer nada más.

**www.** La dirección oficial es `https://www.mentorstudioglobal.com`. Los dos
nombres (`mentorstudioglobal.com` y `www.`) tienen que apuntar al Web App y tener
certificado SSL; la propia aplicación redirige el que no lleva www al que sí
(lo decide `NEXT_PUBLIC_APP_URL`), así que no hace falta crear redirecciones en hPanel.

---

## 3. Variables de entorno (ANTES del primer despliegue)

Si faltan al compilar, el build falla o la app arranca a medias. Se pegan en la
sección **Environment Variables** del Web App, tomando los valores de
`.env.production` del proyecto:

```
NODE_ENV                              production
NEXT_PUBLIC_APP_URL                   https://www.mentorstudioglobal.com
NEXT_PUBLIC_APP_HOST                  mentorstudioglobal.com      ← SIN www (dominio base)
DATABASE_URL                          (Supabase, pooler 6543, pgbouncer=true&connection_limit=10&connect_timeout=15&pool_timeout=20)
DIRECT_URL                            (Supabase, puerto 5432)
JWT_SECRET                            (el generado, 32+ caracteres)
CRON_SECRET                           (el generado)
NEXT_PUBLIC_SUPABASE_URL              https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY             sb_secret_...   ← SECRETA, nunca con NEXT_PUBLIC_
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY    pk_live_...
STRIPE_SECRET_KEY                     sk_live_...
STRIPE_WEBHOOK_SECRET                 whsec_...
STRIPE_PRICE_STARTER_MONTHLY          price_...
STRIPE_PRICE_STARTER_YEARLY           price_...
STRIPE_PRICE_PRO_MONTHLY              price_...
STRIPE_PRICE_PRO_YEARLY               price_...
STRIPE_PRICE_ACADEMY_MONTHLY          price_...
STRIPE_PRICE_ACADEMY_YEARLY           price_...
AI_PROVIDER                           openai
OPENAI_API_KEY                        sk-proj-...
OPENAI_MODEL                          gpt-4o-mini
AI_MODEL_PREMIUM                      gpt-4o
FAL_KEY                               (fal.ai: imágenes de clases y presentaciones)
MONGODB_URI                           mongodb+srv://...   (Biblioteca de la plataforma)
RESEND_API_KEY                        re_...
EMAIL_FROM                            Mentor Studio Global <no-reply@mentorstudioglobal.com>
RATE_LIMIT_PROVIDER                   upstash
UPSTASH_REDIS_REST_URL                https://...upstash.io
UPSTASH_REDIS_REST_TOKEN              ...
SUPPORT_EMAIL                         info@mentorstudioglobal.com
SUPPORT_WHATSAPP                      971566518210
SUPPORT_RESPONSE_HOURS                24
UPLOADS_DIR                           /home/uXXXXXXXX/uploads   ← ver paso 4
```

`NEXT_PUBLIC_APP_HOST` va **sin** www: es el dominio base con el que se reconocen los
subdominios de las academias. La dirección con www va en `NEXT_PUBLIC_APP_URL`.

**MongoDB Atlas → Network Access:** permitir la IP de salida del hosting (o
`0.0.0.0/0` si Hostinger no da una IP fija; la conexión sigue protegida por usuario y
contraseña). Si no, la Biblioteca muestra "no está disponible".

**No subir `.env.local` al repositorio ni al servidor**: Next.js le da prioridad
sobre todo lo demás y dejaría la app en modo desarrollo con Stripe de pruebas.

---

## 4. Carpeta de archivos subidos

Con `SUPABASE_SERVICE_ROLE_KEY` definida, los archivos subidos (logos, materiales,
imágenes de clase, comprobantes) se guardan en **Supabase Storage** y este paso es
solo un respaldo. Sin ella se guardan en disco: si viven dentro del proyecto,
**cada redespliegue desde GitHub los borra**.

1. hPanel → **Administrador de archivos**, y en la raíz del usuario (algo como
   `/home/u123456789`) crear una carpeta `uploads`.
2. Copiar esa ruta absoluta y ponerla en `UPLOADS_DIR`.

Los archivos no se sirven desde `public/`, sino a través de `/api/uploads/...`,
así que la carpeta puede estar donde sea mientras la app pueda escribir en ella.

---

## 5. Migraciones de la base de datos

No hay SSH, así que se ejecutan desde tu equipo contra Supabase (es la misma base
que usa producción):

```bash
npx prisma migrate deploy
npx tsx scripts/setup-library.ts     # bucket e índices de la Biblioteca (seguro repetirlo)
```

Esto se repite cada vez que un despliegue incluya migraciones nuevas. Conviene
hacerlo **antes** de desplegar el código que las necesita.

---

## 6. Cron del reset mensual de créditos

Sin esto, los clientes pagan el segundo mes y no reciben créditos nuevos.

**Opción A — Cron de hPanel** (Avanzado → Cron Jobs), cada hora:

```
curl -fsS -m 120 -H "Authorization: Bearer TU_CRON_SECRET" "https://www.mentorstudioglobal.com/api/cron/ai-credit-reset?limit=200"
```

**Opción B — Servicio externo** (cron-job.org, UptimeRobot): misma URL, con la
cabecera `Authorization: Bearer TU_CRON_SECRET`. Útil si el cron de hPanel no
permite cabeceras personalizadas; en ese caso también sirve `x-cron-secret`.

El endpoint es idempotente: solo procesa las academias cuyo ciclo ya venció, así
que ejecutarlo de más no duplica créditos.

### Cron de la papelera (una vez al día)

Elimina definitivamente los cursos, lecciones y recursos que llevan más de 30
días en la papelera. Mismo secreto, por ejemplo a las 04:30:

```
curl -fsS -m 120 -H "Authorization: Bearer TU_CRON_SECRET" "https://www.mentorstudioglobal.com/api/cron/purge-trash"
```

Si falta, no se pierde nada: la papelera de cada academia también se purga sola
al abrirla; el cron solo cubre a las academias que nunca la abren.

---

## 7. Stripe en modo real (live)

Todo con el interruptor **"Modo de prueba" apagado** en Stripe: lo creado en modo de
prueba no existe en modo real.

**Claves** (Developers → API keys): `pk_live_...` → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`,
`sk_live_...` → `STRIPE_SECRET_KEY`.

**Los 6 precios** (Product catalog → 3 productos con 2 precios recurrentes en USD):

| Producto | Mensual | Anual | Variables |
|---|---|---|---|
| Starter | 29,00 USD | 278,40 USD | `STRIPE_PRICE_STARTER_MONTHLY` / `_YEARLY` |
| Professional VIP | 79,00 USD | 758,40 USD | `STRIPE_PRICE_PRO_MONTHLY` / `_YEARLY` |
| Academy Executive | 199,00 USD | 1910,40 USD | `STRIPE_PRICE_ACADEMY_MONTHLY` / `_YEARLY` |

Tienen que coincidir con `src/modules/billing/plans.ts`. Los paquetes de créditos de
IA no necesitan precios en Stripe.

**Webhook** (Developers → Webhooks), endpoint con www:

```
https://www.mentorstudioglobal.com/api/webhooks/stripe
```

Eventos que el código procesa (conviene marcarlos todos):

```
checkout.session.completed              customer.subscription.created
checkout.session.async_payment_succeeded customer.subscription.updated
invoice.paid                            customer.subscription.deleted
invoice.payment_failed                  customer.subscription.paused
                                        customer.subscription.resumed
```

El `whsec_` que genera Stripe va en `STRIPE_WEBHOOK_SECRET`. **Test y Live tienen
endpoints y secretos distintos.** Sin el webhook, los pagos se cobran pero la
suscripción no se activa y el panel "Ventas y biblioteca" no se entera de nada.

**Prueba real:** contratá el plan Starter mensual con una tarjeta tuya, comprobá que
la academia queda activa y aparece en `/dashboard/admin/sales`, y reembolsalo y
cancelalo desde Stripe.

---

## 8. Comprobaciones

- [ ] `https://mentorstudioglobal.com` redirige a `https://www.mentorstudioglobal.com`, con candado
- [ ] `/api/health` responde `{"status":"ok","db":"ok"}`
- [ ] `/a/jl-global-school` muestra la academia VIP de verificación
- [ ] Iniciar sesión con admin@mentorstudioglobal.com lleva a `/dashboard/admin/sales`
- [ ] La Biblioteca de la plataforma muestra los archivos (MongoDB conectado)
- [ ] Registro → pago con Stripe → la academia queda activa
- [ ] Subir un logo, recargar, y que siga viéndose (confirma `UPLOADS_DIR`)
- [ ] Llega el email de invitación a un alumno
- [ ] Los dos cron (créditos y papelera) aparecen ejecutados en su registro

---

## Subdominio para un cliente concreto (opcional)

1. hPanel → **Subdominios** → crear `sucliente` (tope: 100).
2. Apuntarlo al mismo Web App.
3. Emitir su certificado SSL gratuito desde el panel.

El middleware ya traduce `sucliente.mentorstudioglobal.com` a `/a/sucliente`, así
que no hay que tocar código.

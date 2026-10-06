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

Cada academia se publica en `https://mentorstudioglobal.com/a/su-slug`, cubierto
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
| Dominio | mentorstudioglobal.com |

`npm install` se ejecuta solo, y con él el `postinstall` que genera el cliente de
Prisma. No hay que hacer nada más.

---

## 3. Variables de entorno (ANTES del primer despliegue)

Si faltan al compilar, el build falla o la app arranca a medias. Se pegan en la
sección **Environment Variables** del Web App, tomando los valores de
`.env.production` del proyecto:

```
NODE_ENV                              production
NEXT_PUBLIC_APP_URL                   https://mentorstudioglobal.com
NEXT_PUBLIC_APP_HOST                  mentorstudioglobal.com
DATABASE_URL                          (Supabase, pooler 6543, connection_limit=10)
DIRECT_URL                            (Supabase, puerto 5432)
JWT_SECRET                            (el generado, 32+ caracteres)
CRON_SECRET                           (el generado)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY    pk_...
STRIPE_SECRET_KEY                     sk_...
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

**No subir `.env.local` al repositorio ni al servidor**: Next.js le da prioridad
sobre todo lo demás y dejaría la app en modo desarrollo con Stripe de pruebas.

---

## 4. Carpeta de archivos subidos

Los logos y materiales que suben los profesores se guardan en disco. Si viven
dentro del proyecto, **cada redespliegue desde GitHub los borra**.

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
```

Esto se repite cada vez que un despliegue incluya migraciones nuevas. Conviene
hacerlo **antes** de desplegar el código que las necesita.

---

## 6. Cron del reset mensual de créditos

Sin esto, los clientes pagan el segundo mes y no reciben créditos nuevos.

**Opción A — Cron de hPanel** (Avanzado → Cron Jobs), cada hora:

```
curl -fsS -m 120 -H "Authorization: Bearer TU_CRON_SECRET" "https://mentorstudioglobal.com/api/cron/ai-credit-reset?limit=200"
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
curl -fsS -m 120 -H "Authorization: Bearer TU_CRON_SECRET" "https://mentorstudioglobal.com/api/cron/purge-trash"
```

Si falta, no se pierde nada: la papelera de cada academia también se purga sola
al abrirla; el cron solo cubre a las academias que nunca la abren.

---

## 7. Webhook de Stripe

En Stripe → Developers → Webhooks, endpoint:

```
https://mentorstudioglobal.com/api/webhooks/stripe
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
endpoints y secretos distintos.**

---

## 8. Comprobaciones

- [ ] `https://mentorstudioglobal.com` carga la landing con candado
- [ ] `/api/health` responde `{"status":"ok","db":"ok"}`
- [ ] `/a/jl-institute` muestra la academia de demostración
- [ ] Registro → pago con Stripe → la academia queda activa
- [ ] Subir un logo, recargar, y que siga viéndose (confirma `UPLOADS_DIR`)
- [ ] Llega el email de invitación a un alumno
- [ ] El cron aparece ejecutado en su registro

---

## Subdominio para un cliente concreto (opcional)

1. hPanel → **Subdominios** → crear `sucliente` (tope: 100).
2. Apuntarlo al mismo Web App.
3. Emitir su certificado SSL gratuito desde el panel.

El middleware ya traduce `sucliente.mentorstudioglobal.com` a `/a/sucliente`, así
que no hay que tocar código.

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
PAYPHONE_TOKEN                        (Payphone Developer → Credenciales)
PAYPHONE_STORE_ID                     (Payphone Developer → Credenciales)
PAYMENT_ENCRYPTION_KEY                (32+ caracteres; cifra las tarjetas guardadas)
# Solo cuando Payphone apruebe la tokenización (sección 7):
# PAYPHONE_TOKENIZATION_ENABLED       true
# PAYPHONE_CODING_PASSWORD            (Payphone Developer)
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
sobre todo lo demás y dejaría la app en modo desarrollo con los pagos simulados.

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

### Cron de renovación de planes (cada hora)

Cobra las tarjetas guardadas que vencen (cuando la tokenización esté aprobada) y
avisa a las academias sin cobro automático 7, 3 y 1 días antes de vencer:

```
curl -fsS -m 170 -H "Authorization: Bearer TU_CRON_SECRET" "https://www.mentorstudioglobal.com/api/cron/subscription-renewals"
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

Con la aplicación en **PRUEBAS**: contrata el plan Starter mensual desde una academia de
prueba, comprueba que vuelve a Facturación con el plan activo y que el pago aparece en
`/dashboard/admin/sales`. Después cambia la aplicación a **PRODUCCIÓN** y repite con una
tarjeta real (puedes anularlo el mismo día en Payphone Business → Ventas → Anular).

---

## 8. Comprobaciones

- [ ] `https://mentorstudioglobal.com` redirige a `https://www.mentorstudioglobal.com`, con candado
- [ ] `/api/health` responde `{"status":"ok","db":"ok"}`
- [ ] `/a/jl-global-school` muestra la academia VIP de verificación
- [ ] Iniciar sesión con admin@mentorstudioglobal.com lleva a `/dashboard/admin/sales`
- [ ] La Biblioteca de la plataforma muestra los archivos (MongoDB conectado)
- [ ] Registro → pago con Payphone → vuelve a Facturación con la academia activa
- [ ] Subir un logo, recargar, y que siga viéndose (confirma `UPLOADS_DIR`)
- [ ] Llega el email de invitación a un alumno
- [ ] Los tres cron (créditos, papelera y renovaciones) aparecen ejecutados en su registro

---

## Subdominio para un cliente concreto (opcional)

1. hPanel → **Subdominios** → crear `sucliente` (tope: 100).
2. Apuntarlo al mismo Web App.
3. Emitir su certificado SSL gratuito desde el panel.

El middleware ya traduce `sucliente.mentorstudioglobal.com` a `/a/sucliente`, así
que no hay que tocar código.

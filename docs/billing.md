# Facturación y pagos (Payphone)

## 1. Qué se cobra

1. **Planes de la plataforma**: cada academia paga Starter, Professional VIP o Academy Executive, mensual o anual (20% de descuento). Precios en `src/modules/billing/plans.ts`, en USD con **IVA del 15% incluido**.
2. **Paquetes de créditos de IA** (top-ups): `src/modules/ai/ai.topup-catalog.ts`.

La venta de cursos de cada academia a sus alumnos no pasa por la plataforma: cada curso tiene un enlace de pago externo (Payphone, PayPal…).

## 2. Payphone no tiene suscripciones

Payphone ofrece un **botón de pago** y, con aprobación previa, **tokenización** de tarjetas. Su documentación es explícita: *"La tokenización de Payphone NO es un sistema de pagos recurrentes"*. La recurrencia la implementa la plataforma:

- `Subscription` guarda el plan y `currentPeriodEnd`. Cada pago aprobado lo extiende (`BillingService.applySubscriptionPayment`):
  - mismo plan y modalidad con acceso vigente → se suma un periodo al vencimiento actual;
  - academia nueva, cambio de plan o de modalidad → el periodo empieza hoy.
- `externalId`: `pp_<tenantId>` (Payphone), `sub_internal_<tenantId>` (cortesía, sin vencimiento práctico), `sub_simulated_<tenantId>` (desarrollo sin Payphone).
- Acceso: estado `active` hasta `currentPeriodEnd`; después `past_due` con **7 días de gracia** (`PAST_DUE_GRACE_DAYS`); luego `canceled`.

## 3. Botón de pago

`src/lib/payphone.ts` (cliente HTTP) y `src/modules/billing/payphone-payment.service.ts` (lógica).

1. `startSubscriptionPayment` / `startTopupPayment` crean un `Payment` en `PENDING` con un `clientTransactionId` propio (15 caracteres: `S`/`T`/`R` + 14 aleatorios) y llaman a **Prepare**. El importe se informa como base gravada + IVA (`splitIva`).
2. El cliente paga en el formulario de Payphone (no puede ir en iframe).
3. Payphone lo devuelve a `GET /api/payphone/response?id&clientTransactionId[&ctoken]`.
4. `handleReturn` llama a **Confirm** (obligatorio en 5 minutos; si no, Payphone anula el cobro), comprueba que el identificador y el importe coincidan, marca el pago `APPROVED` **una sola vez** (`updateMany ... status != APPROVED`) y lo aplica: activa/extiende el plan o acredita los créditos (`CreditPurchaseService.fulfillPurchase`).
5. `POST /api/payphone/NotificacionPago` (notificación externa, si Payphone la habilita) entra por el mismo `handleReturn`: el aviso no viene firmado, así que nunca se aplica sin volver a confirmar con la API.

## 4. Cobro automático (tokenización)

Solo con `PAYPHONE_TOKENIZATION_ENABLED=true` y `PAYPHONE_CODING_PASSWORD` (cuando Payphone apruebe la cuenta):

- Al pagar, el cliente marca su **consentimiento** (`Payment.saveCard`). Si Payphone devuelve `ctoken`, se guarda en `PaymentCard` **cifrado** (`src/lib/secret-box.ts`, AES-256-GCM con `PAYMENT_ENCRYPTION_KEY`) junto con los datos del titular que exige Payphone (nombre, email, teléfono, documento).
- `GET /api/cron/subscription-renewals` (cada hora) → `renewDueSubscriptions`:
  - desde 1 día antes de vencer cobra la tarjeta con `/api/transaction/web` (síncrono), un intento al día, hasta 3;
  - sin tarjeta, con el cobro automático desactivado o tras 3 fallos: avisos por el panel y por correo 7, 3 y 1 días antes y al vencer;
  - pasada la gracia marca la suscripción como `canceled`.
- La academia puede desactivar el cobro automático o quitar la tarjeta en Facturación.

## 5. Desarrollo

Sin `PAYPHONE_TOKEN` / `PAYPHONE_STORE_ID` y fuera de producción, los pagos se **simulan** (se aprueban al instante, sin crear `Payment`). En producción, la falta de credenciales es un error (`isMockPaymentsMode` lanza). La aplicación de Payphone en ambiente **PRUEBAS** aprueba todo sin cobrar: es la forma de probar el flujo real.

## 6. Panel del administrador

`/dashboard/admin/sales` (`sales-analytics.service.ts`): MRR estimado de las suscripciones `pp_` vigentes, lo **cobrado** por mes (pagos `APPROVED`), estados, renovaciones próximas y si cada academia tiene cobro automático o manual.

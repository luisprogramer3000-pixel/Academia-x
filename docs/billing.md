# Facturación y pagos (Payphone)

## 1. Qué se cobra

1. **Planes de la plataforma**: cada academia paga Starter, Professional VIP o Academy Executive, mensual o anual (20% de descuento). Precios en `src/modules/billing/plans.ts`, en USD con **IVA del 15% incluido**.
2. **Paquetes de créditos de IA** (top-ups): `src/modules/ai/ai.topup-catalog.ts`.

La venta de cursos de cada academia a sus alumnos no pasa por la plataforma: cada curso tiene un enlace de pago externo (Payphone, PayPal…).

## 2. Dos caminos en Payphone

```text
PAYPHONE
├── Cajita / botón (Prepare → Confirm)   → créditos de IA, pagos puntuales y Academy Executive anual (2 pagos)
└── Links de Suscripción (PayPhone Business, recurrencia gestionada por PayPhone)
    ├── STARTER_MONTHLY            → PAYPHONE_SUB_STARTER_MONTHLY
    ├── STARTER_ANNUAL             → PAYPHONE_SUB_STARTER_ANNUAL
    ├── PROFESSIONAL_VIP_MONTHLY   → PAYPHONE_SUB_PRO_MONTHLY
    ├── PROFESSIONAL_VIP_ANNUAL    → PAYPHONE_SUB_PRO_ANNUAL
    └── ACADEMY_EXECUTIVE_MONTHLY  → PAYPHONE_SUB_ACADEMY_MONTHLY
```

Ver la sección 7. Lo que sigue (secciones 2–4) aplica a la Cajita y a las suscripciones antiguas pagadas con botón.

## 2b. La Cajita no tiene suscripciones

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

## 7. Links de Suscripción de PayPhone (5 planes recurrentes)

Archivos: `subscription-plan-codes.ts` (códigos y mapeo, apto para cliente), `payphone-subscription-links.ts` (lee las variables `PAYPHONE_SUB_*`, solo servidor), `payphone-subscription-link.service.ts` (lógica), `POST /api/payphone/subscription-checkout`.

1. **Contratar**: el panel envía solo `{ planCode }`. El servidor valida sesión (OWNER), código y variable; registra un `Payment` `PENDING` con `method = "LINK"` (identificador interno `L…`) y devuelve `{ checkoutUrl }`. Si falta la variable: 503 «Este método de pago no está disponible temporalmente.» y el error se registra en el servidor. Mismo plan ya activo por link: 409. Un intento pendiente del mismo plan se reutiliza 24 h.
2. **Redirigir no activa nada.** Estados: `PENDING` (Payment LINK pendiente, sin fila de Subscription) → `active` → `past_due` (vencido, 7 días de gracia) → `canceled`.
3. **Primer cobro**: PayPhone envía `NotificacionPago` (solo notifica pagos **aprobados**). Si el `ClientTransactionId` no es de un pago del botón, se **verifica** con `GET /api/Sale/{TransactionId}` (nunca se confía en el aviso) y se casa así: importe = precio de uno de los 5 planes **y** correo del pagador = correo del usuario que inició el intento (últimos 7 días). Si hay una sola academia posible, el Payment pasa a `APPROVED` y `applySubscriptionPayment` activa el plan. Si no hay coincidencia o es ambigua, se registra `[payphone] … Revisar a mano` en el log y no se activa nada.
4. **Renovaciones**: si PayPhone también notifica cada cobro recurrente, se registra un nuevo Payment LINK aprobado (idempotente por `payphoneTransactionId`) y se suma un periodo, siempre que la academia siga con ese plan por link.
5. **Cron**: `renewDueSubscriptions` nunca cobra ni recuerda renovar a mano un plan por link. Si vence sin notificación de renovación, pasa a `past_due` y se avisa una vez; tras la gracia, `canceled`.
6. **Cambio de plan** con un link activo: se permite (el panel advierte), el nuevo plan empieza desde su primer cobro, pero **la suscripción anterior debe cancelarse en PayPhone** (no hay API documentada para hacerlo desde aquí).

Requisitos: `PAYPHONE_TOKEN` (para consultar la venta), la notificación externa habilitada por PayPhone apuntando a `https://<dominio>/api/payphone/NotificacionPago`, y el importe de cada link igual al precio interno (`plans.ts`).

**No documentado por PayPhone (pendiente de confirmar con su soporte)**: eventos de cancelación, rechazo o mora de una suscripción; si los cobros recurrentes generan `NotificacionPago`; si los links aceptan un parámetro propio (p. ej. referencia) para identificar la academia sin depender del correo; si `GET /api/Sale/{id}` devuelve las ventas de links de PayPhone Business con el token de la aplicación.

### Academy Executive anual en dos pagos (Cajita, sin renovación automática)

PayPhone no admite cobros de más de USD 1,000 (`PAYPHONE_MAX_CHARGE_CENTS`) y el plan cuesta 1,910.40, así que `chargeInstallments` lo divide en **dos pagos de 955.20 con la Cajita**. `Payment.installment` guarda la parte (1 o 2). No usa Links de Suscripción.

1. **Día 1**: «Contratar» o «Renovar» cobra la parte 1. Al confirmarse, el plan queda activo con **acceso provisional de 3 días** (`PROVISIONAL_ACCESS_DAYS`), salvo que ya tuviera un periodo pagado más largo (renovación anticipada).
2. **Día 2** (24 h después, `SECOND_INSTALLMENT_DELAY_HOURS`): el mismo botón cobra la parte 2. Antes de las 24 h muestra la hora en que se habilita. Facturación enseña «Pagar segunda parte» y el cron horario avisa por panel y correo (y lo repite a las 48 h).
3. **Parte 2 confirmada**: un año desde el pago de la parte 1; si era una renovación con acceso vigente, un año más sobre el vencimiento que tenía.
4. **Renovación**: manual. El cron avisa 7, 3 y 1 días antes y al vencer, como cualquier plan de la Cajita; el cliente repite parte 1 y parte 2. Sin cobro automático con tarjeta guardada (supera el máximo por cobro).
5. Sin parte 2 en 10 días (`SECOND_INSTALLMENT_WINDOW_DAYS`), el siguiente pago vuelve a ser la parte 1. El acceso termina tras los 3 días provisionales más los 7 de gracia.

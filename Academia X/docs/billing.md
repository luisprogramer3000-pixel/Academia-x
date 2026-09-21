# ARQUITECTURA DE FACTURACIÓN Y PAGOS (BILLING) - ACADEMIA X

## 1. Modelo Doble de Pagos

El sistema contempla dos flujos de pago desacoplados:

1. **SaaS Subscriptions (B2B)**: Pago mensual/anual de la academia a la plataforma (Planes Starter, Professional, Academy).
2. **Student Course Sales (B2C / B2B2C)**: Cobro de las academias a los estudiantes por la compra de cursos individuales o membresías de academia (vía Stripe Connect / Checkout).

---

## 2. Integración de Stripe Checkout & Webhooks

- La aplicación no guarda tarjetas ni información bancaria confidencial.
- Las compras y suscripciones se inician vía Stripe Checkout Sessions.
- Las actualizaciones de estado (e.g. `customer.subscription.updated`, `checkout.session.completed`) se procesan vía **Stripe Webhooks** con verificación de firma cryptographic HTTP.
- Los Webhooks son **Idempotentes**: Si se recibe el mismo webhook múltiples veces, el worker verifica el `eventId` procesado previamente antes de alterar la DB.

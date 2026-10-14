-- Cobros con Payphone en lugar de Stripe.
--
-- Payphone no tiene suscripciones: cada pago aprobado (botón de pago o tarjeta
-- tokenizada) extiende Subscription.currentPeriodEnd. La suscripción conserva
-- sus filas: stripeSubscriptionId pasa a llamarse externalId (sin perder datos,
-- p. ej. "sub_internal_<tenantId>" de la academia de cortesía).

-- Nuevos avisos de suscripción
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWAL_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PAYMENT_FAILED';

-- Tenant: ya no hay cliente de Stripe
DROP INDEX IF EXISTS "Tenant_stripeCustomerId_key";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "stripeCustomerId";

-- Subscription: identificador genérico y renovación automática
ALTER TABLE "Subscription" RENAME COLUMN "stripeSubscriptionId" TO "externalId";
ALTER INDEX "Subscription_stripeSubscriptionId_key" RENAME TO "Subscription_externalId_key";
ALTER TABLE "Subscription"
  DROP COLUMN IF EXISTS "stripeCustomerId",
  DROP COLUMN IF EXISTS "stripePriceId",
  ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "renewalAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastRenewalAttemptAt" TIMESTAMPTZ(3);

-- Registro de eventos de Stripe: ya no se usa
DROP TABLE IF EXISTS "StripeEvent";

-- Pagos con Payphone
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'BUTTON',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "planId" TEXT,
    "billingInterval" "BillingInterval",
    "topupPurchaseId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "clientTransactionId" TEXT NOT NULL,
    "payphoneTransactionId" INTEGER,
    "authorizationCode" TEXT,
    "cardBrand" TEXT,
    "lastDigits" TEXT,
    "saveCard" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Tarjeta tokenizada por academia (token y titular cifrados por la aplicación)
CREATE TABLE "PaymentCard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tokenEncrypted" TEXT NOT NULL,
    "holderEncrypted" TEXT NOT NULL,
    "cardBrand" TEXT,
    "lastDigits" TEXT,
    "consentAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PaymentCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_topupPurchaseId_key" ON "Payment"("topupPurchaseId");
CREATE UNIQUE INDEX "Payment_clientTransactionId_key" ON "Payment"("clientTransactionId");
CREATE UNIQUE INDEX "Payment_payphoneTransactionId_key" ON "Payment"("payphoneTransactionId");
CREATE INDEX "Payment_tenantId_createdAt_idx" ON "Payment"("tenantId", "createdAt");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE UNIQUE INDEX "PaymentCard_tenantId_key" ON "PaymentCard"("tenantId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentCard" ADD CONSTRAINT "PaymentCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Igual que el resto: cerradas a la API pública de Supabase (Prisma no se ve afectado)
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentCard" ENABLE ROW LEVEL SECURITY;

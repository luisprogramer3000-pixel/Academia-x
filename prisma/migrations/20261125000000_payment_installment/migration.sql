-- Plan cobrado en dos partes (Academy Executive anual: 2 × 955.20 USD, porque
-- PayPhone no admite cobros de más de USD 1,000). NULL = pago normal; 1 o 2 = parte.
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "installment" INTEGER;

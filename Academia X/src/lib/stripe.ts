import crypto from "crypto";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * Indica si Stripe está configurado (clave secreta presente).
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Modo de pagos simulado: solo permitido fuera de producción y sin clave de Stripe.
 * En producción, la ausencia de STRIPE_SECRET_KEY es un error de configuración.
 */
export function isMockPaymentsMode(): boolean {
  if (isStripeConfigured()) return false;
  if (process.env.NODE_ENV === "production") {
    throw new Error("STRIPE_SECRET_KEY no está configurada en producción.");
  }
  return true;
}

/**
 * Cliente singleton del SDK oficial de Stripe.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY no está configurada.");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: "2025-02-24.acacia",
      appInfo: { name: "Academia X" },
    });
  }
  return stripeClient;
}

export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export interface StripeSignatureVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
}

export interface VerifyStripeWebhookOptions {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  toleranceSeconds?: number; // Por defecto 300 segundos (5 min). 0 desactiva la validación de tolerancia.
}

/**
 * Valida la firma criptográfica HMAC-SHA256 de un Webhook de Stripe
 * siguiendo la especificación oficial de Stripe (v1 y timestamp),
 * con comparación segura contra ataques de temporización (timingSafeEqual).
 */
export function verifyStripeWebhookSignature(
  options: VerifyStripeWebhookOptions
): StripeSignatureVerificationResult {
  const { rawBody, signatureHeader, secret, toleranceSeconds = 300 } = options;

  if (!secret) {
    return { valid: false, error: "STRIPE_WEBHOOK_SECRET is not configured" };
  }

  if (!signatureHeader) {
    return { valid: false, error: "Missing stripe-signature header" };
  }

  // Stripe envía el header con el formato: t=1612345678,v1=signature1,v1=signature2
  const parts = signatureHeader.split(",").map((p) => p.trim());
  let timestampStr: string | undefined;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") {
      timestampStr = value;
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (!timestampStr) {
    return { valid: false, error: "Invalid stripe-signature header: missing timestamp (t)" };
  }

  if (signatures.length === 0) {
    return { valid: false, error: "Invalid stripe-signature header: missing signature (v1)" };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, error: "Invalid stripe-signature header: malformed timestamp" };
  }

  // Validación de tolerancia de tiempo contra ataques de repetición (Replay Attacks)
  if (toleranceSeconds > 0) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
      return {
        valid: false,
        error: `Timestamp outside the tolerance zone (${Math.abs(nowSeconds - timestamp)}s > ${toleranceSeconds}s)`,
        timestamp,
      };
    }
  }

  // El payload firmado por Stripe es: `${timestamp}.${rawBody}`
  const signedPayload = `${timestampStr}.${rawBody}`;
  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedHmac, "hex");

  // Comparación en tiempo constante (Timing-Safe)
  let signatureMatch = false;
  for (const sig of signatures) {
    try {
      const sigBuffer = Buffer.from(sig, "hex");
      if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        signatureMatch = true;
        break;
      }
    } catch {
      // Ignorar firmas malformadas individuales
    }
  }

  if (!signatureMatch) {
    return { valid: false, error: "Signature mismatch", timestamp };
  }

  return { valid: true, timestamp };
}

/**
 * Utilidad oficial para generar encabezados stripe-signature válidos en pruebas de integración
 */
export function generateStripeTestSignature(params: {
  rawBody: string;
  secret: string;
  timestamp?: number;
}): string {
  const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${params.rawBody}`;
  const hmac = crypto
    .createHmac("sha256", params.secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  return `t=${timestamp},v1=${hmac}`;
}

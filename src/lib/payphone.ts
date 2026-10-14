import crypto from "crypto";

/**
 * Cliente de la API de Payphone (https://docs.payphone.app).
 *
 * - Botón de pago: Prepare → el cliente paga en el formulario de Payphone →
 *   vuelve a responseUrl con ?id&clientTransactionId (y &ctoken si la cuenta
 *   tiene tokenización) → Confirm. Si no se confirma en 5 minutos, Payphone
 *   anula el cobro solo.
 * - Tarjeta guardada (tokenización, requiere aprobación de Payphone): cobro
 *   síncrono con /api/transaction/web.
 *
 * Todos los importes son enteros en centavos. Los precios de Mentor Studio
 * Global incluyen IVA: el total se informa a Payphone como base gravada + IVA.
 *
 * Variables: PAYPHONE_TOKEN y PAYPHONE_STORE_ID (Payphone Developer →
 * aplicación WEB → Credenciales); PAYPHONE_CODING_PASSWORD y
 * PAYPHONE_TOKENIZATION_ENABLED=true solo cuando Payphone apruebe la tokenización.
 */

const API = "https://pay.payphonetodoesposible.com/api";
/** IVA de Ecuador incluido en los precios */
export const IVA_RATE = 0.15;

export function isPayphoneConfigured(): boolean {
  return Boolean(process.env.PAYPHONE_TOKEN && process.env.PAYPHONE_STORE_ID);
}

/**
 * Pagos simulados: solo fuera de producción y sin credenciales de Payphone.
 * En producción, la falta de credenciales es un error de configuración.
 */
export function isMockPaymentsMode(): boolean {
  if (isPayphoneConfigured()) return false;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PAYPHONE_TOKEN y PAYPHONE_STORE_ID no están configurados en producción.");
  }
  return true;
}

/** Payphone aprobó la tokenización para esta cuenta: se ofrece guardar la tarjeta. */
export function isTokenizationEnabled(): boolean {
  return process.env.PAYPHONE_TOKENIZATION_ENABLED === "true" && Boolean(process.env.PAYPHONE_CODING_PASSWORD);
}

/** Total con IVA incluido → base gravada + IVA (en centavos, suman exactamente el total). */
export function splitIva(totalCents: number): { amountWithTax: number; tax: number } {
  const amountWithTax = Math.round(totalCents / (1 + IVA_RATE));
  return { amountWithTax, tax: totalCents - amountWithTax };
}

/**
 * Identificador nuestro ante Payphone: 15 caracteres (el límite más estricto
 * de su documentación). Prefijo: S = plan, T = créditos, R = renovación automática.
 */
export function newClientTransactionId(prefix: "S" | "T" | "R"): string {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(14);
  return prefix + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const token = process.env.PAYPHONE_TOKEN;
  if (!token) throw new Error("PAYPHONE_TOKEN no está configurado.");
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = (data as { message?: string } | null)?.message;
    throw new PayphoneError(message || `Payphone respondió ${res.status}.`, res.status, data);
  }
  return data as T;
}

export class PayphoneError extends Error {
  constructor(message: string, public status: number, public data: unknown) {
    super(message);
    this.name = "PayphoneError";
  }
}

// ─── Botón de pago ───────────────────────────────────────────────────────────

export interface PrepareInput {
  amountCents: number;
  clientTransactionId: string;
  /** Motivo visible en el formulario (máx. 100) */
  reference: string;
  responseUrl: string;
  cancellationUrl: string;
}

export async function preparePayment(input: PrepareInput): Promise<{ paymentId: string; payWithCard: string; payWithPayPhone: string }> {
  const { amountWithTax, tax } = splitIva(input.amountCents);
  return call("/button/Prepare", {
    amount: input.amountCents,
    amountWithoutTax: 0,
    amountWithTax,
    tax,
    service: 0,
    tip: 0,
    currency: "USD",
    clientTransactionId: input.clientTransactionId,
    storeId: process.env.PAYPHONE_STORE_ID,
    reference: input.reference.slice(0, 100),
    responseUrl: input.responseUrl,
    cancellationUrl: input.cancellationUrl,
    lang: "es",
    timeZone: -5,
  });
}

/** Resultado normalizado de Confirm y del cobro con tarjeta guardada. */
export interface PayphoneResult {
  approved: boolean;
  statusCode: number | null;
  transactionId: number | null;
  clientTransactionId: string | null;
  amountCents: number | null;
  authorizationCode: string | null;
  cardBrand: string | null;
  lastDigits: string | null;
  email: string | null;
  phoneNumber: string | null;
  document: string | null;
  /** Titular de la tarjeta (optionalParameter4, solo pagos con tarjeta) */
  holderName: string | null;
  message: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(r: any): PayphoneResult {
  const status = r?.transactionStatus ?? r?.status ?? null;
  const statusCode = typeof r?.statusCode === "number" ? r.statusCode : null;
  return {
    approved: statusCode === 3 || status === "Approved",
    statusCode,
    transactionId: typeof r?.transactionId === "number" ? r.transactionId : null,
    clientTransactionId: r?.clientTransactionId ?? null,
    amountCents: typeof r?.amount === "number" ? r.amount : null,
    authorizationCode: r?.authorizationCode ?? null,
    cardBrand: r?.cardBrand ?? null,
    lastDigits: r?.lastDigits ?? null,
    email: r?.email ?? null,
    phoneNumber: r?.phoneNumber ?? null,
    document: r?.document ?? null,
    holderName: r?.optionalParameter4 ?? null,
    message: r?.message ?? null,
  };
}

/** Confirma un pago del botón (obligatorio en los 5 minutos siguientes, o Payphone lo anula). */
export async function confirmPayment(id: number, clientTransactionId: string): Promise<PayphoneResult> {
  return normalize(await call("/button/V2/Confirm", { id, clientTxId: clientTransactionId }));
}

// ─── Tarjeta guardada (tokenización) ─────────────────────────────────────────

export interface CardHolder {
  name: string;
  email: string;
  /** Como lo devuelve Confirm, sin "+" (p. ej. 593984111222) */
  phoneNumber: string;
  document: string;
}

/**
 * Nombre del titular cifrado como pide Payphone: AES-CBC sin vector de
 * inicialización (IV en ceros), clave = "coding password" de Payphone Developer,
 * resultado en Base64. El tamaño de la clave (16/24/32 bytes) fija la variante.
 */
export function encryptCardHolder(name: string): string {
  const password = process.env.PAYPHONE_CODING_PASSWORD;
  if (!password) throw new Error("PAYPHONE_CODING_PASSWORD no está configurado.");
  const key = Buffer.from(password, "utf8");
  const algorithm = key.length === 16 ? "aes-128-cbc" : key.length === 24 ? "aes-192-cbc" : "aes-256-cbc";
  const sizedKey = algorithm === "aes-256-cbc" ? Buffer.concat([key, Buffer.alloc(32)]).subarray(0, 32) : key;
  const cipher = crypto.createCipheriv(algorithm, sizedKey, Buffer.alloc(16, 0));
  return Buffer.concat([cipher.update(name, "utf8"), cipher.final()]).toString("base64");
}

/** Cobra la tarjeta guardada. Síncrono: la respuesta ya trae el estado final. */
export async function chargeSavedCard(input: {
  cardToken: string;
  holder: CardHolder;
  amountCents: number;
  clientTransactionId: string;
  description: string;
}): Promise<PayphoneResult> {
  const { amountWithTax, tax } = splitIva(input.amountCents);
  const phone = input.holder.phoneNumber.replace(/^\+/, "");
  const [firstName, ...rest] = input.holder.name.trim().split(/\s+/);
  return normalize(
    await call("/transaction/web", {
      cardHolder: encryptCardHolder(input.holder.name),
      cardToken: input.cardToken,
      amount: input.amountCents,
      amountWithoutTax: 0,
      amountWithTax,
      tax,
      service: 0,
      tip: 0,
      currency: "USD",
      clientTransactionId: input.clientTransactionId,
      storeId: process.env.PAYPHONE_STORE_ID,
      optionalParameter: input.description.slice(0, 100),
      phoneNumber: phone,
      email: input.holder.email,
      documentId: input.holder.document,
      order: {
        billTo: {
          billToId: 1,
          firstName: firstName || input.holder.name,
          lastName: rest.join(" ") || firstName || input.holder.name,
          email: input.holder.email,
          phoneNumber: `+${phone}`,
          country: "EC",
        },
        lineItems: [
          {
            productName: input.description.slice(0, 100),
            unitPrice: input.amountCents,
            quantity: 1,
            totalAmount: input.amountCents,
            taxAmount: tax,
            productSKU: input.clientTransactionId,
            productDescription: input.description.slice(0, 100),
          },
        ],
      },
    })
  );
}

/** Anula un cobro (solo el mismo día, hasta las 23:59 de Ecuador). */
export async function reversePayment(transactionId: number): Promise<boolean> {
  const res = await call<unknown>("/Reverse", { id: transactionId });
  return res === true;
}

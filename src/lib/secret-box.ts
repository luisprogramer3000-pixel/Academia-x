import crypto from "crypto";

/**
 * Cifrado de datos sensibles guardados en la base de datos (token de tarjeta
 * de Payphone y datos del titular): AES-256-GCM con una clave derivada de
 * PAYMENT_ENCRYPTION_KEY (o, si falta, de JWT_SECRET).
 *
 * Formato: "v1:<iv base64>:<tag base64>:<datos base64>".
 * Cambiar la clave hace ilegibles las tarjetas guardadas (habría que volver a
 * pedirlas), así que no se rota a la ligera.
 */
function key(): Buffer {
  const secret = process.env.PAYMENT_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Falta PAYMENT_ENCRYPTION_KEY (o JWT_SECRET) de al menos 32 caracteres.");
  return crypto.createHash("sha256").update(`payment-box:${secret}`).digest();
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function open(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Dato cifrado no válido.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

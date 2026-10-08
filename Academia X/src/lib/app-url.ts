/**
 * Dirección pública de la aplicación (https://www.mentorstudioglobal.com en
 * producción). Se usa en enlaces de correos, retornos de pago y QR.
 */
export function getAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

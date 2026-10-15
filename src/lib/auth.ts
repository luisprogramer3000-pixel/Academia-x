import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "auth_token";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

const DEV_FALLBACK_SECRET = "dev-jwt-secret-mentor-studio-key-32-characters-minimum!";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET debe estar configurado con al menos 32 caracteres en producción.");
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export interface TokenPayload {
  userId: string;
  email: string;
  name?: string | null;
  globalRole: "SUPER_ADMIN" | "USER";
  tenantId?: string;
  tenantSlug?: string;
  academyRole?: "OWNER" | "TEACHER" | "STUDENT";
  /** User.sessionVersion al emitir el token: si cambió (nueva contraseña, cierre global), el token deja de valer */
  sv?: number;
}

export async function createSessionToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as TokenPayload;
  } catch (error) {
    return null;
  }
}

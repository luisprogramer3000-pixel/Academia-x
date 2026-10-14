/**
 * Rate Limiter con fallback en memoria y soporte opcional para Upstash Redis
 */

interface RateLimitOptions {
  key: string;
  limit?: number; // Máximo de peticiones permitidas en la ventana
  windowMs?: number; // Tamaño de la ventana en milisegundos (por defecto 60,000ms = 1 min)
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

// Almacenamiento en memoria para fallback / testing sin Redis
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Limpia registros expirados del mapa en memoria para evitar fugas de memoria.
 */
function cleanupMemoryStore() {
  const now = Date.now();
  for (const [k, v] of memoryStore.entries()) {
    if (v.resetAt <= now) {
      memoryStore.delete(k);
    }
  }
}

/**
 * Limita peticiones basándose en una clave (IP, email, etc.)
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 60_000;
  const now = Date.now();
  const key = options.key;

  // 1. Si existen credenciales de Upstash Redis en entorno, se puede integrar cliente rest.
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const fetchUrl = `${upstashUrl}/pipeline`;
      const response = await fetch(fetchUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, windowMs, "NX"],
          ["PTTL", key],
        ]),
      });

      if (response.ok) {
        const data = await response.json();
        const currentCount = Number(data[0]?.result || 1);
        const pttl = Number(data[2]?.result || windowMs);

        return {
          success: currentCount <= limit,
          limit,
          remaining: Math.max(0, limit - currentCount),
          resetMs: pttl > 0 ? pttl : windowMs,
        };
      }
    } catch (e) {
      console.warn("[RateLimit] Upstash Redis call failed, using in-memory fallback:", e);
    }
  }

  // 2. Fallback determinista en memoria
  if (Math.random() < 0.05) {
    cleanupMemoryStore();
  }

  const record = memoryStore.get(key);

  if (!record || record.resetAt <= now) {
    const newResetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt: newResetAt });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetMs: windowMs,
    };
  }

  record.count += 1;
  memoryStore.set(key, record);

  const remaining = Math.max(0, limit - record.count);
  const success = record.count <= limit;
  const resetMs = Math.max(0, record.resetAt - now);

  return {
    success,
    limit,
    remaining,
    resetMs,
  };
}

/**
 * Resetea el contador para una clave específica (útil en tests).
 */
export function resetRateLimitStore(key?: string) {
  if (key) {
    memoryStore.delete(key);
  } else {
    memoryStore.clear();
  }
}

/**
 * Generación de imágenes para las clases, con dos niveles de calidad.
 *
 * ESTÁNDAR  → Flux Schnell en fal.ai   (~$0.003 por imagen 16:9, segundos)
 * ALTA      → Nano Banana en Gemini    (~$0.034 por imagen, 11 veces más cara)
 *
 * El profesor elige: muchas ilustraciones baratas para una lección normal, o
 * pocas de máxima calidad para una portada o una infografía que se imprime.
 *
 * Se usa REST en los dos casos para no añadir dependencias al despliegue
 * gestionado. Sin clave configurada se falla de forma explícita en producción:
 * nunca se cobra al profesor por una imagen que no existe.
 */

export type ImageQuality = "standard" | "hq";

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
  prompt: string;
  /** Coste estimado en USD, para la auditoría económica */
  estimatedCost: number;
  provider: string;
  model: string;
}

export class ImageGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

const FAL_ENDPOINT = "https://fal.run/fal-ai/flux/schnell";
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";

const DEFAULT_HQ_MODEL = "gemini-3.1-flash-lite-image";
const COST_STANDARD = 0.003;
const COST_HQ = 0.034;

/** PNG 1x1 transparente, solo para desarrollo sin claves */
const PLACEHOLDER_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function isImageQualityConfigured(quality: ImageQuality): boolean {
  return quality === "hq" ? Boolean(process.env.GEMINI_API_KEY) : Boolean(process.env.FAL_KEY);
}

/**
 * Enriquece la instrucción para que el resultado sirva en una clase: sin texto
 * incrustado (el modelo lo escribe mal y además impide traducir la lámina) y
 * en formato apaisado para proyectar.
 */
function buildPrompt(prompt: string): string {
  return [
    prompt,
    "Ilustración educativa clara y profesional, apta para proyectar en clase.",
    "Sin texto ni palabras dentro de la imagen. Fondo limpio, colores sobrios, alto contraste.",
  ].join(" ");
}

function placeholder(prompt: string, quality: ImageQuality): GeneratedImage {
  return {
    buffer: Buffer.from(PLACEHOLDER_PNG, "base64"),
    mimeType: "image/png",
    prompt,
    estimatedCost: 0,
    provider: "placeholder",
    model: quality,
  };
}

/** Flux Schnell (fal.ai): rápido y barato, para el grueso de las ilustraciones */
async function generateWithFal(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.FAL_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new ImageGenerationError("La generación de imágenes no está configurada: falta FAL_KEY.");
    }
    return placeholder(prompt, "standard");
  }

  let response: Response;
  try {
    response = await fetch(FAL_ENDPOINT, {
      method: "POST",
      headers: {
        // fal exige el prefijo "Key", no "Bearer"
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        // 1024x576: por debajo de 1 megapíxel, que es la unidad de facturación
        image_size: "landscape_16_9",
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: true,
        output_format: "jpeg",
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (error) {
    throw new ImageGenerationError(
      `No se pudo contactar con fal.ai: ${error instanceof Error ? error.message : "error de red"}`
    );
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    if (/TOP_UP|locked|balance/i.test(detail)) {
      throw new ImageGenerationError(`fal.ai: la cuenta no tiene saldo (recárgala en fal.ai/dashboard/billing). ${detail}`);
    }
    throw new ImageGenerationError(`fal.ai respondió ${response.status}: ${detail}`);
  }

  const payload = (await response.json()) as {
    images?: Array<{ url?: string; content_type?: string }>;
  };

  const imageUrl = payload.images?.[0]?.url;
  if (!imageUrl) {
    throw new ImageGenerationError("fal.ai no devolvió ninguna imagen.");
  }

  // fal entrega una URL temporal: hay que descargar el archivo y guardarlo
  const download = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!download.ok) {
    throw new ImageGenerationError(`No se pudo descargar la imagen generada (${download.status}).`);
  }

  return {
    buffer: Buffer.from(await download.arrayBuffer()),
    mimeType: payload.images?.[0]?.content_type || "image/jpeg",
    prompt,
    estimatedCost: COST_STANDARD,
    provider: "fal.ai",
    model: "flux/schnell",
  };
}

/** Nano Banana (Gemini): máxima calidad, para portadas e infografías */
async function generateWithGemini(prompt: string, aspectRatio: string): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_HQ_MODEL;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new ImageGenerationError("La generación en alta calidad no está configurada: falta GEMINI_API_KEY.");
    }
    return placeholder(prompt, "hq");
  }

  let response: Response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: [{ type: "text", text: prompt }],
        response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: aspectRatio, image_size: "1K" },
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new ImageGenerationError(
      `No se pudo contactar con el generador de alta calidad: ${error instanceof Error ? error.message : "error de red"}`
    );
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new ImageGenerationError(`El generador de alta calidad respondió ${response.status}: ${detail}`);
  }

  const payload = (await response.json()) as {
    interaction?: { output_image?: { mime_type?: string; data?: string } };
  };

  const image = payload.interaction?.output_image;
  if (!image?.data) {
    throw new ImageGenerationError("El generador de alta calidad no devolvió ninguna imagen.");
  }

  return {
    buffer: Buffer.from(image.data, "base64"),
    mimeType: image.mime_type || "image/jpeg",
    prompt,
    estimatedCost: COST_HQ,
    provider: "gemini",
    model,
  };
}

/**
 * Genera una ilustración de clase con el nivel de calidad pedido.
 */
export async function generateClassImage(params: {
  prompt: string;
  quality?: ImageQuality;
  aspectRatio?: "16:9" | "1:1" | "4:3";
}): Promise<GeneratedImage> {
  const quality = params.quality || "standard";
  const enrichedPrompt = buildPrompt(params.prompt);

  return quality === "hq"
    ? generateWithGemini(enrichedPrompt, params.aspectRatio || "16:9")
    : generateWithFal(enrichedPrompt);
}

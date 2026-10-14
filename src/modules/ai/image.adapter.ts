/**
 * Generación de imágenes para las clases, con dos niveles de calidad, ambos en fal.ai
 * (una sola clave y un solo saldo: FAL_KEY).
 *
 * ESTÁNDAR  → Flux Schnell   (~$0.003 por imagen 16:9, segundos)
 * ALTA      → Flux 1.1 Pro   (~$0.04 por imagen, mucho más detalle y mejor composición)
 *
 * Sin clave configurada se falla de forma explícita (también en desarrollo):
 * nunca se entrega una imagen falsa ni se cobra al profesor por una que no existe.
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

const FAL_MODELS: Record<ImageQuality, { endpoint: string; model: string; cost: number }> = {
  standard: { endpoint: "https://fal.run/fal-ai/flux/schnell", model: "flux/schnell", cost: 0.003 },
  hq: { endpoint: "https://fal.run/fal-ai/flux-pro/v1.1", model: "flux-pro/v1.1", cost: 0.04 },
};

const FAL_SIZES = { "16:9": "landscape_16_9", "4:3": "landscape_4_3", "1:1": "square_hd", "3:4": "portrait_4_3" } as const;

/** Edición con imagen de referencia ("cambia la foto por…, deja el resto igual"): FLUX.1 Kontext Pro */
const FAL_EDIT = { endpoint: "https://fal.run/fal-ai/flux-pro/kontext", model: "flux-pro/kontext", cost: 0.04 };

export function isImageQualityConfigured(_quality: ImageQuality): boolean {
  return Boolean(process.env.FAL_KEY);
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

async function generateWithFal(prompt: string, quality: ImageQuality, aspectRatio: keyof typeof FAL_SIZES): Promise<GeneratedImage> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new ImageGenerationError("La generación de imágenes no está configurada: falta FAL_KEY.");
  }
  const cfg = FAL_MODELS[quality];

  let response: Response;
  try {
    response = await fetch(cfg.endpoint, {
      method: "POST",
      headers: {
        // fal exige el prefijo "Key", no "Bearer"
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        // 1024x576 en 16:9: por debajo de 1 megapíxel, que es la unidad de facturación
        image_size: FAL_SIZES[aspectRatio],
        num_images: 1,
        ...(quality === "standard" ? { num_inference_steps: 4, enable_safety_checker: true } : { safety_tolerance: "2" }),
        output_format: "jpeg",
      }),
      signal: AbortSignal.timeout(90_000),
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
    has_nsfw_concepts?: boolean[];
  };

  const imageUrl = payload.images?.[0]?.url;
  if (!imageUrl || payload.has_nsfw_concepts?.[0]) {
    throw new ImageGenerationError("fal.ai no devolvió ninguna imagen.");
  }

  // fal entrega una URL temporal: hay que descargar el archivo y guardarlo
  const download = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!download.ok) {
    throw new ImageGenerationError(`No se pudo descargar la imagen generada (${download.status}).`);
  }
  const buffer = Buffer.from(await download.arrayBuffer());
  // Una imagen real pesa varios KB: si llega casi vacía, es un error y no se cobra
  if (buffer.length < 2048) {
    throw new ImageGenerationError("La imagen generada llegó vacía.");
  }

  return {
    buffer,
    mimeType: payload.images?.[0]?.content_type || "image/jpeg",
    prompt,
    estimatedCost: cfg.cost,
    provider: "fal.ai",
    model: cfg.model,
  };
}

/**
 * Genera una ilustración de clase con el nivel de calidad pedido.
 */
export async function generateClassImage(params: {
  prompt: string;
  quality?: ImageQuality;
  aspectRatio?: keyof typeof FAL_SIZES;
  /** El prompt ya trae su propio estilo (p. ej. fotografía realista): no se le añade el de ilustración */
  rawPrompt?: boolean;
}): Promise<GeneratedImage> {
  const quality = params.quality || "standard";
  const prompt = params.rawPrompt ? params.prompt : buildPrompt(params.prompt);

  return generateWithFal(prompt, quality, params.aspectRatio || "16:9");
}

/**
 * Modifica una imagen existente según una instrucción, conservando el resto
 * (composición, estilo, personas). La referencia va como data URI: fal la acepta
 * y así no hace falta exponer el archivo con una URL pública.
 */
export async function editClassImage(params: { instruction: string; reference: Buffer; referenceMime: string }): Promise<GeneratedImage> {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new ImageGenerationError("La generación de imágenes no está configurada: falta FAL_KEY.");
  const prompt = `${params.instruction}. Mantén el mismo estilo fotográfico, la luz y el resto de la escena. Sin texto, letras ni logotipos.`;
  let response: Response;
  try {
    response = await fetch(FAL_EDIT.endpoint, {
      method: "POST",
      headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        image_url: `data:${params.referenceMime};base64,${params.reference.toString("base64")}`,
        num_images: 1,
        safety_tolerance: "2",
        output_format: "jpeg",
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    throw new ImageGenerationError(`No se pudo contactar con fal.ai: ${error instanceof Error ? error.message : "error de red"}`);
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    if (/TOP_UP|locked|balance/i.test(detail)) throw new ImageGenerationError(`fal.ai: la cuenta no tiene saldo. ${detail}`);
    throw new ImageGenerationError(`fal.ai respondió ${response.status}: ${detail}`);
  }
  const payload = (await response.json()) as { images?: Array<{ url?: string; content_type?: string }>; has_nsfw_concepts?: boolean[] };
  const imageUrl = payload.images?.[0]?.url;
  if (!imageUrl || payload.has_nsfw_concepts?.[0]) throw new ImageGenerationError("fal.ai no devolvió ninguna imagen.");
  const download = await fetch(imageUrl, { signal: AbortSignal.timeout(60_000) });
  if (!download.ok) throw new ImageGenerationError(`No se pudo descargar la imagen editada (${download.status}).`);
  const buffer = Buffer.from(await download.arrayBuffer());
  if (buffer.length < 2048) throw new ImageGenerationError("La imagen editada llegó vacía.");
  return { buffer, mimeType: payload.images?.[0]?.content_type || "image/jpeg", prompt, estimatedCost: FAL_EDIT.cost, provider: "fal.ai", model: FAL_EDIT.model };
}

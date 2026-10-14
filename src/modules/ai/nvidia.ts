export interface NvidiaChatParams {
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  chatTemplateKwargs?: {
    enable_thinking?: boolean;
    [key: string]: any;
  };
  stream?: boolean;
  apiKey?: string; // Permite pasar una clave específica para este llamado
}

export async function askNvidiaAI({
  messages,
  model = "google/diffusiongemma-26b-a4b-it", // Se puede sobrescribir al llamar la función
  maxTokens = 4096,
  temperature = 1,
  topP = 0.95,
  chatTemplateKwargs,
  stream = false,
  apiKey,
}: NvidiaChatParams) {
  // Usa la clave pasada por parámetro o hace fallback a la variable de entorno global
  const resolvedApiKey = apiKey || process.env.NVIDIA_API_KEY;

  if (!resolvedApiKey) {
    throw new Error("No se proporcionó una clave de API (NVIDIA_API_KEY).");
  }

  const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";

  const payload = {
    messages,
    model,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    ...(chatTemplateKwargs && { chat_template_kwargs: chatTemplateKwargs }),
    stream,
  };

  const response = await fetch(invokeUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resolvedApiKey}`,
      "Accept": stream ? "text/event-stream" : "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en la API de NVIDIA: ${response.status} - ${errorText}`);
  }

  if (stream) {
    // Retornamos el body directamente para ser consumido como stream
    return response.body;
  }

  return response.json();
}

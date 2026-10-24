/**
 * Generaciones con IA en segundo plano, desde el navegador. Todo va por fetch a
 * rutas /api y no por acciones del servidor: si el proxy del hosting devuelve una
 * página de error, una acción del servidor rompe la página entera ("An unexpected
 * response was received from the server") aunque se capture el error; con fetch
 * queda como un mensaje en el formulario.
 */

const POLL_MS = 3000;
/** Respuestas fallidas seguidas que se toleran antes de rendirse (la IA sigue en el servidor) */
const MAX_NETWORK_ERRORS = 5;

export const LOST_CONNECTION_ERROR =
  "Se perdió la conexión mientras la IA trabajaba. Revisa \"Mis recursos\" en unos minutos: si se generó, estará ahí.";

type StartResponse = { success: true; jobId: string } | { success: false; error: string };
type JobState = { status: "RUNNING" } | { status: "DONE"; result: unknown } | { status: "FAILED"; error: string };

/** Lanza la generación (POST con el formulario) y devuelve el id del trabajo. */
export async function startAIJob(endpoint: string, form: FormData): Promise<string> {
  let data: StartResponse;
  try {
    const res = await fetch(endpoint, { method: "POST", body: form });
    data = await res.json();
  } catch {
    throw new Error(LOST_CONNECTION_ERROR);
  }
  if (!data.success) throw new Error(data.error);
  return data.jobId;
}

/**
 * Espera a que termine una generación lanzada en segundo plano.
 * Devuelve el resultado o lanza un Error con un mensaje listo para mostrar.
 */
export async function waitForAIJob<T>(jobId: string): Promise<T> {
  let networkErrors = 0;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    let state: JobState;
    try {
      const res = await fetch(`/api/ai/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
      state = await res.json();
      networkErrors = 0;
    } catch {
      if (++networkErrors >= MAX_NETWORK_ERRORS) throw new Error(LOST_CONNECTION_ERROR);
      continue;
    }
    if (state.status === "DONE") return state.result as T;
    if (state.status === "FAILED") throw new Error(state.error);
  }
}

/** Lanza y espera: el atajo para los formularios. */
export async function runAIJob<T>(endpoint: string, form: FormData): Promise<T> {
  return waitForAIJob<T>(await startAIJob(endpoint, form));
}

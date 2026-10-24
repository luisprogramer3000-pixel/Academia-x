import { getAIJobAction } from "@/app/actions/ai.actions";

const POLL_MS = 3000;
/** Cortes de red seguidos que se toleran antes de rendirse (la IA sigue en el servidor) */
const MAX_NETWORK_ERRORS = 5;

export const LOST_CONNECTION_ERROR =
  "Se perdió la conexión mientras la IA trabajaba. Revisa \"Mis recursos\" en unos minutos: si se generó, estará ahí.";

/**
 * Espera a que termine una generación lanzada en segundo plano.
 * Devuelve el resultado o lanza un Error con un mensaje listo para mostrar.
 */
export async function waitForAIJob<T>(jobId: string): Promise<T> {
  let networkErrors = 0;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    let state: Awaited<ReturnType<typeof getAIJobAction>>;
    try {
      state = await getAIJobAction(jobId);
      networkErrors = 0;
    } catch {
      if (++networkErrors >= MAX_NETWORK_ERRORS) throw new Error(LOST_CONNECTION_ERROR);
      continue;
    }
    if (state.status === "DONE") return state.result as T;
    if (state.status === "FAILED") throw new Error(state.error);
  }
}

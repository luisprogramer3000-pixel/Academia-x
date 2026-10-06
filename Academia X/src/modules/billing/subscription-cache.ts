import { cache } from "react";
import { BillingService } from "./billing.service";

/**
 * Suscripción activa, memorizada SOLO durante la petición en curso (React cache):
 * la página, el layout y las acciones que la piden varias veces hacen una sola
 * consulta. No hay caché entre peticiones, así que un cambio de plan o un impago
 * se refleja en la siguiente visita.
 *
 * BillingService sigue usando la lectura directa, porque es quien modifica la
 * suscripción y necesita ver el dato recién escrito.
 */
export const getActiveSubscriptionCached = cache((tenantId: string) => BillingService.getActiveSubscription(tenantId));

/**
 * Configura Stripe para cobrar de verdad (modo live):
 *
 *   npx tsx scripts/setup-stripe-live.ts
 *
 * 1. Crea los 3 productos (Starter, Professional VIP, Academy Executive) con sus
 *    6 precios recurrentes en USD, tomando los importes de src/modules/billing/plans.ts.
 * 2. Crea el webhook hacia https://www.mentorstudioglobal.com/api/webhooks/stripe
 *    con los eventos que procesa la aplicación.
 * 3. Comprueba que el portal de cliente esté activado.
 *
 * La clave secreta se pide en la terminal sin mostrarla. Los resultados (IDs de
 * precios y el secreto del webhook) se guardan en .env.stripe-live.local
 * (ignorado por git) para copiarlos a las variables de entorno de Hostinger.
 *
 * Se puede repetir sin duplicar nada: reutiliza los precios (por lookup_key) y
 * el webhook que ya existan.
 *
 * Opciones:
 *   --url https://otro-dominio.com   dominio público (por defecto el de producción)
 *   --recreate-webhook               borra y recrea el webhook para obtener un secreto nuevo
 *   --no-webhook                     no toca el webhook (solo productos y precios)
 */
import { createInterface } from "readline";
import { writeFileSync } from "fs";
import Stripe from "stripe";
import { SAAS_PLANS } from "../src/modules/billing/plans";

const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
];
const OUTPUT = ".env.stripe-live.local";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Pregunta sin mostrar lo que se escribe (para la clave secreta). */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void };
    let asked = false;
    output._writeToOutput = (s: string) => {
      if (!asked) {
        process.stdout.write(s);
        asked = true;
      } else if (s.includes("\n") || s.includes("\r")) process.stdout.write("\n");
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const appUrl = (arg("--url") || "https://www.mentorstudioglobal.com").replace(/\/$/, "");
  const webhookUrl = `${appUrl}/api/webhooks/stripe`;

  const key = process.env.STRIPE_LIVE_SECRET_KEY || (await askHidden("Clave secreta LIVE de Stripe (sk_live_...): "));
  if (!/^(sk|rk)_(live|test)_/.test(key)) throw new Error("Eso no parece una clave secreta de Stripe (sk_live_...).");
  const live = key.includes("_live_");
  if (!live) console.log("⚠️  Es una clave de PRUEBA (test): se configurará el modo de prueba, no el real.\n");

  const stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia", appInfo: { name: "Mentor Studio Global (setup)" } });
  const account = await stripe.accounts.retrieve();
  console.log(`Cuenta: ${account.settings?.dashboard?.display_name || account.business_profile?.name || account.id} (${live ? "LIVE" : "test"})`);
  if (live && !account.charges_enabled) {
    console.log("⚠️  La cuenta todavía no puede cobrar: completa la activación en el panel de Stripe (datos del negocio y cuenta bancaria).");
  }

  // ─── 1. Productos y precios ───────────────────────────────────────────────
  const env: Record<string, string> = {};
  for (const plan of Object.values(SAAS_PLANS)) {
    let product: Stripe.Product | null = null;
    for (const interval of ["MONTHLY", "YEARLY"] as const) {
      const pricing = plan.pricing[interval];
      const lookupKey = `msg_${plan.id.toLowerCase()}_${interval.toLowerCase()}`;
      const existing = (await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })).data[0];

      if (existing && existing.unit_amount === pricing.amountCents && existing.currency === pricing.currency.toLowerCase()) {
        env[pricing.stripePriceEnvKey] = existing.id;
        console.log(`  = ${plan.name} ${interval === "MONTHLY" ? "mensual" : "anual"}: ya existía (${existing.id})`);
        continue;
      }

      if (!product) {
        product =
          (await stripe.products.search({ query: `metadata['msg_plan']:'${plan.id}' AND active:'true'`, limit: 1 })).data[0] ??
          (await stripe.products.create({
            name: plan.name,
            description: plan.features.slice(0, 3).join(" · ").slice(0, 300) || undefined,
            metadata: { msg_plan: plan.id },
          }));
      }

      const price = await stripe.prices.create({
        product: product.id,
        currency: pricing.currency.toLowerCase(),
        unit_amount: pricing.amountCents,
        recurring: { interval: interval === "YEARLY" ? "year" : "month" },
        nickname: `${plan.name} ${interval === "YEARLY" ? "anual" : "mensual"}`,
        lookup_key: lookupKey,
        // Si había un precio con ese lookup_key pero otro importe, el nuevo lo reemplaza
        transfer_lookup_key: true,
        metadata: { planId: plan.id, billingInterval: interval },
      });
      env[pricing.stripePriceEnvKey] = price.id;
      console.log(`  ✓ ${plan.name} ${interval === "MONTHLY" ? "mensual" : "anual"}: ${(pricing.amountCents / 100).toFixed(2)} USD (${price.id})`);
    }
  }

  // ─── 2. Webhook ───────────────────────────────────────────────────────────
  const endpoints = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter((e) => e.url === webhookUrl);
  let webhookSecret: string | null = null;
  if (process.argv.includes("--no-webhook")) {
    console.log("\nWebhook: omitido (--no-webhook).");
  } else if (endpoints.length && !process.argv.includes("--recreate-webhook")) {
    const ep = endpoints[0];
    const missing = WEBHOOK_EVENTS.filter((ev) => !ep.enabled_events.includes(ev) && !ep.enabled_events.includes("*"));
    if (missing.length) await stripe.webhookEndpoints.update(ep.id, { enabled_events: [...new Set([...ep.enabled_events, ...missing])] as typeof WEBHOOK_EVENTS });
    console.log(`\nWebhook: ya existía (${ep.id})${missing.length ? `; añadidos ${missing.length} eventos` : ""}.`);
    console.log("  Stripe solo muestra el secreto al crearlo. Si no lo tienes guardado, vuelve a ejecutar con --recreate-webhook.");
  } else {
    for (const ep of endpoints) await stripe.webhookEndpoints.del(ep.id);
    const ep = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: WEBHOOK_EVENTS,
      description: "Mentor Studio Global: suscripciones, facturas y pagos de créditos",
      api_version: "2025-02-24.acacia",
    });
    webhookSecret = ep.secret ?? null;
    console.log(`\nWebhook: creado hacia ${webhookUrl} (${ep.id}) con ${WEBHOOK_EVENTS.length} eventos.`);
  }

  // ─── 3. Portal de cliente ─────────────────────────────────────────────────
  const portal = (await stripe.billingPortal.configurations.list({ is_default: true, limit: 1 })).data[0];
  console.log(
    portal
      ? "Portal de cliente: activado."
      : "⚠️  Portal de cliente SIN activar: Stripe → Configuración → Facturación → Portal de clientes → Guardar.\n   Sin él, el botón \"Gestionar suscripción\" de las academias da error."
  );

  // ─── Resultado ────────────────────────────────────────────────────────────
  const lines = [
    `# Generado por scripts/setup-stripe-live.ts el ${new Date().toISOString()} (${live ? "LIVE" : "test"})`,
    "# Copia estas variables a Hostinger y BORRA este archivo después.",
    ...Object.entries(env).map(([k, v]) => `${k}=${v}`),
    webhookSecret
      ? `STRIPE_WEBHOOK_SECRET=${webhookSecret}`
      : process.argv.includes("--no-webhook")
        ? "# STRIPE_WEBHOOK_SECRET: webhook omitido (--no-webhook)"
        : "# STRIPE_WEBHOOK_SECRET: el webhook ya existía; usa el secreto guardado o ejecuta con --recreate-webhook",
    "# Además: STRIPE_SECRET_KEY (la sk_live que acabas de usar) y NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_...)",
  ];
  writeFileSync(OUTPUT, lines.join("\n") + "\n");
  console.log(`\nListo. Variables guardadas en ${OUTPUT} (no se sube a git).`);
  console.log("Precios:");
  for (const [k, v] of Object.entries(env)) console.log(`  ${k}=${v}`);
  if (webhookSecret) console.log("  STRIPE_WEBHOOK_SECRET → en el archivo (no se muestra aquí)");
  process.exit(0);
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});

import { readFileSync } from "fs";
import { spawn } from "child_process";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]; }
process.env.DATABASE_URL = process.env.DIRECT_URL + "?connect_timeout=30";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  const tenant = await p.tenant.findUnique({ where: { slug: "academyec" }, select: { id: true, slug: true } });
  const owner = await p.membership.findFirst({ where: { tenantId: tenant!.id, role: "OWNER" }, include: { user: true } });
  const { createSessionToken } = await import("../src/lib/auth");
  const token = await createSessionToken({ userId: owner!.userId, email: owner!.user.email, name: owner!.user.name, globalRole: "USER", tenantId: tenant!.id, tenantSlug: tenant!.slug, academyRole: "OWNER" });

  const edge = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", ["--headless=new", "--remote-debugging-port=9333", "--user-data-dir=" + process.env.TEMP + "\edge-e2e", "about:blank"], { stdio: "ignore" });
  await sleep(2500);
  const list = await (await fetch("http://127.0.0.1:9333/json")).json();
  const ws = new WebSocket(list.find((t: { type: string }) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map<number, (v: unknown) => void>();
  ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.id && pending.has(m.id)) { pending.get(m.id)!(m); pending.delete(m.id); } else if (m.method === "Runtime.consoleAPICalled" || m.method === "Runtime.exceptionThrown") console.log("[consola]", JSON.stringify(m.params).slice(0, 400)); };
  const send = (method: string, params: object = {}) => new Promise<any>((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr: string) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCookie", { name: "auth_token", value: token, domain: "localhost", path: "/" });
  await send("Page.navigate", { url: "http://localhost:3000/dashboard/courses/new/course" });
  for (let i = 0; i < 60 && !(await evalJs("!!document.querySelector('form input[name=title]')")); i++) await sleep(1000);
  console.log("URL:", await evalJs("location.href"));
  const title = "ZZ Prueba automática " + Date.now();
  await evalJs(`(() => {
    const set = (sel, v) => { const el = document.querySelector(sel); const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    set('input[name=title]', ${JSON.stringify(title)});
    set('textarea[name=description]', 'Curso de prueba creado automáticamente.');
    set('input[name=paymentLink]', 'https://www.paypal.com/ncp/payment/ABC123XYZ');
    document.querySelector('form button[type=submit]').click();
    return true;
  })()`);
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    const url = await evalJs("location.href");
    const alert = await evalJs("document.querySelector('[role=alert]')?.innerText || document.body.innerText.match(/Algo salió mal[\s\S]{0,300}/)?.[0] || ''");
    if (url.includes("/builder") || alert) { console.log("RESULTADO URL:", url); console.log("MENSAJE:", alert); break; }
    if (i === 59) console.log("SIN RESPUESTA tras 60 s. Botón:", await evalJs("document.querySelector('form button[type=submit]')?.innerText"));
  }
  const created = await p.course.findMany({ where: { tenantId: tenant!.id, title }, select: { id: true } });
  console.log("cursos creados con ese título:", created.length);
  for (const c of created) await p.course.delete({ where: { id: c.id } });
  if (created.length) console.log("curso de prueba eliminado");
  ws.close(); edge.kill(); await p.$disconnect();
})().catch((e) => { console.error("ERR", e); process.exit(1); });

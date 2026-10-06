/**
 * Copia TODOS los datos de la base actual a una base nueva (otra región de Supabase).
 *
 * Requisitos:
 *   1. La base nueva ya tiene la estructura: `prisma migrate deploy` contra ella.
 *   2. Archivo .env.migration (ignorado por git) con las conexiones DIRECTAS (puerto 5432):
 *        SOURCE_DATABASE_URL="postgresql://...ap-northeast-1...:5432/postgres"   (la actual)
 *        TARGET_DATABASE_URL="postgresql://...us-east-1...:5432/postgres"        (la nueva)
 *   3. La web apagada durante la copia (nadie debe escribir en la base actual).
 *
 * Uso:
 *   npx tsx scripts/migrate-supabase-region.ts --check   → solo compara filas y contenido
 *   npx tsx scripts/migrate-supabase-region.ts --copy    → copia (la base nueva debe estar vacía)
 *
 * La base de origen SOLO se lee. La copia va en una única transacción: si algo
 * falla, la base nueva queda como estaba. Los valores se copian tal cual
 * (enums, JSON, decimales, fechas) con json_populate_recordset.
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

function loadMigrationEnv(): { source: string; target: string } {
  let raw = "";
  try {
    raw = readFileSync(".env.migration", "utf8");
  } catch {
    throw new Error("Falta el archivo .env.migration con SOURCE_DATABASE_URL y TARGET_DATABASE_URL.");
  }
  const get = (key: string) => raw.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\r\\n]+)"?`, "m"))?.[1]?.trim();
  const source = get("SOURCE_DATABASE_URL");
  const target = get("TARGET_DATABASE_URL");
  if (!source || !target) throw new Error("Faltan SOURCE_DATABASE_URL o TARGET_DATABASE_URL en .env.migration.");
  if (source === target) throw new Error("Origen y destino son la misma base de datos.");
  for (const [name, url] of [["SOURCE", source], ["TARGET", target]] as const) {
    if (/:6543\b/.test(url)) throw new Error(`${name}_DATABASE_URL usa el puerto 6543 (pooler): usa la conexión directa, puerto 5432.`);
  }
  return { source, target };
}

const host = (url: string) => url.match(/@([^:/]+)/)?.[1] ?? "?";

/** Tablas de public ordenadas para insertar padres antes que hijos (según las claves foráneas). */
async function tablesInInsertOrder(db: PrismaClient): Promise<string[]> {
  const tables = (await db.$queryRaw<Array<{ t: string }>>`
    SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename`).map((r) => r.t);
  const fks = await db.$queryRaw<Array<{ child: string; parent: string }>>`
    SELECT c.relname AS child, p.relname AS parent
    FROM pg_constraint k
    JOIN pg_class c ON c.oid = k.conrelid
    JOIN pg_class p ON p.oid = k.confrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE k.contype = 'f' AND n.nspname = 'public' AND c.relname <> p.relname`;

  const ordered: string[] = [];
  const pending = new Set(tables);
  while (pending.size) {
    const ready = [...pending].filter((t) => fks.every((fk) => fk.child !== t || !pending.has(fk.parent)));
    if (!ready.length) throw new Error(`Dependencia circular entre: ${[...pending].join(", ")}`);
    for (const t of ready.sort()) {
      ordered.push(t);
      pending.delete(t);
    }
  }
  return ordered;
}

/**
 * Filas y huella del contenido de una tabla (md5 de todas las filas ordenadas).
 * Se usa jsonb, que ordena las claves por nombre: así la huella no depende del
 * orden físico de las columnas, que puede variar entre bases (columnas añadidas
 * en distinto orden con db push o migraciones).
 */
async function fingerprint(db: PrismaClient, table: string): Promise<{ rows: number; hash: string }> {
  const [r] = await db.$queryRawUnsafe<Array<{ rows: bigint; hash: string | null }>>(
    `SELECT count(*)::bigint AS rows, md5(coalesce(string_agg(to_jsonb(t)::text, '|' ORDER BY to_jsonb(t)::text), '')) AS hash FROM "${table}" t`
  );
  return { rows: Number(r.rows), hash: r.hash ?? "" };
}

async function compare(source: PrismaClient, target: PrismaClient, tables: string[]) {
  let ok = true;
  console.log(`\n${"Tabla".padEnd(22)} ${"Origen".padStart(7)} ${"Destino".padStart(7)}  Contenido`);
  for (const t of tables) {
    const [a, b] = await Promise.all([fingerprint(source, t), fingerprint(target, t)]);
    const same = a.rows === b.rows && a.hash === b.hash;
    if (!same) ok = false;
    console.log(`${t.padEnd(22)} ${String(a.rows).padStart(7)} ${String(b.rows).padStart(7)}  ${same ? "idéntico" : "DIFERENTE"}`);
  }
  return ok;
}

async function main() {
  const mode = process.argv.includes("--copy") ? "copy" : process.argv.includes("--check") ? "check" : null;
  if (!mode) throw new Error("Indica --check o --copy.");

  const { source: sourceUrl, target: targetUrl } = loadMigrationEnv();
  const source = new PrismaClient({ datasourceUrl: sourceUrl });
  const target = new PrismaClient({ datasourceUrl: targetUrl });
  console.log(`Origen:  ${host(sourceUrl)} (solo lectura)\nDestino: ${host(targetUrl)}`);

  try {
    // Misma estructura en las dos bases (mismas migraciones aplicadas)
    const migrations = async (db: PrismaClient) =>
      (await db.$queryRaw<Array<{ migration_name: string }>>`
        SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`).map((m) => m.migration_name).join(",");
    const [ms, mt] = await Promise.all([migrations(source), migrations(target).catch(() => "")]);
    if (!mt) throw new Error("La base nueva no tiene estructura: ejecuta antes `prisma migrate deploy` contra ella.");
    if (ms !== mt) throw new Error("Las dos bases no tienen las mismas migraciones aplicadas. Aplica las que falten antes de copiar.");

    const tables = await tablesInInsertOrder(source);

    if (mode === "copy") {
      const nonEmpty: string[] = [];
      for (const t of tables) if ((await fingerprint(target, t)).rows > 0) nonEmpty.push(t);
      if (nonEmpty.length) throw new Error(`La base nueva no está vacía (${nonEmpty.join(", ")}). No se copia nada para no duplicar datos.`);

      const started = Date.now();
      await target.$transaction(
        async (tx) => {
          for (const t of tables) {
            const [{ data }] = await source.$queryRawUnsafe<Array<{ data: unknown }>>(
              `SELECT coalesce(json_agg(t), '[]'::json) AS data FROM "${t}" t`
            );
            const rows = data as unknown[];
            if (!rows.length) continue;
            await tx.$executeRawUnsafe(
              `INSERT INTO "${t}" SELECT * FROM json_populate_recordset(NULL::"${t}", $1::json)`,
              JSON.stringify(rows)
            );
            console.log(`  copiada ${t}: ${rows.length} filas`);
          }
        },
        { timeout: 10 * 60_000, maxWait: 60_000 }
      );
      console.log(`Copia terminada en ${((Date.now() - started) / 1000).toFixed(1)} s.`);
    }

    const ok = await compare(source, target, tables);
    console.log(ok ? "\n✅ Las dos bases tienen exactamente los mismos datos." : "\n❌ Hay diferencias: NO cambies todavía las variables de entorno.");
    if (!ok) process.exitCode = 1;
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  }
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

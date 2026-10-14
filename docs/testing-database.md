# Base de datos de pruebas

Los tests **vacían tablas completas** (`Tenant`, `User`, `Subscription`...) como
parte de su limpieza. Contra la base real, borran todas tus academias, usuarios
y suscripciones. Por eso `tests/setup.ts` los bloquea salvo que `DATABASE_URL`
apunte a una base local o con `test` en el nombre.

Esta guía explica cómo montar esa base. Elige **una** de las dos opciones.

---

## Opción A — Segundo proyecto en Supabase (la más rápida)

No hay que instalar nada y funciona igual en cualquier ordenador.

1. Entra en [supabase.com](https://supabase.com) → **New project**.
2. Nómbralo **`mentor-studio-test`** (la palabra `test` es lo que reconoce el guardia).
3. Elige la región más cercana y una contraseña para la base.
4. Cuando termine de crearse: **Project Settings → Database → Connection string → URI**.
5. Crea el archivo `.env.test` en la raíz del proyecto:

```bash
DATABASE_URL="postgresql://postgres.xxxx:TU-PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5"
DIRECT_URL="postgresql://postgres.xxxx:TU-PASSWORD@aws-0-region.pooler.supabase.com:5432/postgres"
JWT_SECRET="cualquier-cadena-de-32-caracteres-para-pruebas-aqui"
AI_PROVIDER="mock"
RATE_LIMIT_PROVIDER="memory"
NODE_ENV="test"
```

> **Cuidado con el nombre de la base.** En Supabase la base siempre se llama
> `postgres`, así que el guardia no la reconocerá por el nombre. Sí la reconoce
> por el host si el proyecto se llama con `test`. Si no cuela, usa la opción B o
> ejecuta con `ALLOW_DESTRUCTIVE_TESTS=true` **solo** contra este proyecto vacío.

6. Aplica el esquema:

```bash
npx dotenv -e .env.test -- npx prisma migrate deploy
```

Si no tienes `dotenv-cli`, exporta la variable en la misma línea:

```bash
DATABASE_URL="...6543..." DIRECT_URL="...5432..." npx prisma migrate deploy
```

---

## Opción B — PostgreSQL local (más rápida al ejecutar)

Los tests pasan de ~15 minutos a ~1, porque desaparece la latencia de red.

### Con Docker (recomendado)

```bash
docker run --name mentor-studio-test-db \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=mentor_studio_test \
  -p 5433:5432 \
  -d postgres:16
```

El puerto **5433** evita chocar con cualquier PostgreSQL que ya tengas.

`.env.test`:

```bash
DATABASE_URL="postgresql://postgres:test@localhost:5433/mentor_studio_test"
DIRECT_URL="postgresql://postgres:test@localhost:5433/mentor_studio_test"
JWT_SECRET="cualquier-cadena-de-32-caracteres-para-pruebas-aqui"
AI_PROVIDER="mock"
RATE_LIMIT_PROVIDER="memory"
NODE_ENV="test"
```

Aplicar el esquema:

```bash
DATABASE_URL="postgresql://postgres:test@localhost:5433/mentor_studio_test" \
DIRECT_URL="postgresql://postgres:test@localhost:5433/mentor_studio_test" \
npx prisma migrate deploy
```

### Sin Docker (Windows)

1. Instala PostgreSQL desde [postgresql.org/download/windows](https://www.postgresql.org/download/windows/).
2. En pgAdmin o en `psql`, crea la base:
   ```sql
   CREATE DATABASE mentor_studio_test;
   ```
3. Usa el mismo `.env.test` cambiando el puerto a `5432` y la contraseña por la
   que pusiste al instalar.

---

## Ejecutar los tests

```bash
npx dotenv -e .env.test -- npm test
```

O apuntando la variable directamente:

```bash
DATABASE_URL="postgresql://postgres:test@localhost:5433/mentor_studio_test" npm test
```

El guardia de `tests/setup.ts` dejará pasar la ejecución porque el host es
`localhost` (opción B) o porque la base contiene `test` en el nombre.

---

## Los 5 archivos pendientes de diagnóstico

Con la base lista, estos son los que faltan por revisar:

| Archivo | Qué comprueba |
|---|---|
| `user-service.test.ts` | Invitaciones, alta de alumnos, inscripciones |
| `security-rate-limit.test.ts` | Límite de peticiones en registro y login |
| `ai-credit-notifications.test.ts` | Avisos de saldo bajo de créditos |
| `ai-credit-automation.test.ts` | Job mensual de reseteo de créditos |
| `ai-service-full-credit-integration.test.ts` | Consumo de créditos de punta a punta |

Ejecuta primero uno solo para confirmar que la conexión funciona:

```bash
npx dotenv -e .env.test -- npx vitest run tests/user-service.test.ts
```

## Los dos de Stripe

`stripe-sandbox-e2e.test.ts` y `stripe-sandbox-webhooks.test.ts` **no dependen de
la base**: fallan porque se asignan una clave falsa (`sk_test_mock_sandbox_key`) y
después llaman a la API real de Stripe, que la rechaza. Para que pasen hay que
darles una clave de test real o simular el SDK. No es un fallo del producto.

---

## Regla que no se salta

Nunca ejecutes `npm test` con `DATABASE_URL` apuntando a producción, ni siquiera
con `ALLOW_DESTRUCTIVE_TESTS=true`. Esa variable existe para bases vacías de
usar y tirar, no para saltarse el guardia.

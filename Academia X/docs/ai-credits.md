# Academia X — AI Credits Technical Documentation

## Overview

Academia X utiliza una unidad comercial llamada **AI Credits** para abstraer los costes variables de tokens de los Grandes Modelos de Lenguaje (LLM) subyacentes.

- **AI Credits**: Unidad comercial fija asignada por plan y descontada por operación.
- **Tokens de IA**: Métrica técnica interna registrada en `AIUsage` para medir los costes exactos de API pagados a proveedores de LLM.

---

## Modelos de Planes y Cuotas Mensuales

| Plan ID | Precio Mensual | Teacher Credits / mes | Student Credits / mes | Max Rollover Teacher | Max Rollover Student |
|---|---:|---:|---:|---:|---:|
| **STARTER** | $29.00 USD | 150 cr | 0 cr | 30 cr | 0 cr |
| **PRO** | $79.00 USD | 600 cr | 200 cr | 100 cr | 50 cr |
| **ACADEMY** | $199.00 USD | 2,000 cr | 800 cr | 300 cr | 150 cr |

---

## Catálogo de Operaciones de IA (`AIOperation`)

| Operación (`AIOperation`) | Tipo de Crédito (`AICreditType`) | Coste en Créditos | Tier de IA (`AITier`) | Límite Diario Starter | Límite Diario Pro | Límite Diario Academy |
|---|---|---:|---|---:|---:|---:|
| **`COURSE_GENERATION`** | `TEACHER` | **5** | `PREMIUM` | 2 | 5 | 15 |
| **`LESSON_GENERATION`** | `TEACHER` | **2** | `ECONOMIC` | 10 | 25 | 75 |
| **`ACTIVITY_GENERATION`** | `TEACHER` | **1** | `ECONOMIC` | 20 | 50 | 150 |
| **`QUIZ_GENERATION`** | `TEACHER` | **1** | `ECONOMIC` | 20 | 50 | 150 |
| **`LANDING_GENERATION`** | `TEACHER` | **8** | `PREMIUM` | 1 | 3 | 8 |
| **`LESSON_REGENERATION`** | `TEACHER` | **1** | `ECONOMIC` | 10 | 25 | 75 |
| **`COURSE_REGENERATION`** | `TEACHER` | **3** | `PREMIUM` | 2 | 5 | 15 |
| **`AI_TUTOR`** | `STUDENT` | **1** | `ECONOMIC` | 0 | 200 | 800 |
| **`AI_FEEDBACK`** | `STUDENT` | **1** | `ECONOMIC` | 0 | 200 | 800 |

---

## Tiers de IA (`AITier`)

1. **`FREE`** (0 Créditos / $0.00 Coste API): Slugs, formateo, renderizado de certificados SHA-256.
2. **`ECONOMIC`**: Gemini 1.5 Flash / GPT-4o-mini para generación de lecciones, actividades, quizzes y respuestas del tutor.
3. **`PREMIUM`**: Claude 3.5 Sonnet / GPT-4o para el diseño de estructura de cursos completos y copywriting de landing pages.

---

## Credit Engine Core

El servicio `AICreditEngine` (`src/modules/ai/ai.credit-engine.ts`) administra el consumo transaccional de créditos de IA.

### Responsabilidades Clave:
1. **Validación de Operaciones**: Comprueba que la operación exista en `AI_OPERATION_CATALOG`.
2. **Validación de Tenant & User**: Verifica que el `tenantId` exista y que el `userId` pertenezca al tenant mediante `Membership`.
3. **Determinación de Créditos**: Obtiene de forma determinista el `creditType` (`TEACHER` o `STUDENT`) y `creditCost` desde el catálogo.
4. **Idempotencia**: Garantiza mediante `idempotencyKey` que solicitudes reintentadas o duplicadas no descuenten créditos dos veces. Si la clave pertenece a otro tenant, lanza `IDEMPOTENCY_CONFLICT`.
5. **Atomicidad & Concurrencia**: Descuenta créditos mediante actualización atómica condicional (`[balanceField]: { gte: creditCost }`) y registra el ledger en la misma transacción atómica de Prisma (`$transaction`). Si el saldo es insuficiente, lanza `INSUFFICIENT_AI_CREDITS` sin generar saldo negativo.
6. **Operaciones FREE**: Si `creditCost === 0`, retorna `creditsUsed: 0` sin modificar la wallet ni registrar transacciones de consumo.

---

## Idempotency & Concurrency Hardening

### Estrategia de Idempotencia y Reintentos
- **`idempotencyKey`**: Identificador único generado por el cliente/Server Action (ej. `crypto.randomUUID()`).
- **Constraint `@unique` en PostgreSQL**: `AICreditTransaction.idempotencyKey` está protegido por un índice único a nivel de base de datos.
- **Manejo de P2002**: Si dos peticiones concurrentes con la misma `idempotencyKey` superan la comprobación inicial en findUnique, la base de datos aborta la segunda transacción con el error `P2002`. El motor captura este evento, revierte el descuento y devuelve la respuesta idempotente con `alreadyProcessed: true`.
- **Reintentos por Timeout**: Si el cliente pierde la conexión tras un timeout y reintenta la petición con el mismo `clientRequestId`, el motor recupera la transacción previa sin realizar ningún segundo cobro.
- **Protección Cross-Tenant**: Si un `idempotencyKey` pertenece a otro tenant, se rechaza inmediatamente con `IDEMPOTENCY_CONFLICT` sin revelar datos del inquilino propietario.

### Estrategia de Concurrencia y Billeteras
- **Atomic Conditional Decrement**: `updateMany({ where: { tenantId, [balanceField]: { gte: creditCost } }, data: { [balanceField]: { decrement: creditCost } } })`.
- **Prevalencia de Aislamiento**: Las peticiones simultáneas con claves diferentes que compiten por saldo limitado ejecutan la transacción en orden secuencial por PostgreSQL. Las peticiones excedentes reciben `INSUFFICIENT_AI_CREDITS` sin generar saldos negativos.
- **Aislamiento de Bolsas**: `TEACHER` credits y `STUDENT` credits residen en columnas separadas de la billetera y operan de forma 100% independiente.

---

## Automatic Refund / Compensating Transactions

Para garantizar que el usuario nunca pierda créditos en caso de un fallo en la infraestructura de IA (timeouts, errores 500/503 del proveedor o fallos de almacenamiento), `AIService` e `AICreditEngine` implementan el patrón de **Transacciones de Compensación Atómicas (MODELO A)**.

### Flujo de Compensación Transaccional:
1. `AIService` ejecuta `AICreditEngine.consumeCredits(...)` descontando créditos e introduciendo un registro de ledger de tipo `USAGE` (importe negativo, ej. `-5`).
2. `AIService` llama al proveedor externo de IA (`MockAIAdapter` / OpenAI / Anthropic).
3. **Si la llamada finaliza con éxito**: Se completa la creación del dominio y `AIUsage` apuntando al `creditTransactionId` del consumo.
4. **Si la llamada o persistencia arroja una excepción**: El bloque `catch` invoca automáticamente `AICreditEngine.refundCredits(...)`.

### Reglas de Ejecución del Refund:
- **Cuándo se ejecuta**: Únicamente tras un consumo de créditos previamente confirmado (`creditResult.transactionId`) donde la operación subsiguiente de IA haya fallado.
- **Cuándo NO se ejecuta**: Si `consumeCredits(...)` falla por `INSUFFICIENT_AI_CREDITS`, `USER_NOT_IN_TENANT` o `TENANT_NOT_FOUND` (no hubo consumo previo), o si la operación de IA finalizó con éxito.
- **Inmutabilidad del Ledger**: La transacción original de consumo (`USAGE`) NUNCA se elimina ni modifica destructivamente. Se crea una nueva `AICreditTransaction` de tipo `REFUND` con el importe positivo correspondiente (ej. `+5`) y con `referenceId` apuntando a la transacción original.
- **Protección contra Doble Refund (Double-Refund Protection)**:
  - `idempotencyKey` única: `refund:{originalTransactionId}` impide la creación de múltiples transacciones de reembolso para el mismo consumo.
  - Verificación por `referenceId`: `AICreditEngine` comprueba la existencia previa de un reembolso vinculado al mismo `originalTransactionId` en PostgreSQL. Si ya existe, retorna `alreadyProcessed: true` devolviendo el estado actual de la wallet sin incrementar saldo nuevamente.
- **Aislamiento de Bolsas (Teacher vs Student)**: `refundCredits(...)` inspecciona el `creditType` original (`TEACHER` o `STUDENT`) e incrementa únicamente la columna correspondiente (`teacherCredits` o `studentCredits`) en `AICreditWallet`.
- **Atomicidad en PostgreSQL**: El incremento de saldo en la wallet y la creación del registro `REFUND` se ejecutan dentro de un único bloque `$transaction` interactivo de Prisma con aislamientos atómicos.
- **Manejo de Fallos en el Refund**: Si el refund sufriera una interrupción de red durante la reconexión a la base de datos, el sistema registra una entrada de log estructurada de nivel `CRITICAL` con el ID de transacción original para auditoría FinOps y re-lanza el error.

---

## AI Credit Automation, Scheduling & Background Job Engine (PASO 4.4.9)

Para garantizar la automatización segura y desatendida del reset mensual de cuotas sin alterar la economía aprobada, Academia X implementa una arquitectura de background jobs orquestada e idempotente.

### 1. Componentes Principales:
- **`AICreditJobService` (`src/modules/ai/ai.job-service.ts`)**:
  - `findDueWallets(limit)`: Consulta en PostgreSQL wallets con `resetAt <= now()`.
  - `processMonthlyResetBatch(options)`: Executa en lote el reset de todas las wallets elegibles garantizando **Failure Isolation** (un fallo en el Tenant A no bloquea el procesamiento del Tenant B).
- **HTTP Route Handler (`src/app/api/cron/ai-credit-reset/route.ts`)**:
  - Endpoint de integración agnóstico compatible con Hostinger Cron / Scheduler, Supabase pg_cron, GitHub Actions o cURL.
  - Autenticado mediante cabecera `Authorization: Bearer <CRON_SECRET>` o `x-cron-secret`.
- **Server Action (`triggerMonthlyResetBatchAction`)**:
  - Invocador seguro para Next.js Server Actions y herramientas de desarrollo local.

### 2. Idempotencia, Concurrencia y Resiliencia:
- **Idempotencia Estricta**: Reutiliza `AICreditEngine.processMonthlyReset()`. Si el reset de una wallet para su fecha de facturación ya fue ejecutado, el motor retorna `{ alreadyProcessed: true }` sin duplicar asignaciones, rollover, expiraciones ni notificaciones.
- **Protección contra Ejecuciones Simultáneas**: Si dos workers o ejecuciones paralelas procesan el mismo tenant concurrentemente, el primer worker avanzará `resetAt` e inscribirá el ledger. El segundo worker leerá la wallet con `resetAt` actualizado y terminará limpiamente con `alreadyProcessed: true`.
- **Failure Isolation**: Excepciones de red o base de datos en un tenant específico son capturadas e informadas en el resumen estructurado (`AICreditJobSummary`), permitiendo que el resto del lote finalice sin interrupciones.

---

## AI Credit Administration, Monitoring & Economic Observability (PASO 4.4.10)

Para proveer visibilidad completa en tiempo real de la economía de créditos sin alterar las reglas aprobadas, Academia X implementa una capa administrativa de observabilidad y auditoría.

### 1. Componentes Principales:
- **`AICreditAdminService` (`src/modules/ai/ai.admin-service.ts`)**:
  - `getGlobalSummaryMetrics(tenantId?)`: Agregaciones de saldos, cuotas, rollovers, expiraciones, reembolsos e ingresos Top-Up.
  - `getPlanDistributionMetrics(tenantId?)`: Distribución métrica agrupada por plan (`STARTER`, `PRO`, `ACADEMY`).
  - `getJobStatusSummary()`: Monitoreo de ejecuciones de background jobs y wallets pendientes de reset.
  - `getTopUpPurchasesReport(filters)`: Reporte de compras Top-Up con filtros server-side.
  - `getLedgerAuditLog(filters)`: Auditoría de transacciones inmutables del ledger.
  - `auditTenantWalletBalance(tenantId)`: Verificación matemática de consistencia entre la wallet y la historia de transacciones del ledger sin alterar saldos en BD.
  - `detectSystemAnomalies(tenantId?)`: Detección de inconsistencias (saldos negativos, rollover excedido, resetAt desactualizado, pagos duplicados).
- **Server Actions Administrativas (`src/app/actions/ai-admin.actions.ts`)**:
  - Acciones Next.js protegidas mediante `getSessionUser()`. Garantizan que sólo usuarios con rol `SUPER_ADMIN` o `OWNER` puedan acceder, forzando el aislamiento multi-tenant en el servidor.
- **Dashboard Administrativo UI (`src/app/(dashboard)/dashboard/admin/ai-credits/page.tsx`)**:
  - Interfaz gráfica para administradores con tarjetas de salud FinOps, distribución por plan, monitor de jobs, visor de auditoría de ledger y detector de anomalías.




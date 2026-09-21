# ESTRATEGIA MULTI-TENANT - ACADEMIA X

## 1. Modelo de Aislamiento

Adoptamos **Discriminador Row-Level Multi-Tenancy (Multi-tenancy por columna `tenant_id`)** en una base de datos PostgreSQL compartida. Esta estrategia ofrece el balance óptimo entre rendimiento, costo de infraestructura y simplicidad operacional para un SaaS en etapa de crecimiento.

---

## 2. Resolución de Tenant (Tenant Resolution Pipeline)

El tenant se identifica en cada Request a través del Middleware de Next.js (`src/middleware.ts`):

1. **Subdominio o Dominio Custom**: `https://jl-institute.academiax.com` o `https://cursos.jlinstitute.com`
2. **Ruta fallback (Dev/MVP)**: `https://app.academiax.com/a/jl-institute/...`
3. **Session Context**: En solicitudes dentro del panel privado, la sesión del usuario contiene `activeTenantId`.

```typescript
// Conceptual Middleware Resolution
export async function middleware(req: NextRequest) {
  const hostname = req.headers.get("host");
  const tenant = await resolveTenantFromHostOrPath(hostname, req.nextUrl.pathname);
  
  if (!tenant) {
    return NextResponse.redirect(new URL("/404", req.url));
  }

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-tenant-id", tenant.id);
  requestHeaders.set("x-tenant-slug", tenant.slug);

  return NextResponse.next({ request: { headers: requestHeaders } });
}
```

---

## 3. Garantía de Aislamiento de Datos (Data Isolation Layer)

Para prevenir cualquier filtración de datos entre academias ("Tenant Data Leakage"):

1. **Prisma Client Extensions**:
   Se extiende la instancia de Prisma Client para inyectar automáticamente `where: { tenant_id: currentTenantId }` en todas las consultas `findMany`, `findFirst`, `update`, `delete`, etc.

```typescript
export const getTenantDb = (tenantId: string) => {
  return db.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (isTenantScopedModel(model)) {
            args.where = { ...args.where, tenant_id: tenantId };
          }
          return query(args);
        },
      },
    },
  });
};
```

2. **Supabase Row Level Security (RLS)** (Opcional si se usa Supabase DB):
   Políticas RLS en PostgreSQL: `CREATE POLICY tenant_isolation_policy ON courses USING (tenant_id = current_setting('app.current_tenant_id'));`

---

## 4. Matriz de Seguridad y Pruebas de Aislamiento

- **Integration Testing Obligatorio**: Existirá una suite de tests (`tests/tenant-isolation.test.ts`) que verificará sistemáticamente que un token/usuario perteneciente a `Tenant A` reciba HTTP 403 / 404 al intentar leer o modificar datos pertenecientes a `Tenant B`.

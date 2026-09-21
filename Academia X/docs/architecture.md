# ARQUITECTURA TÉCNICA - ACADEMIA X

## 1. Visión General de Arquitectura

El sistema está diseñado como un **Monolito Modular Multi-Tenant (Modular Monolith)** construido sobre **Next.js 15+ App Router** con **TypeScript**, **PostgreSQL** y **Prisma ORM**.

```
[ Cliente Web / Móvil ]
         │
         ▼
  [ CDN + WAF ]
         │
         ▼
[ Next.js App Router ] ─── (Middleware Tenant Resolver + RBAC Auth)
         │
 ┌───────┴────────────────────────────────────────┐
 │ Layered Application Core (Monolito Modular)   │
 │                                                │
 │  ├── Auth & Tenant Context Service            │
 │  ├── Academy & Branding Module                 │
 │  ├── Course & LMS Content Module               │
 │  ├── User & Enrollment Management              │
 │  ├── AI Generator & Credit Service             │
 │  └── Billing & Subscription Engine             │
 └───────┬────────────────────────────────────────┘
         │
 ┌───────┴────────────────────────────────────────┐
 │ Infrastructure & Persistence                   │
 │                                                │
 │  ├── PostgreSQL (Tenant Scoped Data via DAL)   │
 │  ├── Object Storage S3 (Assets / Media / Certs)│
 │  └── Asynchronous Task Queue / Outbox Worker   │
 └────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnológico

- **Frontend Core**: Next.js 15+ (App Router, Server Components & Server Actions), React 19, TypeScript.
- **Estilos & UI**: Tailwind CSS v4, Lucide Icons, Shadcn UI / Radix Primitives para accesibilidad.
- **Base de Datos**: PostgreSQL 16+.
- **ORM & Migraciones**: Prisma ORM con Client Extension para auto-scoping de `tenant_id`.
- **Autenticación**: Auth.js (NextAuth v5) / Custom JWT Session con `tenant_id` y `role` inyectados en la sesión.
- **Almacenamiento de Archivos**: AWS S3 / Cloudflare R2 / Supabase Storage via S3 SDK.
- **Integración de IA**: Abstracción nativa de Proveedor de IA (OpenAI) con Adapter Pattern, cuotas y Fail-Fast.
- **Pagos & Billing**: Stripe API (Stripe Billing & Checkout).
- **Testing**: Vitest (Unit / Integration) + Playwright (E2E).

---

## 3. Principios de Diseño Modular

1. **Aislamiento por Capas**: Los módulos de dominio (`academy`, `course`, `user`, `ai`, `billing`) no acceden directamente a las tablas de otros módulos sin pasar por la capa de servicio adecuada.
2. **Data Access Layer (DAL) Seguro**: Ninguna consulta a base de datos en módulos multi-tenant se ejecuta sin incluir implícitamente el `tenant_id`.
3. **Resiliency & Outbox Pattern**: Integraciones externas (Stripe, IA, Emails) ejecutan escrituras críticas en la DB y delegan notificaciones/tareas pesadas a workers asíncronos o eventos idempotentes.

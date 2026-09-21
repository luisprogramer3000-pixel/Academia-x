# REQUERIMIENTOS Y POLÍTICAS DE SEGURIDAD - ACADEMIA X

## 1. Principios de Seguridad Core

1. **Defensa en Profundidad**: Nunca confiar exclusivamente en validaciones de UI/Frontend. La autorización se ejecuta server-side en Middleware, Server Actions y API Routes.
2. **Strict Tenant Scoping**: Cada endpoint de API o Server Action verifica que el usuario autenticado pertenezca al `tenant_id` objetivo con el rol adecuado.
3. **Audit Log de Intentos de Acceso No Autorizado**: Cualquier intento de manipulación de `tenant_id` dispara un evento `403 Forbidden` registrando la IP, User ID y Payload en la tabla `AuditLog`.

---

## 2. Matriz RBAC (Role-Based Access Control)

| Permiso / Acción | Super Admin | Academy Owner | Teacher | Student |
|---|---|---|---|---|
| Administrar Tenants Globales / SaaS | ✅ | ❌ | ❌ | ❌ |
| Configurar Branding de Academia | ❌ | ✅ | ❌ | ❌ |
| Invitar Profesores | ❌ | ✅ | ❌ | ❌ |
| Crear / Editar Cursos de la Academia | ❌ | ✅ | ✅ | ❌ |
| Asignar Estudiantes a Cursos | ❌ | ✅ | ✅ | ❌ |
| Evaluar Tareas / Dar Feedback | ❌ | ✅ | ✅ | ❌ |
| Acceder a Cursos Inscritos | ❌ | ✅ (previsualización) | ✅ | ✅ |
| Generar Contenido con IA | ❌ | ✅ | ✅ | ❌ (o tutor delimitado) |

---

## 3. Protección de API Keys y Secrets

- Claves de IA (OpenAI, Anthropic, Gemini) y Stripe Secret Key residen únicamente en variables de entorno de servidor (`.env.local` / Secret Manager).
- Ningún secret se expone a componentes con cliente `'use client'`.

---

## 4. Sanitización y Validación de Data

- Todas las entradas son parseadas con esquemas **Zod** antes de ser enviadas a Prisma o APIs externas.
- Los contenidos de texto en Markdown/HTML de cursos se sanitizan con `DOMPurify` / `sanitize-html` en el servidor antes del renderizado para evitar XSS.

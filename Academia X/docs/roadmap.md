# ROADMAP DE DESARROLLO E IMPLEMENTACIÓN INCREMENTAL - ACADEMIA X

## PHASE 0: Discovery & Architectural Blueprint (COMPLETADO EN PROCESO)
- Auditoría del proyecto e inspección de repositorio.
- Definición de especificaciones técnicas y requerimientos en `/docs`.
- Aprobación del fundador y alineación técnica.

## PHASE 1: Core Foundation & Multi-Tenant Setup
- Inicialización del proyecto Next.js 15+ con TypeScript y Tailwind.
- Configuración de Prisma ORM + PostgreSQL.
- Sistema de Autenticación (Auth.js / JWT) y Roles (Super Admin, Owner, Teacher, Student).
- Middleware de Resolución de Tenant (`x-tenant-id`) y extensión de Prisma para aislamiento de datos.
- Tests unitarios y de integración de Aislamiento de Tenant.

## PHASE 2: Academy Management & Branding
- Portal del Profesor: Creación de nueva academia.
- Configuración de slug, logo, colores, favicon e información de contacto.
- Dashboard de la Academia con datos reales.
- Página pública básica por slug (`/a/[slug]`).

## PHASE 3: LMS & Course Builder Core
- Gestión de Cursos (Crear, Editar, Estados Draft/Published/Archived).
- Modulos y Lecciones con editor de bloques (Texto, Video, Recursos).
- Vista del Estudiante (LMS Viewer) y tracking de progreso por lección.

## PHASE 4: User Management & Enrollment
- Invitaciones por email y enlace público de registro de alumnos/profesores.
- Asignación de roles y cursos a alumnos.
- Panel de gestión de estudiantes para el profesor.

## PHASE 5: AI Copilot & Generators
- Adaptador de Inteligencia Artificial (OpenAI/Anthropic/Gemini).
- Generator de Cursos (AI Course Structure Generator).
- Workflow de Revisión y Edición por el Profesor (*AI -> Review -> Approve -> Publish*).
- Registro de consumo `AIUsage` y limites por plan.

## PHASE 6: Billing & Stripe Integration
- Checkout de suscripciones SaaS (Starter, Pro, Academy).
- Integración de Webhooks con idempotencia.
- Manejo de estados de cuenta y límites activados.

## PHASE 7: Certificate Engine & Public Verification
- Generación de certificados al completar el 100% del curso.
- Asignación de Hash de Verificación Único.
- Página pública de verificación de certificados.

## PHASE 8: Production Hardening & Testing
- Audit Logs de Seguridad.
- Optimización de rendimiento (Server Components, caching strategy).
- Suite de Tests E2E con Playwright.

## PHASE 9: Beta Launch (10-30 Teachers)
- Despliegue de JL Global Institute como primer tenant activo.
- Feedback loop e iteraciones semanales.

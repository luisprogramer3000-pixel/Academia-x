# ARQUITECTURA E INTEGRACIÓN DE IA - ACADEMIA X

## 1. Visión General

La capa de Inteligencia Artificial actúa como un copiloto para el profesor, automatizando la generación de estructuras de cursos, módulos, lecciones y materiales sin comprometer el control pedagógico.

---

## 2. Principio Core: Human-in-the-Loop Workflow

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  AI Prompt   │ ──► │  Draft Generated │ ──► │  Teacher Review  │ ──► │  Published   │
│  (Input UI)  │     │   (JSON State)   │     │  & Manual Edit   │     │  (Live LMS)  │
└──────────────┘     └──────────────────┘     └──────────────────┘     └──────────────┘
```

**Regla de Oro**: Ninguna IA publica contenido educativo directamente en el LMS sin la revisión y aprobación explícita del profesor (`AI → REVIEW → APPROVE → PUBLISH`).

---

## 3. Abstracción de Proveedores (AI Provider Adapter)

Para evitar vendor lock-in y poder conmutar modelos según costo o disponibilidad:

```typescript
export interface AIProviderAdapter {
  generateCourseStructure(params: CourseGenParams): Promise<CourseStructureOutput>;
  generateLessonContent(params: LessonGenParams): Promise<LessonContentOutput>;
}

export class OpenAIAdapter implements AIProviderAdapter { ... }
export class AnthropicAdapter implements AIProviderAdapter { ... }
export class GeminiAdapter implements AIProviderAdapter { ... }
```

---

## 4. Control de Costos y Tracking de Tokens (`AIUsage`)

Cada llamada a la IA calcula e inserta una entrada en la tabla `AIUsage`:
- `promptTokens` + `completionTokens`
- `estimatedCost` basado en la tabla de precios del modelo.
- Verificación previa de cuotas según el Plan de la Academia (Starter vs Pro vs Academy).

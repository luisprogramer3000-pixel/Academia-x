# REGLAS DE DESARROLLO Y CÓDIGO - ACADEMIA X

## Reglas Fundamentales de Ingeniería

1. **Sin Sobreingeniería**: No construir microservicios ni capas de abstracción innecesarias para características no solicitadas en la fase actual.
2. **Strict Tenant Boundaries**: Ninguna función de base de datos ni Server Action puede ejecutarse sin requerir o inferir contextualmente el `tenant_id` validado.
3. **No Hardcoding de Datos Sensibles**: Variables de entorno estrictamente segregadas.
4. **Strong Types (TypeScript)**: Cero `any` explícito en el código.
5. **Componentes Pequeños y Enfocados**: Separación de componentes UI de la lógica de negocio Server Side.
6. **Integridad de Tests**: No dar por terminada una fase sin pasar los tests unitarios y de integración de esa fase.

import type { ExtractInput } from "@/modules/presentation/engine/planner/extract";

/**
 * Caso de prueba obligatorio: "Los medios de transporte". Misma forma que
 * guarda el editor cuando la clase se prepara con el Agente de Clase:
 * explicación, un bloque por concepto clave, mapa mental, ejemplos,
 * ejercicios con solución, quiz y plan del profesor.
 */
export const TRANSPORT_LESSON: ExtractInput = {
  lessonId: "test-transport",
  title: "Los medios de transporte",
  courseTitle: "Español A1 para adolescentes",
  academyName: "Academy Ec",
  language: "es",
  level: "A1",
  blocks: [
    {
      type: "text",
      title: "Explicación",
      content:
        "Los medios de transporte son los vehículos que usamos para ir de un lugar a otro. Algunos los compartimos con muchas personas y siguen rutas fijas: son el transporte público. Otros los usamos solos o con la familia y nos dan más libertad: son el transporte personal. También se clasifican por el lugar por donde se mueven: por tierra, por rieles o por el aire.",
    },
    { type: "text", title: "Transporte público", content: "Vehículos que comparten muchas personas, con rutas y horarios fijos, como el autobús, el tren o el avión.\n\n**Ejemplo:** Tomo el autobús para ir al centro." },
    { type: "text", title: "Transporte personal", content: "Vehículos de uso individual o familiar que dan más libertad de horario, como el coche o la bicicleta.\n\n**Ejemplo:** Mi familia va al parque en coche." },
    { type: "text", title: "Coche", content: "Vehículo de cuatro ruedas con motor para pocas personas. Circula por carreteras y calles.\n\n**Ejemplo:** Mi madre va al trabajo en coche." },
    { type: "text", title: "Bicicleta", content: "Vehículo de dos ruedas que se mueve con la fuerza de las piernas. Es ecológico y sano.\n\n**Ejemplo:** Voy a la escuela en bicicleta.", url: "/test-images/bicicleta.jpg" },
    { type: "text", title: "Autobús", content: "Vehículo grande que transporta a muchas personas por rutas fijas en la ciudad o entre ciudades.\n\n**Ejemplo:** El autobús escolar recoge a los estudiantes por la mañana." },
    { type: "text", title: "Tren", content: "Transporte que circula sobre rieles y lleva a muchas personas entre ciudades de forma rápida.\n\n**Ejemplo:** Viajamos en tren a Quito." },
    { type: "text", title: "Avión", content: "Transporte aéreo que vuela y recorre grandes distancias en poco tiempo.\n\n**Ejemplo:** Vamos en avión a Madrid." },
    {
      type: "mindmap",
      title: "Clasificación: Medios de transporte",
      mindMap: {
        center: "Medios de transporte",
        branches: [
          { label: "Terrestres", children: ["Coche", "Bicicleta", "Autobús", "Tren"] },
          { label: "Aéreos", children: ["Avión", "Helicóptero"] },
          { label: "Acuáticos", children: ["Barco", "Lancha"] },
        ],
      },
    },
    { type: "text", title: "Ejemplos", content: "• Voy a la escuela en autobús.\n• Mi padre conduce el coche.\n• El tren llega a las ocho.\n• El avión vuela muy alto." },
    { type: "text", title: "Ejercicio (practica)", content: "Completa: Yo voy a la escuela en ______.\n\nSolución: autobús / bicicleta / coche (respuesta libre)" },
    { type: "text", title: "Ejercicio (produccion)", content: "Habla con tu compañero: ¿Cómo llegas a la escuela? ¿Por qué usas ese transporte?\n\nSolución: Respuesta libre usando 'voy en…'" },
    { type: "quiz", question: "¿Qué medio de transporte vuela?", options: ["Coche", "Bicicleta", "Avión", "Tren"], correctOptionIndex: 2 },
    { type: "quiz", question: "¿Cuál es un transporte personal?", options: ["Autobús", "Bicicleta", "Tren", "Avión"], correctOptionIndex: 1 },
    { type: "quiz", question: "¿Por dónde circula el tren?", options: ["Por el aire", "Por el agua", "Por rieles", "Por el cielo"], correctOptionIndex: 2 },
  ],
  teacherPlan: {
    objective: "Reconocer y nombrar los medios de transporte más comunes; diferenciar el transporte público del personal; usar la estructura 'voy en…' para describir cómo se desplazan",
    classFlow: [
      { minute: 0, durationMinutes: 10, activity: "Activación: ¿cómo llegaste hoy?" },
      { minute: 10, durationMinutes: 20, activity: "Vocabulario y conceptos" },
      { minute: 30, durationMinutes: 20, activity: "Práctica" },
      { minute: 50, durationMinutes: 10, activity: "Cierre" },
    ],
    homework: "Escribe 5 frases sobre cómo se mueve tu familia.",
    teacherNotes: ["Usa fotos reales de la ciudad de los alumnos si es posible."],
  },
};

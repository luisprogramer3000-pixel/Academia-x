/** Resultado de una presentación generada en segundo plano (con IA o fotos). */
export interface PresentationJobResult {
  /** /api/uploads/presentations/…: carpeta privada, solo el personal de la academia */
  url: string;
  /** Nombre con el que se descarga */
  fileName: string;
  slides: number;
  quality: number;
  planner: string;
  warnings: string[];
}

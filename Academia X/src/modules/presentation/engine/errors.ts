/** Errores tipados del motor de presentaciones. `code` va a los logs; `message` puede mostrarse al profesor. */

export class PresentationEngineError extends Error {
  constructor(public readonly code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class PresentationPlanningError extends PresentationEngineError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("PLANNING_FAILED", message, options);
  }
}

export class TemplateAnalysisError extends PresentationEngineError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("TEMPLATE_ANALYSIS_FAILED", message, options);
  }
}

export class AssetResolutionError extends PresentationEngineError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("ASSET_RESOLUTION_FAILED", message, options);
  }
}

export class SlideRenderError extends PresentationEngineError {
  constructor(public readonly slideId: string, message: string, options?: { cause?: unknown }) {
    super("SLIDE_RENDER_FAILED", message, options);
  }
}

export class PresentationValidationError extends PresentationEngineError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("VALIDATION_FAILED", message, options);
  }
}

export class PptxExportError extends PresentationEngineError {
  constructor(message: string, options?: { cause?: unknown }) {
    super("PPTX_EXPORT_FAILED", message, options);
  }
}

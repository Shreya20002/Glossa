import type { LiveMetrics, SessionSummary } from '../core/session'

/**
 * Messages between the main process and the engine (an Electron "utility
 * process": a separate, hidden Node.js process that runs the AI models, so
 * heavy work never freezes the windows).
 */

/** Main process → engine. */
export type EngineRequest =
  | { type: 'startSession'; modelsDir: string }
  | { type: 'audio'; samples: Float32Array }
  | { type: 'stopSession' }

/** Engine → main process. */
export type EngineEvent =
  | { type: 'sessionStarted' }
  | { type: 'metrics'; metrics: LiveMetrics }
  | { type: 'sessionEnded'; summary: SessionSummary }
  | { type: 'error'; message: string }

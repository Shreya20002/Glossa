import type { ReportCard } from '../core/report'
import type { LiveMetrics } from '../core/session'

/**
 * The contract between the main process and renderer windows.
 *
 * Renderer windows can't call Electron directly. They call functions on
 * `window.glossa` (exposed by the preload script), which send messages over
 * these IPC channels to handlers in the main process. Keeping channel names
 * and the API shape here means both sides always agree.
 */
export const IpcChannel = {
  getAppVersion: 'app:get-version',
  startSession: 'session:start',
  stopSession: 'session:stop',
  pushAudio: 'session:audio',
  sessionMetrics: 'session:metrics',
  sessionEnded: 'session:ended',
  latestReport: 'report:latest',
  copyReportImage: 'report:copy-image',
} as const

export type StartSessionFailure =
  'already-running' | 'models-missing' | 'microphone-denied' | 'engine-failed'

export type StartSessionResult =
  { ok: true } | { ok: false; reason: StartSessionFailure; message: string }

export type SessionEnded = { ok: true; report: ReportCard } | { ok: false; error: string }

/** A rectangle in a window, in CSS pixels from its top-left corner. */
export interface CaptureArea {
  x: number
  y: number
  width: number
  height: number
}

/** The API available to renderer code as `window.glossa`. */
export interface GlossaApi {
  getAppVersion(): Promise<string>
  /** Prepares the engine and opens the overlay. Start capturing audio only after `ok: true`. */
  startSession(): Promise<StartSessionResult>
  stopSession(): Promise<void>
  /** Sends one chunk of 16 kHz mono microphone audio to the engine. */
  pushAudio(samples: Float32Array): void
  /** Calls `listener` with fresh numbers several times a second. Returns an unsubscribe function. */
  onMetrics(listener: (metrics: LiveMetrics) => void): () => void
  /** Calls `listener` when a session ends, however it ended. Returns an unsubscribe function. */
  onSessionEnded(listener: (ended: SessionEnded) => void): () => void
  /** The report card for the most recent saved session, or null before the first one. */
  getLatestReport(): Promise<ReportCard | null>
  /** Copies `area` of the calling window (the report card) to the clipboard as an image. */
  copyReportImage(area: CaptureArea): Promise<void>
}

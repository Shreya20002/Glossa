import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { buildReport, isWorthSaving, TREND_SESSIONS } from '../core/report'
import type { ReportCard } from '../core/report'
import type { SessionRecord } from '../core/sessionRecord'
import type { EngineEvent } from '../shared/engine'
import { IpcChannel } from '../shared/ipc'
import type { SessionEnded, StartSessionResult } from '../shared/ipc'
import { REQUIRED_MODEL_FILES } from '../shared/models'
import { modelsDir } from './engine'
import type { EngineHost } from './engine'
import { appendSessionRecord, readRecentSessionRecords } from './history'
import { ensureMicrophoneAccess } from './permissions'
import { createOverlayWindow } from './windows'

/**
 * Loading the models for the first time (~45 MB) can take a while on a slow
 * disk or while antivirus software scans them.
 */
const START_TIMEOUT_MS = 30_000

/** On stop, the engine finishes queued audio and transcribes the last sentence. */
const STOP_TIMEOUT_MS = 15_000

type Phase = 'idle' | 'starting' | 'live' | 'stopping'

/**
 * Runs one coaching session at a time: prepares the engine, opens the
 * overlay, forwards microphone audio, and when it ends, saves it to the
 * history and sends every window its report card.
 */
export class SessionController {
  private phase: Phase = 'idle'
  private overlay: BrowserWindow | undefined
  /** When the current session started, by the computer's clock (for the report card's date). */
  private startedAtMs = 0

  constructor(
    private readonly engine: EngineHost,
    private readonly historyFile: string,
    private readonly devServerUrl: string | undefined,
  ) {
    engine.onEvent((event) => this.onEngineEvent(event))
  }

  async start(): Promise<StartSessionResult> {
    if (this.phase !== 'idle') {
      return { ok: false, reason: 'already-running', message: 'A session is already running.' }
    }
    const dir = modelsDir()
    if (!REQUIRED_MODEL_FILES.every((file) => existsSync(join(dir, file)))) {
      return {
        ok: false,
        reason: 'models-missing',
        message: `Speech models are missing from ${dir}. Run "pnpm fetch-models" and try again.`,
      }
    }

    this.phase = 'starting'
    if (!(await ensureMicrophoneAccess())) {
      this.phase = 'idle'
      return {
        ok: false,
        reason: 'microphone-denied',
        message:
          'Glossa needs microphone access. Turn it on in System Settings → Privacy & Security → Microphone.',
      }
    }
    try {
      await this.engine.request(
        { type: 'startSession', modelsDir: dir },
        'sessionStarted',
        START_TIMEOUT_MS,
      )
    } catch (error) {
      this.phase = 'idle'
      return { ok: false, reason: 'engine-failed', message: errorMessage(error) }
    }

    const overlay = createOverlayWindow(this.devServerUrl)
    // If the overlay is closed some other way (e.g. Cmd+W), end the session too.
    overlay.on('closed', () => void this.stop())
    this.overlay = overlay
    this.startedAtMs = Date.now()
    this.phase = 'live'
    return { ok: true }
  }

  pushAudio(samples: Float32Array): void {
    if (this.phase === 'live') this.engine.send({ type: 'audio', samples })
  }

  async stop(): Promise<void> {
    if (this.phase !== 'live') return
    this.phase = 'stopping'
    let ended: SessionEnded
    try {
      const { summary } = await this.engine.request(
        { type: 'stopSession' },
        'sessionEnded',
        STOP_TIMEOUT_MS,
      )
      ended = { ok: true, report: await this.report({ startedAtMs: this.startedAtMs, summary }) }
    } catch (error) {
      ended = { ok: false, error: errorMessage(error) }
    }
    this.finish(ended)
  }

  /**
   * Saves the session to the history (if it's long enough to count) and
   * builds its report card. If the history can't be read or written, the card
   * still shows this session, just without comparisons.
   */
  private async report(session: SessionRecord): Promise<ReportCard> {
    let earlier: SessionRecord[] = []
    let saved = false
    try {
      earlier = await readRecentSessionRecords(this.historyFile, TREND_SESSIONS)
      if (isWorthSaving(session.summary)) {
        await appendSessionRecord(this.historyFile, session)
        saved = true
      }
    } catch (error) {
      console.error('[history] could not update the session history:', error)
    }
    return buildReport(session, earlier, saved)
  }

  private onEngineEvent(event: EngineEvent): void {
    if (this.phase !== 'live') return
    if (event.type === 'metrics') broadcast(IpcChannel.sessionMetrics, event.metrics)
    // An error that isn't a reply to start/stop means the session can't continue.
    if (event.type === 'error') this.finish({ ok: false, error: event.message })
  }

  private finish(ended: SessionEnded): void {
    this.phase = 'idle'
    const overlay = this.overlay
    this.overlay = undefined
    if (overlay && !overlay.isDestroyed()) overlay.close()
    broadcast(IpcChannel.sessionEnded, ended)
  }
}

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

import { useEffect, useRef, useState } from 'react'
import { fillerLabel } from '../../core/fillers'
import type { FillerSummary } from '../../core/fillers'
import { formatDuration, formatPercent } from '../../core/format'
import type { PaceBand } from '../../core/pace'
import type { ReportCard as Report } from '../../core/report'
import type { LiveMetrics } from '../../core/session'
import { describeMicrophoneError, startMicrophoneCapture } from '../audio/microphone'
import type { MicrophoneCapture } from '../audio/microphone'
import { ReportCard } from './ReportCard'
import { loadMicrophoneChoice, saveMicrophoneChoice, useMicrophones } from './useMicrophones'

const FEATURES = [
  { name: 'Talk time', detail: 'How much of the session you spend speaking' },
  { name: 'Pace', detail: 'Words per minute, with a nudge when you rush' },
  { name: 'Filler words', detail: '"um", "uh", "you know"… counted live' },
  { name: 'Monologue alert', detail: 'A soft pulse after a minute without a pause' },
  { name: 'Report card', detail: 'Your progress since last time' },
] as const

const PACE_LABEL: Record<PaceBand | 'none', string> = {
  none: 'wpm',
  slow: 'wpm · slow',
  good: 'wpm · good',
  fast: 'wpm · fast',
}

/** "fillers", or "fillers · um ×3" once there's a most frequent one. */
function fillersLabel(fillers: FillerSummary | null): string {
  const top = fillers?.top[0]
  return top ? `fillers · ${fillerLabel(top.filler)} ×${top.count}` : 'fillers'
}

type Phase = 'idle' | 'starting' | 'live' | 'stopping'

export function App() {
  const [version, setVersion] = useState<string>()
  const [phase, setPhase] = useState<Phase>('idle')
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  /** The latest session's report card: from this run, or from the history at startup. */
  const [report, setReport] = useState<Report | null>(null)
  /** Why the last session ended early, if it did. */
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [microphoneId, setMicrophoneId] = useState(loadMicrophoneChoice)
  const microphones = useMicrophones()
  const capture = useRef<MicrophoneCapture | null>(null)

  // A remembered microphone that has since been unplugged falls back to the default.
  const selectedMicrophoneId = microphones.some((m) => m.deviceId === microphoneId)
    ? microphoneId
    : ''

  useEffect(() => {
    void window.glossa.getAppVersion().then(setVersion)
    // A report from a session that just ended is newer than the saved one.
    window.glossa
      .getLatestReport()
      .then((latest) => setReport((current) => current ?? latest))
      .catch((loadError: unknown) =>
        console.error('Could not load the last report card:', loadError),
      )
  }, [])

  useEffect(() => {
    const offMetrics = window.glossa.onMetrics(setMetrics)
    // Sessions can end from here, from the overlay's stop button, or because of an error.
    const offEnded = window.glossa.onSessionEnded((ended) => {
      void capture.current?.stop()
      capture.current = null
      setPhase('idle')
      setMetrics(null)
      if (ended.ok) setReport(ended.report)
      setSessionError(ended.ok ? null : ended.error)
    })
    return () => {
      offMetrics()
      offEnded()
    }
  }, [])

  async function start(): Promise<void> {
    setError(null)
    setPhase('starting')
    const result = await window.glossa.startSession()
    if (!result.ok) {
      setPhase('idle')
      setError(result.message)
      return
    }
    try {
      capture.current = await startMicrophoneCapture(selectedMicrophoneId, (samples) =>
        window.glossa.pushAudio(samples),
      )
      setPhase('live')
    } catch (captureError) {
      await window.glossa.stopSession()
      setSessionError(null)
      setError(describeMicrophoneError(captureError))
    }
  }

  async function stop(): Promise<void> {
    setPhase('stopping')
    await capture.current?.stop()
    capture.current = null
    await window.glossa.stopSession()
  }

  function chooseMicrophone(deviceId: string): void {
    setMicrophoneId(deviceId)
    saveMicrophoneChoice(deviceId)
  }

  const running = phase === 'live' || phase === 'stopping'

  return (
    <main className="home">
      <header>
        <h1 className="wordmark">Glossa</h1>
        <p className="tagline">An invisible speech coach just for you.</p>
      </header>

      {running ? (
        <section className="live" aria-live="polite">
          <p className="live-status">
            <span className="live-dot" data-speaking={metrics?.isSpeaking ?? false} />
            {metrics?.isSpeaking ? 'Speaking' : 'Listening'}
          </p>
          <div className="live-stats">
            <div>
              <span className="live-value">{formatPercent(metrics?.talkRatio ?? 0)}</span>
              <span className="live-label">talk time</span>
            </div>
            <div>
              <span className="live-value" data-pace={metrics?.pace ?? 'none'}>
                {metrics?.wordsPerMinute ?? '—'}
              </span>
              <span className="live-label">{PACE_LABEL[metrics?.pace ?? 'none']}</span>
            </div>
            <div>
              <span className="live-value">{metrics?.fillers.total ?? 0}</span>
              <span className="live-label">{fillersLabel(metrics?.fillers ?? null)}</span>
            </div>
            <div>
              <span className="live-value">{formatDuration(metrics?.elapsedMs ?? 0)}</span>
              <span className="live-label">elapsed</span>
            </div>
          </div>
          {metrics?.isMonologue ? (
            <p className="monologue" data-testid="monologue-alert">
              You've been talking for {formatDuration(metrics.currentTurnMs)}. Pause to let others
              come in.
            </p>
          ) : (
            <p className="hint">The overlay in the corner of your screen shows the same numbers.</p>
          )}
        </section>
      ) : report ? (
        <ReportCard report={report} />
      ) : (
        <ul className="features">
          {FEATURES.map((feature) => (
            <li key={feature.name}>
              <span className="feature-name">{feature.name}</span>
              <span className="feature-detail">{feature.detail}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="actions">
        <label className="microphone">
          <span>Microphone</span>
          <select
            value={selectedMicrophoneId}
            onChange={(event) => chooseMicrophone(event.target.value)}
            disabled={phase !== 'idle'}
          >
            <option value="">System default</option>
            {microphones
              .filter((m) => m.deviceId !== 'default' && m.deviceId !== '')
              .map((m, index) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || `Microphone ${index + 1}`}
                </option>
              ))}
          </select>
        </label>

        {running ? (
          <button
            className="start"
            type="button"
            onClick={() => void stop()}
            disabled={phase === 'stopping'}
          >
            {phase === 'stopping' ? 'Stopping…' : 'Stop session'}
          </button>
        ) : (
          <button
            className="start"
            type="button"
            onClick={() => void start()}
            disabled={phase === 'starting'}
          >
            {phase === 'starting' ? 'Starting…' : 'Start session'}
          </button>
        )}

        {error && (
          <p className="message error" role="alert">
            {error}
          </p>
        )}
        {!error && phase === 'idle' && sessionError && (
          <p className="message error" role="alert">
            The session stopped unexpectedly: {sessionError}
          </p>
        )}
      </div>

      <footer>{version ? `v${version} · ` : ''}Offline. Nothing leaves this computer.</footer>
    </main>
  )
}

import { useEffect, useRef, useState } from 'react'
import { formatDuration, formatPercent } from '../../core/format'
import type { PaceBand } from '../../core/pace'
import type { LiveMetrics } from '../../core/session'
import type { SessionEnded } from '../../shared/ipc'
import { describeMicrophoneError, startMicrophoneCapture } from '../audio/microphone'
import type { MicrophoneCapture } from '../audio/microphone'
import { loadMicrophoneChoice, saveMicrophoneChoice, useMicrophones } from './useMicrophones'

const FEATURES = [
  { name: 'Talk time', detail: 'How much of the session you spend speaking' },
  { name: 'Pace', detail: 'Words per minute, with a nudge when you rush' },
  { name: 'Filler words', detail: '"um", "uh", "you know"… counted live', soon: true },
  { name: 'Monologue alert', detail: 'A soft pulse after a minute without a pause', soon: true },
  { name: 'Report card', detail: 'Your progress since last time', soon: true },
] as const

const PACE_LABEL: Record<PaceBand | 'none', string> = {
  none: 'wpm',
  slow: 'wpm · slow',
  good: 'wpm · good',
  fast: 'wpm · fast',
}

type Phase = 'idle' | 'starting' | 'live' | 'stopping'

export function App() {
  const [version, setVersion] = useState<string>()
  const [phase, setPhase] = useState<Phase>('idle')
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  const [lastSession, setLastSession] = useState<SessionEnded | null>(null)
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
  }, [])

  useEffect(() => {
    const offMetrics = window.glossa.onMetrics(setMetrics)
    // Sessions can end from here, from the overlay's stop button, or because of an error.
    const offEnded = window.glossa.onSessionEnded((ended) => {
      void capture.current?.stop()
      capture.current = null
      setPhase('idle')
      setMetrics(null)
      setLastSession(ended)
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
      setLastSession(null)
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
              <span className="live-value">{formatDuration(metrics?.elapsedMs ?? 0)}</span>
              <span className="live-label">elapsed</span>
            </div>
          </div>
          <p className="hint">The overlay in the corner of your screen shows the same numbers.</p>
        </section>
      ) : (
        <ul className="features">
          {FEATURES.map((feature) => (
            <li key={feature.name}>
              <span className="feature-name">
                {feature.name}
                {'soon' in feature && <span className="soon">soon</span>}
              </span>
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
        {!error && phase === 'idle' && lastSession?.ok && (
          <p className="message" data-testid="last-session">
            Last session: {formatDuration(lastSession.summary.durationMs)}. You spoke for{' '}
            {formatDuration(lastSession.summary.speakingMs)} (
            {formatPercent(lastSession.summary.talkRatio)} of the time)
            {lastSession.summary.wordsPerMinute !== null &&
              ` at ${lastSession.summary.wordsPerMinute} words per minute`}
            .
          </p>
        )}
        {!error && phase === 'idle' && lastSession && !lastSession.ok && (
          <p className="message error" role="alert">
            The session stopped unexpectedly: {lastSession.error}
          </p>
        )}
      </div>

      <footer>{version ? `v${version} · ` : ''}Offline. Nothing leaves this computer.</footer>
    </main>
  )
}

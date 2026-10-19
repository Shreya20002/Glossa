import { useEffect, useState } from 'react'
import { fillerLabel } from '../../core/fillers'
import { formatDuration, formatPercent } from '../../core/format'
import type { PaceBand } from '../../core/pace'
import type { LiveMetrics } from '../../core/session'

const PACE_HINT: Record<PaceBand, string> = {
  slow: 'A little slow',
  good: 'Good pace',
  fast: 'A little fast: slow down',
}

/** Hover text listing the most frequent fillers, e.g. "um ×3, like ×1". */
function fillersHint(metrics: LiveMetrics | null): string {
  const top = metrics?.fillers.top ?? []
  if (top.length === 0) return 'No filler words yet'
  return top.map(({ filler, count }) => `${fillerLabel(filler)} ×${count}`).join(', ')
}

/** The floating pill shown during a session. Drag it anywhere; ■ ends the session. */
export function Overlay() {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)

  useEffect(() => window.glossa.onMetrics(setMetrics), [])

  const speaking = metrics?.isSpeaking ?? false
  const pace = metrics?.pace ?? null
  const monologue = metrics?.isMonologue ?? false

  return (
    <div className="pill" data-testid="pill" data-monologue={monologue}>
      <span
        className="dot"
        data-testid="speaking-indicator"
        data-speaking={speaking}
        role="img"
        aria-label={speaking ? 'Speaking' : 'Not speaking'}
      />
      <div className="stat">
        <span className="value" data-testid="talk-ratio">
          {formatPercent(metrics?.talkRatio ?? 0)}
        </span>
        <span className="label">talk</span>
      </div>
      <div
        className="stat"
        data-pace={pace ?? 'none'}
        title={pace ? PACE_HINT[pace] : 'Pace appears after a few sentences'}
      >
        <span className="value" data-testid="pace">
          {metrics?.wordsPerMinute ?? '—'}
        </span>
        <span className="label">wpm</span>
      </div>
      <div className="stat" title={fillersHint(metrics)}>
        <span className="value" data-testid="fillers">
          {metrics?.fillers.total ?? 0}
        </span>
        <span className="label">{metrics?.fillers.total === 1 ? 'filler' : 'fillers'}</span>
      </div>
      <div className="stat">
        <span className="value" data-testid="elapsed">
          {formatDuration(metrics?.elapsedMs ?? 0)}
        </span>
        <span className="label">time</span>
      </div>
      <button
        className="stop"
        type="button"
        title="Stop session"
        aria-label="Stop session"
        onClick={() => void window.glossa.stopSession()}
      >
        <span aria-hidden="true" className="stop-icon" />
      </button>
      <span className="visually-hidden" role="status">
        {monologue ? "You've been talking for over a minute. Pause to let others come in." : ''}
      </span>
    </div>
  )
}

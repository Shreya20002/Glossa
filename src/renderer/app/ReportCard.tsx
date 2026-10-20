import { Fragment, useEffect, useRef, useState } from 'react'
import { fillerLabel } from '../../core/fillers'
import { formatDuration, formatPercent, formatSessionLength } from '../../core/format'
import {
  compareFillers,
  compareLongestTurn,
  comparePace,
  compareTalkTime,
  MIN_SAVED_SPEECH_MS,
} from '../../core/report'
import type { Change, ReportCard as Report } from '../../core/report'
import type { SessionSummary } from '../../core/session'
import { FillerTrend } from './FillerTrend'

/** "Oct 20, 3:42 PM", in the computer's language and time zone. */
const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** How long the copy button says "Copied" before going back to normal. */
const COPY_MESSAGE_MS = 2_000

/** One line of the card: a number, and how it compares with last time. */
interface Row {
  label: string
  value: string
  /** Null for the first session, or when last time had no number to compare. */
  comparison: { change: Change; previous: string } | null
  /** A smaller line underneath, e.g. which fillers. */
  detail?: string | undefined
}

/** The card's lines for `now`, compared with `before` (the previous saved session) if there is one. */
function rows(now: SessionSummary, before: SessionSummary | null): Row[] {
  const versus = (change: Change | null, previous: string) => (change ? { change, previous } : null)
  return [
    {
      label: 'Talk time',
      value: formatPercent(now.talkRatio),
      comparison: before && versus(compareTalkTime(now, before), formatPercent(before.talkRatio)),
    },
    {
      label: 'Pace',
      value: now.wordsPerMinute === null ? '—' : `${now.wordsPerMinute} wpm`,
      comparison: before && versus(comparePace(now, before), `${before.wordsPerMinute}`),
    },
    {
      label: 'Filler words',
      value:
        now.fillers.perMinute === null
          ? `${now.fillers.total} total`
          : `${now.fillers.perMinute}/min`,
      comparison: before && versus(compareFillers(now, before), `${before.fillers.perMinute}/min`),
      detail: describeFillers(now),
    },
    {
      label: 'Longest turn',
      value: formatDuration(now.longestTurnMs),
      comparison:
        before && versus(compareLongestTurn(now, before), formatDuration(before.longestTurnMs)),
      detail: now.monologues > 0 ? `${now.monologues} over a minute` : undefined,
    },
  ]
}

/** "9 total: um ×5, like ×3, you know ×1", or just the list when the total is the headline. */
function describeFillers(summary: SessionSummary): string | undefined {
  const { total, perMinute, top } = summary.fillers
  if (total === 0) return undefined
  const list = top.map(({ filler, count }) => `${fillerLabel(filler)} ×${count}`).join(', ')
  return perMinute === null ? list : `${total} total: ${list}`
}

/** A line under the numbers, when the card needs explaining. */
function noteFor(report: Report): string | null {
  if (!report.saved) {
    return report.session.summary.speakingMs < MIN_SAVED_SPEECH_MS
      ? `Too short to save. Talk for at least ${MIN_SAVED_SPEECH_MS / 1000} seconds to track your progress.`
      : 'This session couldn’t be saved to your history, so it isn’t compared.'
  }
  if (!report.previous) return 'Your first report card. Next time, you’ll see how you compare.'
  return null
}

/** "↓ from 3.2/min · better": the arrow is the direction; the word, and its colour, say if that's good. */
function ComparisonText({ change, previous }: { change: Change; previous: string }) {
  if (change.direction === 'same') return <>same as last time</>
  return (
    <>
      <span aria-hidden="true">{change.direction === 'up' ? '↑' : '↓'}</span>
      <span className="visually-hidden">{change.direction}</span> from {previous}
      {change.verdict !== 'neutral' && ` · ${change.verdict}`}
    </>
  )
}

/** The last session's numbers, compared with the one before, and a button to share them. */
export function ReportCard({ report }: { report: Report }) {
  const card = useRef<HTMLDivElement>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (copyState === 'idle') return
    const timer = setTimeout(() => setCopyState('idle'), COPY_MESSAGE_MS)
    return () => clearTimeout(timer)
  }, [copyState])

  async function copyImage(): Promise<void> {
    const box = card.current?.getBoundingClientRect()
    if (!box) return
    try {
      await window.glossa.copyReportImage({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      })
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  const { summary, startedAtMs } = report.session
  const note = noteFor(report)

  return (
    <section className="report" aria-labelledby="report-title" data-testid="report-card">
      {/* Everything inside this box, and nothing else, is copied as the image. */}
      <div className="report-card" ref={card}>
        <header className="report-header">
          <h2 id="report-title">Report card</h2>
          <p>
            {dateFormat.format(startedAtMs)} · {formatSessionLength(summary.durationMs)}
          </p>
        </header>
        <table className="report-table">
          <tbody>
            {rows(summary, report.previous?.summary ?? null).map((row) => (
              <Fragment key={row.label}>
                <tr className="report-row">
                  <th scope="row">{row.label}</th>
                  <td className="report-value">{row.value}</td>
                  <td className="report-change" data-verdict={row.comparison?.change.verdict}>
                    {row.comparison && <ComparisonText {...row.comparison} />}
                  </td>
                </tr>
                {row.detail && (
                  <tr className="report-detail">
                    <td colSpan={3}>{row.detail}</td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {report.fillerTrend.length >= 2 && <FillerTrend points={report.fillerTrend} />}
        {note && <p className="report-note">{note}</p>}
      </div>
      <button className="copy" type="button" onClick={() => void copyImage()}>
        {copyState === 'copied'
          ? 'Copied'
          : copyState === 'failed'
            ? 'Couldn’t copy'
            : 'Copy as image'}
      </button>
      <span className="visually-hidden" role="status">
        {copyState === 'copied' ? 'Report card copied to the clipboard as an image.' : ''}
      </span>
    </section>
  )
}

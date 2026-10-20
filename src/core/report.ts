import { MONOLOGUE_MS } from './monologue'
import { FAST_ABOVE_WPM, SLOW_BELOW_WPM } from './pace'
import type { SessionSummary } from './session'
import type { SessionRecord } from './sessionRecord'

/**
 * The report card shown after each session: its numbers, how they compare
 * with the session before, and how your filler rate has moved recently.
 *
 * Sessions are compared with the previous *saved* session. Saving happens in
 * the main process (src/main/history.ts); everything here is pure.
 */

/**
 * Sessions with less speech than this aren't saved, so a quick microphone
 * check never becomes the "last time" you're compared with. It's also the
 * least speech pace can be measured from (MIN_PACE_SAMPLE_MS).
 */
export const MIN_SAVED_SPEECH_MS = 5_000

/** The filler trend covers this many recent sessions: enough to show a direction. */
export const TREND_SESSIONS = 10

/** One session's filler rate, for the trend line. */
export interface TrendPoint {
  startedAtMs: number
  fillersPerMinute: number
}

export interface ReportCard {
  session: SessionRecord
  /** The saved session before this one, or null if there's nothing to compare with. */
  previous: SessionRecord | null
  /** False if this session wasn't saved (too short, or the history couldn't be written). */
  saved: boolean
  /**
   * Fillers per minute in recent saved sessions, oldest first, ending with this
   * one. Sessions too short for a rate are left out.
   */
  fillerTrend: TrendPoint[]
}

export function isWorthSaving(summary: SessionSummary): boolean {
  return summary.speakingMs >= MIN_SAVED_SPEECH_MS
}

/**
 * The card for `session`. `earlier` is the saved history before it, oldest
 * first (only the last TREND_SESSIONS matter). A session that wasn't saved
 * is shown on its own, without comparisons.
 */
export function buildReport(
  session: SessionRecord,
  earlier: readonly SessionRecord[],
  saved: boolean,
): ReportCard {
  if (!saved) return { session, previous: null, saved, fillerTrend: [] }
  return {
    session,
    previous: earlier.at(-1) ?? null,
    saved,
    fillerTrend: [...earlier, session]
      .slice(-TREND_SESSIONS)
      .flatMap(({ startedAtMs, summary }) =>
        summary.fillers.perMinute === null
          ? []
          : [{ startedAtMs, fillersPerMinute: summary.fillers.perMinute }],
      ),
  }
}

/** Whether a change is good news. Some numbers (like talk time) have no right answer. */
export type Verdict = 'better' | 'worse' | 'neutral'

/** How one number moved since the previous session, judged at the precision it's shown. */
export interface Change {
  direction: 'up' | 'down' | 'same'
  verdict: Verdict
}

/** Talk time, in whole percentages. Never better or worse: presenting and listening both have their place. */
export function compareTalkTime(now: SessionSummary, before: SessionSummary): Change {
  return compare(Math.round(now.talkRatio * 100), Math.round(before.talkRatio * 100))
}

/** Pace: moving towards the comfortable range is better. Null if either session had no pace. */
export function comparePace(now: SessionSummary, before: SessionSummary): Change | null {
  if (now.wordsPerMinute === null || before.wordsPerMinute === null) return null
  return compare(now.wordsPerMinute, before.wordsPerMinute, distanceFromGoodPace)
}

/** Fillers per minute: fewer is better. Null if either session was too short for a rate. */
export function compareFillers(now: SessionSummary, before: SessionSummary): Change | null {
  if (now.fillers.perMinute === null || before.fillers.perMinute === null) return null
  return compare(now.fillers.perMinute, before.fillers.perMinute, (rate) => rate)
}

/** Longest turn, in whole seconds: only the part over a minute is a problem. */
export function compareLongestTurn(now: SessionSummary, before: SessionSummary): Change {
  return compare(
    Math.floor(now.longestTurnMs / 1000),
    Math.floor(before.longestTurnMs / 1000),
    (seconds) => Math.max(0, seconds - MONOLOGUE_MS / 1000),
  )
}

/** How far a pace is outside the comfortable range; 0 inside it. */
function distanceFromGoodPace(wordsPerMinute: number): number {
  if (wordsPerMinute < SLOW_BELOW_WPM) return SLOW_BELOW_WPM - wordsPerMinute
  if (wordsPerMinute > FAST_ABOVE_WPM) return wordsPerMinute - FAST_ABOVE_WPM
  return 0
}

/**
 * `badness` says how far a value is from ideal (0 = ideal), so a change is
 * better or worse only if it moves that. Without it, nothing is judged.
 */
function compare(now: number, before: number, badness?: (value: number) => number): Change {
  const direction = now > before ? 'up' : now < before ? 'down' : 'same'
  if (!badness) return { direction, verdict: 'neutral' }
  const difference = badness(now) - badness(before)
  return { direction, verdict: difference < 0 ? 'better' : difference > 0 ? 'worse' : 'neutral' }
}

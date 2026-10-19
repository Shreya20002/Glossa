/**
 * Pace: how fast someone is talking, in words per minute (WPM).
 *
 * Measured over the phrases they actually spoke (see speechChunks.ts), so the
 * natural pauses inside a phrase count, but the long silences while other
 * people talk don't. That matches how public-speaking advice measures pace.
 */

/** A chunk of speech and how many words the recognizer heard in it. */
export interface TranscribedChunk {
  startMs: number
  endMs: number
  words: number
}

/** Live pace looks at the last minute of speech. */
export const PACE_WINDOW_MS = 60_000

/** Show no pace until there's at least this much speech to judge from. */
export const MIN_PACE_SAMPLE_MS = 5_000

/**
 * Below this is slow. Conversational English is usually 120–150 WPM and
 * presentations 130–160; under 110 starts to drag.
 */
export const SLOW_BELOW_WPM = 110

/** Above this is fast: listeners start to lose details. */
export const FAST_ABOVE_WPM = 170

export type PaceBand = 'slow' | 'good' | 'fast'

/** How long the chunks lasted in total: the time spent saying their words. */
export function speechSpanMs(chunks: readonly TranscribedChunk[]): number {
  return chunks.reduce((total, chunk) => total + Math.max(0, chunk.endMs - chunk.startMs), 0)
}

function wordsPerMinute(chunks: readonly TranscribedChunk[]): number | null {
  const spanMs = speechSpanMs(chunks)
  if (spanMs < MIN_PACE_SAMPLE_MS) return null
  const words = chunks.reduce((total, chunk) => total + chunk.words, 0)
  return Math.round(words / (spanMs / 60_000))
}

/** Pace over the chunks that ended in the last minute before `nowMs`, or null if too little speech. */
export function recentWordsPerMinute(
  chunks: readonly TranscribedChunk[],
  nowMs: number,
): number | null {
  return wordsPerMinute(chunks.filter((chunk) => chunk.endMs > nowMs - PACE_WINDOW_MS))
}

/** Pace over a whole session, or null if too little speech. */
export function averageWordsPerMinute(chunks: readonly TranscribedChunk[]): number | null {
  return wordsPerMinute(chunks)
}

export function paceBand(wordsPerMinuteValue: number): PaceBand {
  if (wordsPerMinuteValue < SLOW_BELOW_WPM) return 'slow'
  if (wordsPerMinuteValue > FAST_ABOVE_WPM) return 'fast'
  return 'good'
}

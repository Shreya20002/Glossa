import { FILLER_WORDS } from './fillers'
import type { FillerSummary, FillerWord } from './fillers'
import type { SessionSummary } from './session'

/**
 * A finished session as saved in your history: when it started, and its final
 * numbers. Numbers only, never audio or words (see docs/privacy.md).
 *
 * Each session is one line of JSON in a file on your computer
 * (src/main/history.ts). That file could be damaged or edited by hand, so
 * reading a line checks every field instead of trusting it.
 */
export interface SessionRecord {
  /** When the session started, in milliseconds since 1970 (the computer's clock). */
  startedAtMs: number
  summary: SessionSummary
}

/**
 * Written into every line. If the saved format ever changes in a way older
 * versions can't read, this goes up, and lines with another version are skipped.
 */
export const SESSION_RECORD_VERSION = 1

/** One line of JSON (no line breaks) for the history file. */
export function serializeSessionRecord(record: SessionRecord): string {
  return JSON.stringify({ v: SESSION_RECORD_VERSION, ...record })
}

/** Reads one line of the history file, or returns null if it isn't a valid record. */
export function parseSessionRecord(line: string): SessionRecord | null {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (!isObject(value) || value['v'] !== SESSION_RECORD_VERSION) return null
  const { startedAtMs } = value
  const summary = parseSummary(value['summary'])
  if (!isAmount(startedAtMs) || !summary) return null
  return { startedAtMs, summary }
}

/** Copies only the fields Glossa knows, so nothing unexpected reaches the app's windows. */
function parseSummary(value: unknown): SessionSummary | null {
  if (!isObject(value)) return null
  const { durationMs, speakingMs, talkRatio, words, wordsPerMinute, longestTurnMs, monologues } =
    value
  const fillers = parseFillers(value['fillers'])
  if (
    !isAmount(durationMs) ||
    !isAmount(speakingMs) ||
    !isAmount(talkRatio) ||
    talkRatio > 1 ||
    !isAmount(words) ||
    !isAmountOrNull(wordsPerMinute) ||
    !isAmount(longestTurnMs) ||
    !isAmount(monologues) ||
    !fillers
  ) {
    return null
  }
  return {
    durationMs,
    speakingMs,
    talkRatio,
    words,
    wordsPerMinute,
    fillers,
    longestTurnMs,
    monologues,
  }
}

function parseFillers(value: unknown): FillerSummary | null {
  if (!isObject(value)) return null
  const { total, perMinute } = value
  const entries: unknown = value['top']
  if (!isAmount(total) || !isAmountOrNull(perMinute) || !Array.isArray(entries)) return null
  const top: FillerSummary['top'] = []
  for (const entry of entries as unknown[]) {
    if (!isObject(entry)) return null
    const { filler, count } = entry
    if (!isFillerWord(filler) || !isAmount(count)) return null
    top.push({ filler, count })
  }
  return { total, perMinute, top }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A real number, zero or more: every count, duration and rate Glossa saves. */
function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isAmountOrNull(value: unknown): value is number | null {
  return value === null || isAmount(value)
}

const KNOWN_FILLERS: ReadonlySet<unknown> = new Set(FILLER_WORDS)

function isFillerWord(value: unknown): value is FillerWord {
  return KNOWN_FILLERS.has(value)
}

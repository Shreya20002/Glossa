/**
 * Formats a duration as "m:ss" (65_000 → "1:05"), or "h:mm:ss" from one hour up.
 *
 * Partial seconds are dropped, so a timer never shows a second that hasn't
 * fully passed. Negative or non-finite input is treated as zero.
 */
export function formatDuration(durationMs: number): string {
  const totalSeconds =
    Number.isFinite(durationMs) && durationMs > 0 ? Math.floor(durationMs / 1000) : 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`
}

/**
 * Formats a 0–1 ratio as a whole percentage (0.684 → "68%").
 *
 * Values are clamped to 0–100% and non-finite input counts as zero, so a bad
 * measurement can never show "NaN%" or "130%".
 */
export function formatPercent(ratio: number): string {
  const clamped = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
  return `${Math.round(clamped * 100)}%`
}

/**
 * Formats how long a session lasted, for reading at a glance: seconds under a
 * minute ("24 sec"), otherwise whole minutes ("32 min").
 */
export function formatSessionLength(durationMs: number): string {
  const seconds = Number.isFinite(durationMs) && durationMs > 0 ? Math.floor(durationMs / 1000) : 0
  return seconds < 60 ? `${seconds} sec` : `${Math.round(seconds / 60)} min`
}

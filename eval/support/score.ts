import { FILLER_WORDS } from '../../src/core/fillers'
import type { FillerCounts, FillerWord } from '../../src/core/fillers'

/** Hesitation sounds. The rest of FILLER_WORDS are lexical fillers ("like", "you know"…). */
export const VOCAL_FILLERS: readonly FillerWord[] = ['um', 'uh', 'er', 'erm', 'ah', 'hmm']
export const LEXICAL_FILLERS: readonly FillerWord[] = FILLER_WORDS.filter(
  (filler) => !VOCAL_FILLERS.includes(filler),
)

export const total = (counts: FillerCounts, kinds: readonly FillerWord[]): number =>
  kinds.reduce((sum, kind) => sum + (counts[kind] ?? 0), 0)

/** Words for comparing transcripts: lower case, no punctuation ("T_V_" → "tv"). */
export function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/_/g, '')
    .replace(/[^\p{L}\p{N}' -]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Word error rate: the fewest word insertions, deletions and substitutions that
 * turn the reference into the hypothesis, divided by the reference length.
 */
export function wordErrorRate(reference: string[], hypothesis: string[]): number {
  if (reference.length === 0) return hypothesis.length === 0 ? 0 : 1
  let previous = Array.from({ length: hypothesis.length + 1 }, (_, j) => j)
  for (let i = 1; i <= reference.length; i++) {
    const current = [i]
    for (let j = 1; j <= hypothesis.length; j++) {
      const substitution = previous[j - 1]! + (reference[i - 1] === hypothesis[j - 1] ? 0 : 1)
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, substitution)
    }
    previous = current
  }
  return previous[hypothesis.length]! / reference.length
}

/** Precision and recall from per-clip counts: a detected filler "matches" up to the true count. */
export function precisionRecall(pairs: Array<{ reference: number; detected: number }>): {
  matched: number
  reference: number
  detected: number
  recall: number | null
  precision: number | null
} {
  let matched = 0
  let reference = 0
  let detected = 0
  for (const pair of pairs) {
    matched += Math.min(pair.reference, pair.detected)
    reference += pair.reference
    detected += pair.detected
  }
  return {
    matched,
    reference,
    detected,
    recall: reference === 0 ? null : matched / reference,
    precision: detected === 0 ? null : matched / detected,
  }
}

import { countFillers } from './fillers'
import type { FillerCounts } from './fillers'
import { countWords } from './words'

/** All Glossa keeps from a transcript: counts, never the words themselves. */
export interface TranscriptCounts {
  words: number
  fillers: FillerCounts
}

/** The longest phrase checked for repetition loops, in words. */
const MAX_LOOP_PHRASE_WORDS = 8

/**
 * Whisper sometimes gets stuck repeating itself ("the second part of the
 * second part of the second part…"). A phrase said more than twice in a row,
 * or a single word more than three times, is treated as such a loop and kept
 * once. Real repetition ("um, um", "no no no") is left alone.
 */
export function removeRepetitionLoops(text: string): string {
  let words = text.split(/\s+/).filter(Boolean)
  const key = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')
  for (let size = 1; size <= MAX_LOOP_PHRASE_WORDS; size++) {
    const maxRepeats = size === 1 ? 3 : 2
    const keys = words.map(key)
    const sameAt = (a: number, b: number) => {
      for (let k = 0; k < size; k++) if (keys[a + k] !== keys[b + k]) return false
      return true
    }
    const kept: string[] = []
    let i = 0
    while (i < words.length) {
      let repeats = 1
      while (i + (repeats + 1) * size <= words.length && sameAt(i, i + repeats * size)) repeats++
      const isPhrase = keys.slice(i, i + size).some(Boolean)
      if (repeats > maxRepeats && isPhrase) {
        kept.push(...words.slice(i, i + size))
        i += repeats * size
      } else {
        kept.push(words[i]!)
        i++
      }
    }
    words = kept
  }
  return words.join(' ')
}

/** Turns a chunk's transcript into counts, so the text itself can be dropped straight away. */
export function analyzeTranscript(text: string): TranscriptCounts {
  const cleaned = removeRepetitionLoops(text)
  return { words: countWords(cleaned), fillers: countFillers(cleaned) }
}

/**
 * Faster than people talk: even very fast speakers rarely pass ~300 words per
 * minute, so a transcript denser than this is a recognition glitch.
 */
export const MAX_PLAUSIBLE_WORDS_PER_MINUTE = 400

/** False if a chunk's transcript has more words than anyone could say in `spanMs`. */
export function isPlausibleTranscript(counts: TranscriptCounts, spanMs: number): boolean {
  return counts.words <= (Math.max(0, spanMs) / 60_000) * MAX_PLAUSIBLE_WORDS_PER_MINUTE
}

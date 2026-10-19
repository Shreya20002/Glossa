/**
 * Finds filler words in a transcript.
 *
 * Two kinds:
 * - **Vocal fillers**, hesitation sounds, always count: um, uh, er, erm, ah, hmm
 *   (and spellings like "umm" or "uhm").
 * - **Lexical fillers** are real words that are only fillers in some places:
 *   "it's, like, simpler" but not "I like it"; "it's, you know, hard" but not
 *   "do you know the answer?". These use the punctuation the speech recognizer
 *   adds, and lean towards *not* counting: being told you said "like" when you
 *   didn't is worse than missing one.
 *
 * Agreement sounds like "uh-huh" and "mm-hmm" are not fillers.
 */

export const FILLER_WORDS = [
  'um',
  'uh',
  'er',
  'erm',
  'ah',
  'hmm',
  'like',
  'you know',
  'i mean',
  'kind of',
  'sort of',
  'basically',
  'literally',
] as const

export type FillerWord = (typeof FILLER_WORDS)[number]

/** How many times each filler was said. Fillers that weren't said are left out. */
export type FillerCounts = Partial<Record<FillerWord, number>>

/** Hesitation sounds, and the ways speech recognizers spell them. */
const VOCAL: Readonly<Record<string, FillerWord>> = {
  um: 'um',
  umm: 'um',
  ummm: 'um',
  uhm: 'um',
  uhmm: 'um',
  uh: 'uh',
  uhh: 'uh',
  uhhh: 'uh',
  er: 'er',
  err: 'er',
  erm: 'erm',
  ermm: 'erm',
  ah: 'ah',
  ahh: 'ah',
  hmm: 'hmm',
  hm: 'hmm',
  hmmm: 'hmm',
}

/** Always fillers, wherever they appear. */
const ALWAYS: ReadonlySet<string> = new Set(['basically', 'literally'])

/** "what kind of", "a sort of": a real noun, not a hedge. */
const BEFORE_REAL_KIND_OF: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'this',
  'that',
  'these',
  'those',
  'what',
  'which',
  'some',
  'any',
  'every',
  'each',
  'no',
  'one',
  'another',
  'same',
  'different',
  'other',
  'my',
  'your',
  'his',
  'her',
  'our',
  'their',
  'its',
  'all',
  'certain',
  'particular',
])

/** "do you know", "if you know": a real question or statement, not a filler. */
const BEFORE_REAL_YOU_KNOW: ReadonlySet<string> = new Set([
  'do',
  'did',
  'does',
  "don't",
  "didn't",
  "doesn't",
  'if',
  'would',
  'will',
  'could',
  'can',
  'to',
  'let',
  'as',
])

type Token = { word: string } | { punctuation: string }

/** Words (keeping "don't", "uh-huh" whole) and punctuation marks, lower-cased. */
function tokenize(text: string): Token[] {
  const matches = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .match(/[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*|[.,!?;:…—–]/gu)
  return (matches ?? []).map((m) => (/[\p{L}\p{N}]/u.test(m) ? { word: m } : { punctuation: m }))
}

const wordAt = (tokens: Token[], i: number): string | null => {
  const token = tokens[i]
  return token && 'word' in token ? token.word : null
}

/** True if position i is the end of the text or a punctuation mark. */
const isBoundary = (tokens: Token[], i: number): boolean => {
  const token = tokens[i]
  return token === undefined || 'punctuation' in token
}

const isComma = (tokens: Token[], i: number): boolean => {
  const token = tokens[i]
  return token !== undefined && 'punctuation' in token && token.punctuation === ','
}

/** Every filler in the transcript, in order. */
export function findFillers(text: string): FillerWord[] {
  const tokens = tokenize(text)
  const found: FillerWord[] = []
  for (let i = 0; i < tokens.length; i++) {
    const word = wordAt(tokens, i)
    if (word === null) continue
    const next = wordAt(tokens, i + 1)
    const previous = wordAt(tokens, i - 1)

    const vocal = VOCAL[word]
    if (vocal) {
      found.push(vocal)
    } else if (ALWAYS.has(word)) {
      found.push(word as FillerWord)
    } else if (word === 'like' && isComma(tokens, i + 1)) {
      // "it's, like, simpler" / "like, it was" but not "I like it" or "what's it like?"
      found.push('like')
    } else if (word === 'you' && next === 'know' && isBoundary(tokens, i + 2)) {
      // "it's, you know, hard" / "it's hard, you know." but not "do you know?"
      if (previous === null || !BEFORE_REAL_YOU_KNOW.has(previous)) {
        found.push('you know')
        i++
      }
    } else if (word === 'i' && next === 'mean' && isComma(tokens, i + 2)) {
      // "I mean, it's fine" but not "I mean it" or "what I mean is"
      found.push('i mean')
      i++
    } else if ((word === 'kind' || word === 'sort') && next === 'of') {
      // "it's kind of slow" but not "what kind of car" or "a sort of tool"
      if (previous === null || !BEFORE_REAL_KIND_OF.has(previous)) {
        found.push(word === 'kind' ? 'kind of' : 'sort of')
        i++
      }
    }
  }
  return found
}

/** How many times each filler appears in the transcript. */
export function countFillers(text: string): FillerCounts {
  const counts: FillerCounts = {}
  for (const filler of findFillers(text)) counts[filler] = (counts[filler] ?? 0) + 1
  return counts
}

/** Adds two sets of counts together. */
export function addFillerCounts(a: FillerCounts, b: FillerCounts): FillerCounts {
  const total: FillerCounts = { ...a }
  for (const filler of FILLER_WORDS) {
    const count = b[filler]
    if (count) total[filler] = (total[filler] ?? 0) + count
  }
  return total
}

/** Show a per-minute rate only after this much speech: a rate from a few seconds is noise. */
export const MIN_FILLER_RATE_SAMPLE_MS = 30_000

/** How many top fillers to list ("um ×5, like ×3, you know ×2"). */
export const TOP_FILLERS = 3

export interface FillerSummary {
  total: number
  /** Fillers per minute of speech, or null until there's enough speech. */
  perMinute: number | null
  /** The most frequent fillers, most frequent first (ties: the list order above). */
  top: Array<{ filler: FillerWord; count: number }>
}

/** Totals, rate and top fillers, given how long the transcribed speech lasted. */
export function summarizeFillers(counts: FillerCounts, speechMs: number): FillerSummary {
  const entries = FILLER_WORDS.map((filler) => ({ filler, count: counts[filler] ?? 0 })).filter(
    (entry) => entry.count > 0,
  )
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)
  const top = [...entries].sort((a, b) => b.count - a.count).slice(0, TOP_FILLERS)
  const perMinute =
    speechMs >= MIN_FILLER_RATE_SAMPLE_MS
      ? Math.round((total / (speechMs / 60_000)) * 10) / 10
      : null
  return { total, perMinute, top }
}

/** How a filler is written for people: "I mean" rather than "i mean". */
export function fillerLabel(filler: FillerWord): string {
  return filler === 'i mean' ? 'I mean' : filler
}

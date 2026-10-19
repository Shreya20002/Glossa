import { describe, expect, it } from 'vitest'
import {
  analyzeTranscript,
  isPlausibleTranscript,
  MAX_PLAUSIBLE_WORDS_PER_MINUTE,
  removeRepetitionLoops,
} from './transcript'

describe('analyzeTranscript', () => {
  it('counts words and fillers together', () => {
    expect(
      analyzeTranscript('So, um, I think the main problem is, like, the setup screen.'),
    ).toEqual({ words: 12, fillers: { um: 1, like: 1 } })
  })

  it('returns zeros for silence-only transcripts', () => {
    expect(analyzeTranscript('')).toEqual({ words: 0, fillers: {} })
  })

  it('does not count words from a repetition loop', () => {
    const loop =
      "So, um, we're going to be the first part of the second part of the second part of the second part of the second part"
    // Cleaned to "So, um, we're going to be the first part of the second part".
    expect(analyzeTranscript(loop)).toEqual({ words: 13, fillers: { um: 1 } })
  })
})

describe('removeRepetitionLoops', () => {
  it('keeps one copy of a phrase repeated over and over', () => {
    expect(
      removeRepetitionLoops(
        'it is the second part of the second part of the second part of the second part.',
      ),
    ).toBe('it is the second part of the second part.')
  })

  it('collapses a single word repeated more than three times', () => {
    expect(removeRepetitionLoops('thank you you you you you')).toBe('thank you')
  })

  it('leaves real repetition alone', () => {
    const real = 'Um, um, I mean no no no, it is very very good. We tried, we tried.'
    expect(removeRepetitionLoops(real)).toBe(real)
  })

  it('ignores capital letters and punctuation when spotting a loop', () => {
    expect(removeRepetitionLoops('Okay, so. Okay so, okay so. OKAY SO done')).toBe('Okay, so. done')
  })

  it('handles empty text', () => {
    expect(removeRepetitionLoops('')).toBe('')
  })
})

describe('isPlausibleTranscript', () => {
  it('accepts normal and fast speech', () => {
    expect(isPlausibleTranscript({ words: 30, fillers: {} }, 12_000)).toBe(true) // 150 wpm
    expect(isPlausibleTranscript({ words: 60, fillers: {} }, 12_000)).toBe(true) // 300 wpm
  })

  it('rejects more words than anyone could say', () => {
    const limit = (12_000 / 60_000) * MAX_PLAUSIBLE_WORDS_PER_MINUTE
    expect(isPlausibleTranscript({ words: limit, fillers: {} }, 12_000)).toBe(true)
    expect(isPlausibleTranscript({ words: limit + 1, fillers: {} }, 12_000)).toBe(false)
  })

  it('rejects any words for a chunk with no length', () => {
    expect(isPlausibleTranscript({ words: 1, fillers: {} }, 0)).toBe(false)
    expect(isPlausibleTranscript({ words: 0, fillers: {} }, 0)).toBe(true)
  })
})

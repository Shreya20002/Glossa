import { describe, expect, it } from 'vitest'
import {
  averageWordsPerMinute,
  FAST_ABOVE_WPM,
  MIN_PACE_SAMPLE_MS,
  PACE_WINDOW_MS,
  paceBand,
  recentWordsPerMinute,
  SLOW_BELOW_WPM,
} from './pace'

describe('recentWordsPerMinute', () => {
  it('divides words by the time spent speaking them', () => {
    // 30 words in 12 s of speech = 150 WPM.
    expect(recentWordsPerMinute([{ startMs: 0, endMs: 12_000, words: 30 }], 15_000)).toBe(150)
  })

  it('ignores silence between chunks (e.g. while others talk)', () => {
    const chunks = [
      { startMs: 0, endMs: 6_000, words: 15 },
      { startMs: 40_000, endMs: 46_000, words: 15 },
    ]
    expect(recentWordsPerMinute(chunks, 50_000)).toBe(150)
  })

  it('only looks at the last minute', () => {
    const chunks = [
      { startMs: 0, endMs: 10_000, words: 40 }, // 240 WPM, a minute ago
      { startMs: 61_000, endMs: 71_000, words: 20 }, // 120 WPM, recent
    ]
    expect(recentWordsPerMinute(chunks, 10_000 + PACE_WINDOW_MS + 1)).toBe(120)
  })

  it('is null until there is enough speech to judge', () => {
    expect(recentWordsPerMinute([], 5_000)).toBeNull()
    const short = [{ startMs: 0, endMs: MIN_PACE_SAMPLE_MS - 1, words: 12 }]
    expect(recentWordsPerMinute(short, 6_000)).toBeNull()
  })

  it('is null again after a minute without speaking', () => {
    const chunks = [{ startMs: 0, endMs: 10_000, words: 25 }]
    expect(recentWordsPerMinute(chunks, 10_000 + PACE_WINDOW_MS)).toBeNull()
  })
})

describe('averageWordsPerMinute', () => {
  it('covers the whole session', () => {
    const chunks = [
      { startMs: 0, endMs: 10_000, words: 30 },
      { startMs: 120_000, endMs: 130_000, words: 20 },
    ]
    expect(averageWordsPerMinute(chunks)).toBe(150)
  })

  it('is null with too little speech', () => {
    expect(averageWordsPerMinute([])).toBeNull()
  })
})

describe('paceBand', () => {
  it('classifies pace', () => {
    expect(paceBand(SLOW_BELOW_WPM - 1)).toBe('slow')
    expect(paceBand(SLOW_BELOW_WPM)).toBe('good')
    expect(paceBand(150)).toBe('good')
    expect(paceBand(FAST_ABOVE_WPM)).toBe('good')
    expect(paceBand(FAST_ABOVE_WPM + 1)).toBe('fast')
  })
})

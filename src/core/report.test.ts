import { describe, expect, it } from 'vitest'
import {
  buildReport,
  compareFillers,
  compareLongestTurn,
  comparePace,
  compareTalkTime,
  isWorthSaving,
  MIN_SAVED_SPEECH_MS,
  TREND_SESSIONS,
} from './report'
import type { SessionSummary } from './session'
import type { SessionRecord } from './sessionRecord'

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    durationMs: 600_000,
    speakingMs: 300_000,
    talkRatio: 0.5,
    words: 750,
    wordsPerMinute: 150,
    fillers: { total: 10, perMinute: 2, top: [{ filler: 'um', count: 10 }] },
    longestTurnMs: 40_000,
    monologues: 0,
    ...overrides,
  }
}

/** A saved session with the given filler rate. */
function session(startedAtMs: number, fillersPerMinute: number | null = 2): SessionRecord {
  return {
    startedAtMs,
    summary: summary({ fillers: { total: 10, perMinute: fillersPerMinute, top: [] } }),
  }
}

describe('isWorthSaving', () => {
  it('skips a quick microphone check', () => {
    expect(isWorthSaving(summary({ speakingMs: MIN_SAVED_SPEECH_MS - 1 }))).toBe(false)
    expect(isWorthSaving(summary({ speakingMs: MIN_SAVED_SPEECH_MS }))).toBe(true)
  })
})

describe('buildReport', () => {
  it('has nothing to compare for the first session', () => {
    const first = session(1_000, 2.5)
    expect(buildReport(first, [], true)).toEqual({
      session: first,
      previous: null,
      saved: true,
      fillerTrend: [{ startedAtMs: 1_000, fillersPerMinute: 2.5 }],
    })
  })

  it('compares with the most recent earlier session', () => {
    const earlier = [session(1_000), session(2_000)]
    expect(buildReport(session(3_000), earlier, true).previous).toBe(earlier[1])
  })

  it('shows the filler trend oldest first, ending with this session', () => {
    const earlier = Array.from({ length: 12 }, (_, index) => session(index, index + 1))
    const trend = buildReport(session(99, 13), earlier, true).fillerTrend
    expect(trend).toHaveLength(TREND_SESSIONS)
    expect(trend.map((point) => point.fillersPerMinute)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
    expect(trend.at(-1)).toEqual({ startedAtMs: 99, fillersPerMinute: 13 })
  })

  it('leaves sessions without a filler rate out of the trend', () => {
    const earlier = [session(1_000, 3), session(2_000, null), session(3_000, 2)]
    expect(buildReport(session(4_000, null), earlier, true).fillerTrend).toEqual([
      { startedAtMs: 1_000, fillersPerMinute: 3 },
      { startedAtMs: 3_000, fillersPerMinute: 2 },
    ])
  })

  it('shows a session that wasn’t saved on its own', () => {
    const short = session(5_000, null)
    expect(buildReport(short, [session(1_000)], false)).toEqual({
      session: short,
      previous: null,
      saved: false,
      fillerTrend: [],
    })
  })
})

describe('compareTalkTime', () => {
  it('reports the direction but never judges it', () => {
    expect(compareTalkTime(summary({ talkRatio: 0.6 }), summary({ talkRatio: 0.4 }))).toEqual({
      direction: 'up',
      verdict: 'neutral',
    })
    expect(compareTalkTime(summary({ talkRatio: 0.3 }), summary({ talkRatio: 0.4 }))).toEqual({
      direction: 'down',
      verdict: 'neutral',
    })
  })

  it('calls changes too small to show the same', () => {
    expect(compareTalkTime(summary({ talkRatio: 0.471 }), summary({ talkRatio: 0.474 }))).toEqual({
      direction: 'same',
      verdict: 'neutral',
    })
  })
})

describe('comparePace', () => {
  const pace = (wordsPerMinute: number | null) => summary({ wordsPerMinute })

  it('is better when moving into the comfortable range', () => {
    expect(comparePace(pace(160), pace(185))).toEqual({ direction: 'down', verdict: 'better' })
    expect(comparePace(pace(120), pace(95))).toEqual({ direction: 'up', verdict: 'better' })
  })

  it('is worse when moving out of it, either way', () => {
    expect(comparePace(pace(100), pace(120))).toEqual({ direction: 'down', verdict: 'worse' })
    expect(comparePace(pace(190), pace(100))).toEqual({ direction: 'up', verdict: 'worse' })
  })

  it('doesn’t judge changes within the comfortable range', () => {
    expect(comparePace(pace(160), pace(150))).toEqual({ direction: 'up', verdict: 'neutral' })
    expect(comparePace(pace(150), pace(150))).toEqual({ direction: 'same', verdict: 'neutral' })
  })

  it('has nothing to compare if either session had no pace', () => {
    expect(comparePace(pace(null), pace(150))).toBeNull()
    expect(comparePace(pace(150), pace(null))).toBeNull()
  })
})

describe('compareFillers', () => {
  const rate = (perMinute: number | null) => summary({ fillers: { total: 10, perMinute, top: [] } })

  it('is better with fewer fillers per minute', () => {
    expect(compareFillers(rate(1.6), rate(3.2))).toEqual({ direction: 'down', verdict: 'better' })
    expect(compareFillers(rate(2.1), rate(1.5))).toEqual({ direction: 'up', verdict: 'worse' })
    expect(compareFillers(rate(1.6), rate(1.6))).toEqual({ direction: 'same', verdict: 'neutral' })
  })

  it('has nothing to compare if either session was too short for a rate', () => {
    expect(compareFillers(rate(null), rate(2))).toBeNull()
    expect(compareFillers(rate(2), rate(null))).toBeNull()
  })
})

describe('compareLongestTurn', () => {
  const turn = (longestTurnMs: number) => summary({ longestTurnMs })

  it('is better when a monologue gets shorter', () => {
    expect(compareLongestTurn(turn(48_000), turn(95_000))).toEqual({
      direction: 'down',
      verdict: 'better',
    })
    expect(compareLongestTurn(turn(100_000), turn(70_000))).toEqual({
      direction: 'up',
      verdict: 'worse',
    })
  })

  it('doesn’t judge turns under a minute', () => {
    expect(compareLongestTurn(turn(45_000), turn(30_000))).toEqual({
      direction: 'up',
      verdict: 'neutral',
    })
  })

  it('compares whole seconds, as shown', () => {
    expect(compareLongestTurn(turn(59_900), turn(59_200))).toEqual({
      direction: 'same',
      verdict: 'neutral',
    })
  })
})

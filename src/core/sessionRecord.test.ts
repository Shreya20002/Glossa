import { describe, expect, it } from 'vitest'
import { parseSessionRecord, serializeSessionRecord, SESSION_RECORD_VERSION } from './sessionRecord'
import type { SessionRecord } from './sessionRecord'

const record: SessionRecord = {
  startedAtMs: 1_792_510_920_000,
  summary: {
    durationMs: 724_000,
    speakingMs: 343_000,
    talkRatio: 0.47,
    words: 869,
    wordsPerMinute: 152,
    fillers: {
      total: 9,
      perMinute: 1.6,
      top: [
        { filler: 'um', count: 5 },
        { filler: 'like', count: 3 },
        { filler: 'you know', count: 1 },
      ],
    },
    longestTurnMs: 48_000,
    monologues: 0,
  },
}

/** The record as it's saved, for building damaged versions of it. */
const saved = { v: SESSION_RECORD_VERSION, ...record }
const { summary } = record

describe('serializeSessionRecord', () => {
  it('writes one line of JSON with the format version', () => {
    const line = serializeSessionRecord(record)
    expect(line).not.toContain('\n')
    expect(JSON.parse(line)).toEqual(saved)
  })
})

describe('parseSessionRecord', () => {
  it('reads back what was written', () => {
    expect(parseSessionRecord(serializeSessionRecord(record))).toEqual(record)
  })

  it('accepts a session too short for pace or a filler rate', () => {
    const short: SessionRecord = {
      startedAtMs: 0,
      summary: {
        ...summary,
        wordsPerMinute: null,
        fillers: { total: 0, perMinute: null, top: [] },
      },
    }
    expect(parseSessionRecord(serializeSessionRecord(short))).toEqual(short)
  })

  it('ignores fields it doesn’t know, keeping the ones it does', () => {
    const line = JSON.stringify({ ...saved, note: 'hi', summary: { ...summary, mood: 'great' } })
    expect(parseSessionRecord(line)).toEqual(record)
  })

  it('tolerates a Windows line ending', () => {
    expect(parseSessionRecord(`${serializeSessionRecord(record)}\r`)).toEqual(record)
  })

  it.each([
    ['nothing', ''],
    ['a line cut short', serializeSessionRecord(record).slice(0, 40)],
    ['a list instead of a record', '[1, 2, 3]'],
    ['another format version', JSON.stringify({ ...saved, v: 2 })],
    ['no version', JSON.stringify(record)],
    ['no start time', JSON.stringify({ ...saved, startedAtMs: undefined })],
    ['no summary', JSON.stringify({ ...saved, summary: null })],
    ['a negative duration', JSON.stringify({ ...saved, summary: { ...summary, durationMs: -1 } })],
    ['talk time over 100%', JSON.stringify({ ...saved, summary: { ...summary, talkRatio: 1.2 } })],
    ['a word count in quotes', JSON.stringify({ ...saved, summary: { ...summary, words: '869' } })],
    [
      'no longest turn',
      JSON.stringify({ ...saved, summary: { ...summary, longestTurnMs: undefined } }),
    ],
    [
      'filler totals without a list',
      JSON.stringify({ ...saved, summary: { ...summary, fillers: { total: 9, perMinute: 1.6 } } }),
    ],
    [
      'a filler Glossa doesn’t know',
      JSON.stringify({
        ...saved,
        summary: { ...summary, fillers: { ...summary.fillers, top: [{ filler: 'so', count: 2 }] } },
      }),
    ],
  ])('rejects %s', (_problem, line) => {
    expect(parseSessionRecord(line)).toBeNull()
  })
})

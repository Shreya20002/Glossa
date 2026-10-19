import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SessionRecord } from '../core/sessionRecord'
import { serializeSessionRecord } from '../core/sessionRecord'
import {
  appendSessionRecord,
  HISTORY_FILE_NAME,
  latestReport,
  readRecentSessionRecords,
} from './history'

/** A saved session; `startedAtMs` tells them apart. */
function session(startedAtMs: number): SessionRecord {
  return {
    startedAtMs,
    summary: {
      durationMs: 600_000,
      speakingMs: 300_000,
      talkRatio: 0.5,
      words: 750,
      wordsPerMinute: 150,
      fillers: { total: 10, perMinute: 2, top: [{ filler: 'um', count: 10 }] },
      longestTurnMs: 40_000,
      monologues: 0,
    },
  }
}

const startTimes = (records: readonly SessionRecord[]) => records.map((r) => r.startedAtMs)

describe('session history file', () => {
  let dir: string
  let file: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'glossa-history-'))
    file = join(dir, HISTORY_FILE_NAME)
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('is empty before the first session', async () => {
    expect(await readRecentSessionRecords(file, 10)).toEqual([])
    expect(await latestReport(file)).toBeNull()
  })

  it('adds one line per session, oldest first', async () => {
    await appendSessionRecord(file, session(1))
    await appendSessionRecord(file, session(2))
    expect(await readFile(file, 'utf8')).toBe(
      `${serializeSessionRecord(session(1))}\n${serializeSessionRecord(session(2))}\n`,
    )
    expect(await readRecentSessionRecords(file, 10)).toEqual([session(1), session(2)])
  })

  it('returns only the most recent sessions', async () => {
    for (const startedAtMs of [1, 2, 3, 4]) await appendSessionRecord(file, session(startedAtMs))
    expect(startTimes(await readRecentSessionRecords(file, 2))).toEqual([3, 4])
  })

  it('skips lines it can’t read', async () => {
    const good = serializeSessionRecord(session(1))
    await writeFile(file, `not json\n${good}\n\n{"v":99}\n`)
    expect(await readRecentSessionRecords(file, 10)).toEqual([session(1)])
  })

  it('starts a new line after one that was cut short', async () => {
    await writeFile(file, serializeSessionRecord(session(1)).slice(0, 30))
    await appendSessionRecord(file, session(2))
    expect(startTimes(await readRecentSessionRecords(file, 10))).toEqual([2])
  })

  it('builds the latest report card from the most recent sessions', async () => {
    for (const startedAtMs of [1, 2, 3]) await appendSessionRecord(file, session(startedAtMs))
    const report = await latestReport(file)
    expect(report?.session.startedAtMs).toBe(3)
    expect(report?.previous?.startedAtMs).toBe(2)
    expect(report?.fillerTrend.map((point) => point.startedAtMs)).toEqual([1, 2, 3])
  })
})

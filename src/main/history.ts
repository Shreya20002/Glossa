import { appendFile, open, readFile } from 'node:fs/promises'
import { buildReport, TREND_SESSIONS } from '../core/report'
import type { ReportCard } from '../core/report'
import { parseSessionRecord, serializeSessionRecord } from '../core/sessionRecord'
import type { SessionRecord } from '../core/sessionRecord'

/**
 * Your session history: one line of JSON per saved session, in a file in
 * Glossa's app data folder. Numbers only (see docs/privacy.md).
 *
 * New sessions are appended, never rewritten, so a crash can at worst cut the
 * last line short. Lines that can't be read are skipped.
 */

/** The history file's name, inside the app data folder. */
export const HISTORY_FILE_NAME = 'sessions.jsonl'

/** Adds a session to the end of the history, creating the file if needed. */
export async function appendSessionRecord(filePath: string, record: SessionRecord): Promise<void> {
  // If the last line was cut short, start a new one so this record stays readable.
  const separator = (await endsWithLineBreak(filePath)) ? '' : '\n'
  await appendFile(filePath, `${separator}${serializeSessionRecord(record)}\n`, 'utf8')
}

/** The last `limit` saved sessions, oldest first. No file yet means no history. */
export async function readRecentSessionRecords(
  filePath: string,
  limit: number,
): Promise<SessionRecord[]> {
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isMissingFile(error)) return []
    throw error
  }
  const records = text.split('\n').flatMap((line) => parseSessionRecord(line) ?? [])
  return records.slice(-limit)
}

/** The report card for the most recent saved session, or null if there's none yet. */
export async function latestReport(filePath: string): Promise<ReportCard | null> {
  const recent = await readRecentSessionRecords(filePath, TREND_SESSIONS)
  const last = recent.pop()
  return last ? buildReport(last, recent, true) : null
}

async function endsWithLineBreak(filePath: string): Promise<boolean> {
  let file
  try {
    file = await open(filePath, 'r')
  } catch (error) {
    if (isMissingFile(error)) return true
    throw error
  }
  try {
    const { size } = await file.stat()
    if (size === 0) return true
    const { buffer } = await file.read(Buffer.alloc(1), 0, 1, size - 1)
    return buffer[0] === 0x0a
  } finally {
    await file.close()
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

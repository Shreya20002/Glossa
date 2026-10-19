import type { VoiceActivityEvent } from './voiceActivity'

/**
 * Groups speech into chunks for the speech recognizer (Whisper).
 *
 * Whisper can't be fed tiny snippets: every call costs ~0.6 s whatever the
 * length, and for under a second of audio it tends to invent words ("you",
 * "Thanks for watching."). So Glossa transcribes whole phrases: speech
 * separated only by short pauses. A chunk closes after a long pause, or once
 * it's long enough that the pace meter should update (at the next pause), or
 * at a hard limit for people who never pause.
 *
 * All times are audio time in milliseconds since the session started.
 */

/** A pause this long ends a chunk. Shorter pauses are part of how someone talks. */
export const CHUNK_PAUSE_MS = 2_000

/** Once a chunk is this long, close it at the next pause, so pace updates during monologues. */
export const TARGET_CHUNK_MS = 12_000

/** Never let a chunk grow past this: Whisper handles at most 30 s at once. */
export const MAX_CHUNK_MS = 25_000

/** Chunks with less speech than this are dropped: Whisper invents words for them. */
export const MIN_TRANSCRIBE_SPEECH_MS = 1_000

/** A finished chunk, ready to be transcribed. */
export interface SpeechChunk {
  startMs: number
  endMs: number
  /** Time actually spent speaking inside the chunk, pauses excluded. */
  speechMs: number
}

interface OpenChunk {
  startMs: number
  /** Speaking time from segments that have already ended. */
  finishedSpeechMs: number
  /** Start of the segment in progress, or null during a pause. */
  speakingSinceMs: number | null
  /** End of the most recent finished segment, or null if none has ended yet. */
  lastSpeechEndMs: number | null
}

export interface ChunkerState {
  /** The chunk being collected, or null between chunks. */
  open: OpenChunk | null
}

export const initialChunker: ChunkerState = { open: null }

function close(chunk: SpeechChunk): SpeechChunk | null {
  return chunk.speechMs >= MIN_TRANSCRIBE_SPEECH_MS ? chunk : null
}

/**
 * Applies this frame's speech event (if any), then checks whether a chunk
 * should close at `nowMs`. Returns the closed chunk, or null if none closed or
 * the chunk was too short to transcribe.
 */
export function stepChunker(
  state: ChunkerState,
  event: VoiceActivityEvent | null,
  nowMs: number,
): { state: ChunkerState; chunk: SpeechChunk | null } {
  let open = state.open

  if (event?.type === 'speechStart') {
    open = open
      ? { ...open, speakingSinceMs: event.atMs }
      : {
          startMs: event.atMs,
          finishedSpeechMs: 0,
          speakingSinceMs: event.atMs,
          lastSpeechEndMs: null,
        }
  } else if (event?.type === 'speechEnd' && open?.speakingSinceMs != null) {
    open = {
      ...open,
      finishedSpeechMs: open.finishedSpeechMs + Math.max(0, event.atMs - open.speakingSinceMs),
      speakingSinceMs: null,
      lastSpeechEndMs: event.atMs,
    }
    // Long enough already: close at this natural pause.
    if (event.atMs - open.startMs >= TARGET_CHUNK_MS) {
      return {
        state: { open: null },
        chunk: close({ startMs: open.startMs, endMs: event.atMs, speechMs: open.finishedSpeechMs }),
      }
    }
  }

  if (!open) return { state: { open: null }, chunk: null }

  // A long pause ends the chunk where the speech ended.
  if (
    open.speakingSinceMs === null &&
    open.lastSpeechEndMs !== null &&
    nowMs - open.lastSpeechEndMs >= CHUNK_PAUSE_MS
  ) {
    return {
      state: { open: null },
      chunk: close({
        startMs: open.startMs,
        endMs: open.lastSpeechEndMs,
        speechMs: open.finishedSpeechMs,
      }),
    }
  }

  // Someone who never pauses: cut here and carry straight on in a new chunk.
  if (open.speakingSinceMs !== null && nowMs - open.startMs >= MAX_CHUNK_MS) {
    const speechMs = open.finishedSpeechMs + Math.max(0, nowMs - open.speakingSinceMs)
    return {
      state: {
        open: {
          startMs: nowMs,
          finishedSpeechMs: 0,
          speakingSinceMs: nowMs,
          lastSpeechEndMs: null,
        },
      },
      chunk: close({ startMs: open.startMs, endMs: nowMs, speechMs }),
    }
  }

  return { state: { open }, chunk: null }
}

/** Closes whatever is being collected when the session stops at `nowMs`. */
export function flushChunker(state: ChunkerState, nowMs: number): SpeechChunk | null {
  const open = state.open
  if (!open) return null
  if (open.speakingSinceMs !== null) {
    const speechMs = open.finishedSpeechMs + Math.max(0, nowMs - open.speakingSinceMs)
    return close({ startMs: open.startMs, endMs: nowMs, speechMs })
  }
  return close({
    startMs: open.startMs,
    endMs: open.lastSpeechEndMs ?? nowMs,
    speechMs: open.finishedSpeechMs,
  })
}

import type { SpeechChunk } from '../core/speechChunks'

/** Extra audio around each chunk, so Whisper hears the first and last word whole. */
export const TRANSCRIBE_PADDING_MS = 200

/** The stretch of audio to transcribe for a chunk, padding included (ms since the session started). */
export function transcriptionRange(chunk: SpeechChunk): { fromMs: number; toMs: number } {
  return {
    fromMs: chunk.startMs - TRANSCRIBE_PADDING_MS,
    toMs: chunk.endMs + TRANSCRIBE_PADDING_MS,
  }
}

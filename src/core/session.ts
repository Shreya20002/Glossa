import { addFillerCounts, summarizeFillers } from './fillers'
import type { FillerCounts, FillerSummary } from './fillers'
import { averageWordsPerMinute, paceBand, recentWordsPerMinute, speechSpanMs } from './pace'
import type { PaceBand, TranscribedChunk } from './pace'
import { isPlausibleTranscript } from './transcript'
import type { TranscriptCounts } from './transcript'
import { flushChunker, initialChunker, stepChunker } from './speechChunks'
import type { ChunkerState, SpeechChunk } from './speechChunks'
import { applyVoiceActivityEvent, initialTalkTime, speakingMsAt, talkRatio } from './talkTime'
import type { TalkTimeState } from './talkTime'
import { flushVoiceActivity, initialVoiceActivity, stepVoiceActivity } from './voiceActivity'
import type { VoiceActivityEvent, VoiceActivityState } from './voiceActivity'

/**
 * A live coaching session, driven one audio frame at a time.
 *
 * The engine feeds in each frame's speech probability and, later, the word
 * count of each transcribed chunk; everything else (speech detection, talk
 * time, pace, the numbers on the overlay) is computed here, from audio time
 * only, so a session replays identically in tests.
 */
export interface SessionState {
  /** Audio time processed so far. */
  elapsedMs: number
  voiceActivity: VoiceActivityState
  talkTime: TalkTimeState
  chunker: ChunkerState
  transcribed: readonly TranscribedChunk[]
  /** Every filler heard so far. */
  fillers: FillerCounts
}

/** What the overlay shows, updated several times a second. */
export interface LiveMetrics {
  elapsedMs: number
  speakingMs: number
  isSpeaking: boolean
  /** Share of the session spent speaking, 0–1. */
  talkRatio: number
  /** Pace over the last minute of speech, or null until there's enough. */
  wordsPerMinute: number | null
  pace: PaceBand | null
  /** Fillers so far: total, rate and the most frequent ones. */
  fillers: FillerSummary
}

/** The final numbers once a session has ended. Becomes the report card in a later step. */
export interface SessionSummary {
  durationMs: number
  speakingMs: number
  talkRatio: number
  /** Words the recognizer heard over the whole session. */
  words: number
  /** Average pace, or null if there wasn't enough speech. */
  wordsPerMinute: number | null
  fillers: FillerSummary
}

export function createSession(): SessionState {
  return {
    elapsedMs: 0,
    voiceActivity: initialVoiceActivity,
    talkTime: initialTalkTime,
    chunker: initialChunker,
    transcribed: [],
    fillers: {},
  }
}

/**
 * Advances the session by one frame of `frameDurationMs` with the given speech
 * probability. Returns the speech event this frame triggered, and a chunk of
 * speech that's ready to transcribe, if one just closed.
 */
export function processFrame(
  state: SessionState,
  probability: number,
  frameDurationMs: number,
): { state: SessionState; event: VoiceActivityEvent | null; chunk: SpeechChunk | null } {
  const frameEndMs = state.elapsedMs + frameDurationMs
  const step = stepVoiceActivity(state.voiceActivity, probability, state.elapsedMs, frameEndMs)
  const chunked = stepChunker(state.chunker, step.event, frameEndMs)
  return {
    state: {
      ...state,
      elapsedMs: frameEndMs,
      voiceActivity: step.state,
      talkTime: step.event ? applyVoiceActivityEvent(state.talkTime, step.event) : state.talkTime,
      chunker: chunked.state,
    },
    event: step.event,
    chunk: chunked.chunk,
  }
}

/**
 * Records what the recognizer heard in a chunk: its word and filler counts.
 * A transcript with more words than anyone could say in the chunk is a
 * recognition glitch, and is ignored rather than distorting pace and fillers.
 */
export function applyTranscription(
  state: SessionState,
  chunk: SpeechChunk,
  counts: TranscriptCounts,
): SessionState {
  if (!isPlausibleTranscript(counts, chunk.endMs - chunk.startMs)) return state
  return {
    ...state,
    transcribed: [
      ...state.transcribed,
      { startMs: chunk.startMs, endMs: chunk.endMs, words: counts.words },
    ],
    fillers: addFillerCounts(state.fillers, counts.fillers),
  }
}

export function liveMetrics(state: SessionState): LiveMetrics {
  const speakingMs = speakingMsAt(state.talkTime, state.elapsedMs)
  const wordsPerMinute = recentWordsPerMinute(state.transcribed, state.elapsedMs)
  return {
    elapsedMs: state.elapsedMs,
    speakingMs,
    isSpeaking: state.voiceActivity.speaking,
    talkRatio: talkRatio(speakingMs, state.elapsedMs),
    wordsPerMinute,
    pace: wordsPerMinute === null ? null : paceBand(wordsPerMinute),
    fillers: summarizeFillers(state.fillers, speechSpanMs(state.transcribed)),
  }
}

/**
 * Ends the session's speech detection: closes any speech still in progress
 * (so the last sentence counts) and returns the final chunk to transcribe.
 */
export function closeSession(state: SessionState): {
  state: SessionState
  chunk: SpeechChunk | null
} {
  const flush = flushVoiceActivity(state.voiceActivity, state.elapsedMs)
  const chunker = flush.event ? stepChunker(state.chunker, flush.event, state.elapsedMs) : null
  const chunk = chunker?.chunk ?? flushChunker(chunker?.state ?? state.chunker, state.elapsedMs)
  return {
    state: {
      ...state,
      voiceActivity: flush.state,
      talkTime: flush.event ? applyVoiceActivityEvent(state.talkTime, flush.event) : state.talkTime,
      chunker: initialChunker,
    },
    chunk,
  }
}

/** The session's final numbers. Call after closeSession and its last transcription. */
export function summarizeSession(state: SessionState): SessionSummary {
  const speakingMs = speakingMsAt(state.talkTime, state.elapsedMs)
  return {
    durationMs: state.elapsedMs,
    speakingMs,
    talkRatio: talkRatio(speakingMs, state.elapsedMs),
    words: state.transcribed.reduce((total, chunk) => total + chunk.words, 0),
    wordsPerMinute: averageWordsPerMinute(state.transcribed),
    fillers: summarizeFillers(state.fillers, speechSpanMs(state.transcribed)),
  }
}

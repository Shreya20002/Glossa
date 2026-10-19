import { applyVoiceActivityEvent, initialTalkTime, speakingMsAt, talkRatio } from './talkTime'
import type { TalkTimeState } from './talkTime'
import { flushVoiceActivity, initialVoiceActivity, stepVoiceActivity } from './voiceActivity'
import type { VoiceActivityEvent, VoiceActivityState } from './voiceActivity'

/**
 * A live coaching session, driven one audio frame at a time.
 *
 * The engine feeds in each frame's speech probability; everything else
 * (speech detection, talk time, the numbers on the overlay) is computed here,
 * from audio time only, so a session replays identically in tests.
 */
export interface SessionState {
  /** Audio time processed so far. */
  elapsedMs: number
  voiceActivity: VoiceActivityState
  talkTime: TalkTimeState
}

/** What the overlay shows, updated several times a second. */
export interface LiveMetrics {
  elapsedMs: number
  speakingMs: number
  isSpeaking: boolean
  /** Share of the session spent speaking, 0–1. */
  talkRatio: number
}

/** The final numbers once a session has ended. Becomes the report card in a later step. */
export interface SessionSummary {
  durationMs: number
  speakingMs: number
  talkRatio: number
}

export function createSession(): SessionState {
  return { elapsedMs: 0, voiceActivity: initialVoiceActivity, talkTime: initialTalkTime }
}

/** Advances the session by one frame of `frameDurationMs` with the given speech probability. */
export function processFrame(
  state: SessionState,
  probability: number,
  frameDurationMs: number,
): { state: SessionState; event: VoiceActivityEvent | null } {
  const frameEndMs = state.elapsedMs + frameDurationMs
  const step = stepVoiceActivity(state.voiceActivity, probability, state.elapsedMs, frameEndMs)
  return {
    state: {
      elapsedMs: frameEndMs,
      voiceActivity: step.state,
      talkTime: step.event ? applyVoiceActivityEvent(state.talkTime, step.event) : state.talkTime,
    },
    event: step.event,
  }
}

export function liveMetrics(state: SessionState): LiveMetrics {
  const speakingMs = speakingMsAt(state.talkTime, state.elapsedMs)
  return {
    elapsedMs: state.elapsedMs,
    speakingMs,
    isSpeaking: state.voiceActivity.speaking,
    talkRatio: talkRatio(speakingMs, state.elapsedMs),
  }
}

/** Closes any speech still in progress and returns the session's final numbers. */
export function endSession(state: SessionState): SessionSummary {
  const flush = flushVoiceActivity(state.voiceActivity, state.elapsedMs)
  const talkTime = flush.event
    ? applyVoiceActivityEvent(state.talkTime, flush.event)
    : state.talkTime
  const speakingMs = speakingMsAt(talkTime, state.elapsedMs)
  return {
    durationMs: state.elapsedMs,
    speakingMs,
    talkRatio: talkRatio(speakingMs, state.elapsedMs),
  }
}

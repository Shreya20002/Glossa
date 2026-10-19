import type { VoiceActivityEvent } from './voiceActivity'

/**
 * Talk time: how much of the session the user has spent speaking.
 *
 * Mic-only caveat: this measures sound reaching the user's microphone. With
 * headphones that's just their voice; with speakers, other people's voices
 * leak in and count too.
 */
export interface TalkTimeState {
  /** Speaking time from speech segments that have already ended. */
  finishedSpeakingMs: number
  /** When the current speech segment started, or null while silent. */
  speechStartedAtMs: number | null
}

export const initialTalkTime: TalkTimeState = { finishedSpeakingMs: 0, speechStartedAtMs: null }

/** Updates talk time with a speech start/end event. Duplicate events are ignored. */
export function applyVoiceActivityEvent(
  state: TalkTimeState,
  event: VoiceActivityEvent,
): TalkTimeState {
  if (event.type === 'speechStart') {
    return state.speechStartedAtMs === null ? { ...state, speechStartedAtMs: event.atMs } : state
  }
  if (state.speechStartedAtMs === null) return state
  return {
    finishedSpeakingMs:
      state.finishedSpeakingMs + Math.max(0, event.atMs - state.speechStartedAtMs),
    speechStartedAtMs: null,
  }
}

/** Total speaking time at `nowMs`, including the segment in progress. */
export function speakingMsAt(state: TalkTimeState, nowMs: number): number {
  const current =
    state.speechStartedAtMs === null ? 0 : Math.max(0, nowMs - state.speechStartedAtMs)
  return state.finishedSpeakingMs + current
}

/** Share of `elapsedMs` spent speaking, from 0 to 1. Zero before any time has passed. */
export function talkRatio(speakingMs: number, elapsedMs: number): number {
  if (!(elapsedMs > 0)) return 0
  return Math.min(1, Math.max(0, speakingMs / elapsedMs))
}

/**
 * Turns per-frame speech probabilities (from the Silero VAD model) into clean
 * "speech started" and "speech ended" events.
 *
 * Raw probabilities flicker: a click can spike to 0.9 for one frame, and a
 * breath between words can dip to 0.1. Two classic tricks smooth that out:
 *
 * - **Hysteresis**: speech starts when the probability rises above
 *   SPEECH_START_THRESHOLD, but only ends when it falls below the lower
 *   SPEECH_END_THRESHOLD. Values in between keep the current state.
 * - **Minimum durations**: speech must last MIN_SPEECH_MS to count, and
 *   silence must last SILENCE_HANGOVER_MS before speech is declared over.
 *
 * All times are audio time in milliseconds since the session started.
 */

/** A frame at or above this probability counts as speech. Silero's recommended default. */
export const SPEECH_START_THRESHOLD = 0.5

/** While speaking, a frame below this counts as silence. Silero recommends start − 0.15. */
export const SPEECH_END_THRESHOLD = 0.35

/** Speech shorter than this (a cough, a click, a chair creak) is ignored. Three 32 ms frames. */
export const MIN_SPEECH_MS = 96

/**
 * Silence must last this long to end speech, so normal gaps between words
 * don't split one sentence into many. Ten 32 ms frames.
 */
export const SILENCE_HANGOVER_MS = 320

export type VoiceActivityEvent =
  { type: 'speechStart'; atMs: number } | { type: 'speechEnd'; atMs: number }

export interface VoiceActivityState {
  /** True once speech has been confirmed, until silence has been confirmed. */
  speaking: boolean
  /**
   * When the state might be about to flip: the start of the current run of
   * speech frames (while silent), or of silence frames (while speaking).
   */
  pendingSinceMs: number | null
}

export const initialVoiceActivity: VoiceActivityState = { speaking: false, pendingSinceMs: null }

/**
 * Feeds one frame's speech probability. Returns the next state and the event
 * this frame triggered, if any. Events are backdated: speech "started" when
 * its first frame began, and "ended" when the silence that confirmed it began.
 * A non-finite probability (NaN) is treated as silence.
 */
export function stepVoiceActivity(
  state: VoiceActivityState,
  probability: number,
  frameStartMs: number,
  frameEndMs: number,
): { state: VoiceActivityState; event: VoiceActivityEvent | null } {
  if (!state.speaking) {
    if (!(probability >= SPEECH_START_THRESHOLD)) {
      return { state: { speaking: false, pendingSinceMs: null }, event: null }
    }
    const since = state.pendingSinceMs ?? frameStartMs
    if (frameEndMs - since >= MIN_SPEECH_MS) {
      return {
        state: { speaking: true, pendingSinceMs: null },
        event: { type: 'speechStart', atMs: since },
      }
    }
    return { state: { speaking: false, pendingSinceMs: since }, event: null }
  }

  if (probability >= SPEECH_END_THRESHOLD) {
    return { state: { speaking: true, pendingSinceMs: null }, event: null }
  }
  const since = state.pendingSinceMs ?? frameStartMs
  if (frameEndMs - since >= SILENCE_HANGOVER_MS) {
    return {
      state: { speaking: false, pendingSinceMs: null },
      event: { type: 'speechEnd', atMs: since },
    }
  }
  return { state: { speaking: true, pendingSinceMs: since }, event: null }
}

/**
 * Ends any speech still in progress when the session stops at `atMs`, so the
 * last sentence is counted. If silence had already begun, speech ends there.
 */
export function flushVoiceActivity(
  state: VoiceActivityState,
  atMs: number,
): { state: VoiceActivityState; event: VoiceActivityEvent | null } {
  if (!state.speaking) return { state: initialVoiceActivity, event: null }
  return {
    state: initialVoiceActivity,
    event: { type: 'speechEnd', atMs: state.pendingSinceMs ?? atMs },
  }
}

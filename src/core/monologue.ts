import type { VoiceActivityEvent } from './voiceActivity'

/**
 * Monologues: long stretches of talking without letting anyone else in.
 *
 * A "turn" is speech where every pause is shorter than TURN_PAUSE_MS: a
 * breath or a "so…" doesn't hand over the floor, but a couple of seconds of
 * silence gives someone else room to speak. When one turn passes
 * MONOLOGUE_MS, the overlay pulses gently (no sound: the microphone would
 * hear it).
 *
 * All times are audio time in milliseconds since the session started.
 */

/** A pause this long ends a turn: long enough for someone else to come in. */
export const TURN_PAUSE_MS = 2_000

/**
 * A turn longer than this is a monologue. A minute is a common coaching rule
 * of thumb: after that, listeners start to drift and others lose their chance
 * to join in.
 */
export const MONOLOGUE_MS = 60_000

export interface MonologueState {
  /** When the current turn started, or null between turns. */
  turnStartMs: number | null
  /** Start of the speech segment in progress, or null during a pause. */
  speakingSinceMs: number | null
  /** When the current turn's most recent speech segment ended. */
  lastSpeechEndMs: number | null
  /** Whether the current turn has already been counted as a monologue. */
  counted: boolean
  /** The longest finished turn so far. */
  longestTurnMs: number
  /** How many turns have passed MONOLOGUE_MS. */
  monologues: number
}

export const initialMonologue: MonologueState = {
  turnStartMs: null,
  speakingSinceMs: null,
  lastSpeechEndMs: null,
  counted: false,
  longestTurnMs: 0,
  monologues: 0,
}

/** How long the current turn has lasted at `nowMs`, or 0 between turns. */
export function currentTurnMs(state: MonologueState, nowMs: number): number {
  if (state.turnStartMs === null) return 0
  const end = state.speakingSinceMs !== null ? nowMs : (state.lastSpeechEndMs ?? nowMs)
  return Math.max(0, end - state.turnStartMs)
}

/** True while the current turn is a monologue: this is when the overlay pulses. */
export function isMonologue(state: MonologueState, nowMs: number): boolean {
  return currentTurnMs(state, nowMs) >= MONOLOGUE_MS
}

/** Closes the current turn, remembering it if it was the longest. */
function endTurn(state: MonologueState, lengthMs: number): MonologueState {
  return {
    turnStartMs: null,
    speakingSinceMs: null,
    lastSpeechEndMs: null,
    counted: false,
    longestTurnMs: Math.max(state.longestTurnMs, lengthMs),
    monologues: state.monologues,
  }
}

/** Counts the current turn as a monologue once it passes the limit. */
function countIfMonologue(state: MonologueState, nowMs: number): MonologueState {
  if (state.counted || !isMonologue(state, nowMs)) return state
  return { ...state, counted: true, monologues: state.monologues + 1 }
}

/** Applies this frame's speech event (if any), then updates turns at `nowMs`. */
export function stepMonologue(
  state: MonologueState,
  event: VoiceActivityEvent | null,
  nowMs: number,
): MonologueState {
  let next = state

  if (event?.type === 'speechStart') {
    next =
      next.turnStartMs === null
        ? { ...next, turnStartMs: event.atMs, speakingSinceMs: event.atMs }
        : { ...next, speakingSinceMs: event.atMs }
  } else if (event?.type === 'speechEnd' && next.speakingSinceMs !== null) {
    next = { ...next, speakingSinceMs: null, lastSpeechEndMs: event.atMs }
  }

  next = countIfMonologue(next, nowMs)

  // A long enough pause hands over the floor: the turn is over.
  if (
    next.turnStartMs !== null &&
    next.speakingSinceMs === null &&
    next.lastSpeechEndMs !== null &&
    nowMs - next.lastSpeechEndMs >= TURN_PAUSE_MS
  ) {
    next = endTurn(next, next.lastSpeechEndMs - next.turnStartMs)
  }
  return next
}

/** Ends any turn in progress when the session stops at `nowMs`. */
export function flushMonologue(state: MonologueState, nowMs: number): MonologueState {
  if (state.turnStartMs === null) return state
  const counted = countIfMonologue(state, nowMs)
  return endTurn(counted, currentTurnMs(counted, nowMs))
}

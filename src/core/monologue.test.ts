import { describe, expect, it } from 'vitest'
import {
  currentTurnMs,
  flushMonologue,
  initialMonologue,
  isMonologue,
  MONOLOGUE_MS,
  stepMonologue,
  TURN_PAUSE_MS,
} from './monologue'
import type { MonologueState } from './monologue'
import type { VoiceActivityEvent } from './voiceActivity'

const FRAME_MS = 32

/**
 * Simulates speech as [startMs, endMs] segments, ticking frame by frame up to
 * `untilMs`. Events arrive like the real detector's: a little late, backdated.
 * Returns the final state and whether the overlay would have pulsed at each tick.
 */
function simulate(segments: Array<[number, number]>, untilMs: number) {
  const events = new Map<number, VoiceActivityEvent>()
  for (const [start, end] of segments) {
    events.set(Math.ceil((start + 96) / FRAME_MS) * FRAME_MS, { type: 'speechStart', atMs: start })
    events.set(Math.ceil((end + 320) / FRAME_MS) * FRAME_MS, { type: 'speechEnd', atMs: end })
  }
  let state: MonologueState = initialMonologue
  const pulsing: number[] = []
  for (let now = FRAME_MS; now <= untilMs; now += FRAME_MS) {
    state = stepMonologue(state, events.get(now) ?? null, now)
    if (isMonologue(state, now)) pulsing.push(now)
  }
  return { state, pulsing }
}

/** Sentences of `sentenceMs` separated by `pauseMs`, from `fromMs` for `totalMs`. */
function talk(fromMs: number, totalMs: number, sentenceMs = 4_000, pauseMs = 600) {
  const segments: Array<[number, number]> = []
  for (let t = fromMs; t < fromMs + totalMs; t += sentenceMs + pauseMs) {
    segments.push([t, Math.min(t + sentenceMs, fromMs + totalMs)])
  }
  return segments
}

describe('stepMonologue', () => {
  it('does not alert for normal back-and-forth', () => {
    // 20 s of talking, a pause for the other person, 20 s more.
    const { state, pulsing } = simulate([...talk(0, 20_000), ...talk(30_000, 20_000)], 60_000)
    expect(pulsing).toEqual([])
    expect(state.monologues).toBe(0)
  })

  it('keeps short pauses inside one turn', () => {
    const { state } = simulate(talk(0, 30_000), 30_000)
    expect(state.turnStartMs).toBe(0)
    expect(currentTurnMs(state, 30_000)).toBeGreaterThanOrEqual(29_000)
  })

  it('ends the turn after a pause of TURN_PAUSE_MS', () => {
    const { state } = simulate([[0, 10_000]], 10_000 + TURN_PAUSE_MS + 100)
    expect(state.turnStartMs).toBeNull()
    expect(state.longestTurnMs).toBe(10_000)
  })

  it('pulses once a turn passes MONOLOGUE_MS, and stops when the turn ends', () => {
    const { state, pulsing } = simulate(talk(0, 75_000), 80_000)
    expect(pulsing.length).toBeGreaterThan(0)
    expect(pulsing[0]).toBeGreaterThanOrEqual(MONOLOGUE_MS)
    expect(pulsing[0]).toBeLessThan(MONOLOGUE_MS + 1_000)
    expect(Math.max(...pulsing)).toBeLessThan(75_000 + TURN_PAUSE_MS + 400)
    expect(state.monologues).toBe(1)
    expect(state.longestTurnMs).toBeGreaterThanOrEqual(74_000)
  })

  it('counts each monologue once, and a second one separately', () => {
    const { state } = simulate([...talk(0, 70_000), ...talk(80_000, 65_000)], 150_000)
    expect(state.monologues).toBe(2)
  })

  it('counts a turn that ends just short of the limit as no monologue', () => {
    const { state, pulsing } = simulate([[0, MONOLOGUE_MS - 1_000]], MONOLOGUE_MS + 5_000)
    expect(pulsing).toEqual([])
    expect(state.monologues).toBe(0)
    expect(state.longestTurnMs).toBe(MONOLOGUE_MS - 1_000)
  })

  it('ignores a speech end without a start', () => {
    expect(stepMonologue(initialMonologue, { type: 'speechEnd', atMs: 500 }, 900)).toEqual(
      initialMonologue,
    )
  })
})

describe('flushMonologue', () => {
  it('does nothing between turns', () => {
    expect(flushMonologue(initialMonologue, 5_000)).toEqual(initialMonologue)
  })

  it('ends a turn in progress and keeps it if it was the longest', () => {
    const { state } = simulate(talk(0, 90_000), 50_000)
    const flushed = flushMonologue(state, 50_000)
    expect(flushed.turnStartMs).toBeNull()
    expect(flushed.longestTurnMs).toBeGreaterThanOrEqual(49_000)
    expect(flushed.monologues).toBe(0)
  })

  it('counts a monologue still in progress at the stop', () => {
    const { state } = simulate([[0, 120_000]], 61_000)
    expect(state.monologues).toBe(1)
    expect(flushMonologue(state, 61_000).monologues).toBe(1)
  })

  it('ends a paused turn where the speech stopped', () => {
    const { state } = simulate([[0, 8_000]], 9_000)
    expect(flushMonologue(state, 9_000).longestTurnMs).toBe(8_000)
  })
})

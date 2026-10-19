import { describe, expect, it } from 'vitest'
import {
  flushVoiceActivity,
  initialVoiceActivity,
  MIN_SPEECH_MS,
  SILENCE_HANGOVER_MS,
  stepVoiceActivity,
} from './voiceActivity'
import type { VoiceActivityEvent, VoiceActivityState } from './voiceActivity'

const FRAME_MS = 32

/** Runs a list of per-frame probabilities through the detector and collects the events. */
function run(probabilities: number[], start: VoiceActivityState = initialVoiceActivity) {
  let state = start
  const events: VoiceActivityEvent[] = []
  probabilities.forEach((p, i) => {
    const step = stepVoiceActivity(state, p, i * FRAME_MS, (i + 1) * FRAME_MS)
    state = step.state
    if (step.event) events.push(step.event)
  })
  return { state, events }
}

const frames = (count: number, probability: number) => Array<number>(count).fill(probability)

describe('stepVoiceActivity', () => {
  it('stays silent on silence', () => {
    const { state, events } = run(frames(50, 0.01))
    expect(events).toEqual([])
    expect(state.speaking).toBe(false)
  })

  it('confirms speech after MIN_SPEECH_MS and backdates the start', () => {
    const framesNeeded = MIN_SPEECH_MS / FRAME_MS
    const { state, events } = run([...frames(5, 0.0), ...frames(framesNeeded, 0.9)])
    expect(events).toEqual([{ type: 'speechStart', atMs: 5 * FRAME_MS }])
    expect(state.speaking).toBe(true)
  })

  it('ignores blips shorter than MIN_SPEECH_MS', () => {
    const blip = frames(MIN_SPEECH_MS / FRAME_MS - 1, 0.9)
    const { events } = run([...blip, 0.0, ...blip, 0.0])
    expect(events).toEqual([])
  })

  it('does not end speech during short pauses between words', () => {
    const shortPause = frames(SILENCE_HANGOVER_MS / FRAME_MS - 1, 0.05)
    const { state, events } = run([...frames(10, 0.9), ...shortPause, ...frames(10, 0.9)])
    expect(events).toEqual([{ type: 'speechStart', atMs: 0 }])
    expect(state.speaking).toBe(true)
  })

  it('ends speech after SILENCE_HANGOVER_MS, backdated to when the silence began', () => {
    const silence = frames(SILENCE_HANGOVER_MS / FRAME_MS, 0.05)
    const { state, events } = run([...frames(10, 0.9), ...silence])
    expect(events).toEqual([
      { type: 'speechStart', atMs: 0 },
      { type: 'speechEnd', atMs: 10 * FRAME_MS },
    ])
    expect(state.speaking).toBe(false)
  })

  it('uses hysteresis: in-between values keep the current state', () => {
    // 0.4 is below the start threshold but above the end threshold.
    expect(run(frames(20, 0.4)).events).toEqual([])
    const { state, events } = run([...frames(5, 0.9), ...frames(20, 0.4)])
    expect(events).toEqual([{ type: 'speechStart', atMs: 0 }])
    expect(state.speaking).toBe(true)
  })

  it('restarts the hangover countdown when speech resumes', () => {
    const almost = frames(SILENCE_HANGOVER_MS / FRAME_MS - 1, 0.05)
    const { events } = run([...frames(5, 0.9), ...almost, 0.9, ...almost])
    expect(events).toEqual([{ type: 'speechStart', atMs: 0 }])
  })

  it('treats NaN as silence', () => {
    expect(run(frames(10, Number.NaN)).events).toEqual([])
    const silence = frames(SILENCE_HANGOVER_MS / FRAME_MS, Number.NaN)
    expect(run([...frames(5, 0.9), ...silence]).state.speaking).toBe(false)
  })
})

describe('flushVoiceActivity', () => {
  it('does nothing when silent', () => {
    expect(flushVoiceActivity(initialVoiceActivity, 1000).event).toBeNull()
  })

  it('ends speech in progress at the stop time', () => {
    const { state } = run(frames(10, 0.9))
    expect(flushVoiceActivity(state, 320).event).toEqual({ type: 'speechEnd', atMs: 320 })
  })

  it('ends speech where an unconfirmed silence began', () => {
    const { state } = run([...frames(10, 0.9), ...frames(3, 0.05)])
    expect(flushVoiceActivity(state, 13 * FRAME_MS).event).toEqual({
      type: 'speechEnd',
      atMs: 10 * FRAME_MS,
    })
  })
})

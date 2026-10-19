import { describe, expect, it } from 'vitest'
import { createSession, endSession, liveMetrics, processFrame } from './session'
import type { SessionState } from './session'
import { SILENCE_HANGOVER_MS } from './voiceActivity'

const FRAME_MS = 32

function feed(state: SessionState, count: number, probability: number): SessionState {
  let next = state
  for (let i = 0; i < count; i++) next = processFrame(next, probability, FRAME_MS).state
  return next
}

describe('session', () => {
  it('starts empty', () => {
    expect(liveMetrics(createSession())).toEqual({
      elapsedMs: 0,
      speakingMs: 0,
      isSpeaking: false,
      talkRatio: 0,
    })
  })

  it('tracks talk time across speech and silence', () => {
    // 3.2 s speech, then 3.2 s silence.
    let state = feed(createSession(), 100, 0.9)
    expect(liveMetrics(state)).toMatchObject({ isSpeaking: true, speakingMs: 3_200 })

    state = feed(state, 100, 0.02)
    const metrics = liveMetrics(state)
    expect(metrics.isSpeaking).toBe(false)
    expect(metrics.elapsedMs).toBe(6_400)
    expect(metrics.speakingMs).toBe(3_200)
    expect(metrics.talkRatio).toBe(0.5)
  })

  it('counts the hangover as silence, not speech', () => {
    let state = feed(createSession(), 50, 0.9)
    state = feed(state, SILENCE_HANGOVER_MS / FRAME_MS - 1, 0.02)
    // Still "speaking" (the pause might be between words)…
    expect(liveMetrics(state).isSpeaking).toBe(true)
    state = feed(state, 1, 0.02)
    // …but once confirmed, the pause is not counted as speaking time.
    expect(liveMetrics(state).speakingMs).toBe(50 * FRAME_MS)
  })

  it('reports the event a frame triggered', () => {
    const state = feed(createSession(), 2, 0.9)
    expect(processFrame(state, 0.9, FRAME_MS).event).toEqual({ type: 'speechStart', atMs: 0 })
  })

  it('counts speech still in progress when the session ends', () => {
    let state = feed(createSession(), 100, 0.02)
    state = feed(state, 100, 0.9)
    expect(endSession(state)).toEqual({ durationMs: 6_400, speakingMs: 3_200, talkRatio: 0.5 })
  })

  it('summarizes an empty session as zeros', () => {
    expect(endSession(createSession())).toEqual({ durationMs: 0, speakingMs: 0, talkRatio: 0 })
  })
})

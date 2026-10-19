import { describe, expect, it } from 'vitest'
import { applyVoiceActivityEvent, initialTalkTime, speakingMsAt, talkRatio } from './talkTime'

describe('applyVoiceActivityEvent', () => {
  it('adds each finished segment', () => {
    let state = initialTalkTime
    state = applyVoiceActivityEvent(state, { type: 'speechStart', atMs: 1_000 })
    state = applyVoiceActivityEvent(state, { type: 'speechEnd', atMs: 4_000 })
    state = applyVoiceActivityEvent(state, { type: 'speechStart', atMs: 6_000 })
    state = applyVoiceActivityEvent(state, { type: 'speechEnd', atMs: 7_500 })
    expect(state).toEqual({ finishedSpeakingMs: 4_500, speechStartedAtMs: null })
  })

  it('ignores duplicate starts and ends', () => {
    let state = initialTalkTime
    state = applyVoiceActivityEvent(state, { type: 'speechEnd', atMs: 500 })
    state = applyVoiceActivityEvent(state, { type: 'speechStart', atMs: 1_000 })
    state = applyVoiceActivityEvent(state, { type: 'speechStart', atMs: 2_000 })
    state = applyVoiceActivityEvent(state, { type: 'speechEnd', atMs: 3_000 })
    state = applyVoiceActivityEvent(state, { type: 'speechEnd', atMs: 9_000 })
    expect(state.finishedSpeakingMs).toBe(2_000)
  })

  it('never counts negative time', () => {
    let state = applyVoiceActivityEvent(initialTalkTime, { type: 'speechStart', atMs: 5_000 })
    state = applyVoiceActivityEvent(state, { type: 'speechEnd', atMs: 4_000 })
    expect(state.finishedSpeakingMs).toBe(0)
  })
})

describe('speakingMsAt', () => {
  it('includes the segment in progress', () => {
    const state = { finishedSpeakingMs: 2_000, speechStartedAtMs: 10_000 }
    expect(speakingMsAt(state, 13_000)).toBe(5_000)
  })

  it('is just the finished total while silent', () => {
    expect(speakingMsAt({ finishedSpeakingMs: 2_000, speechStartedAtMs: null }, 99_000)).toBe(2_000)
  })
})

describe('talkRatio', () => {
  it('divides speaking time by elapsed time', () => {
    expect(talkRatio(30_000, 60_000)).toBe(0.5)
  })

  it('is 0 before any time has passed', () => {
    expect(talkRatio(0, 0)).toBe(0)
    expect(talkRatio(100, Number.NaN)).toBe(0)
  })

  it('is clamped to 0–1', () => {
    expect(talkRatio(70_000, 60_000)).toBe(1)
    expect(talkRatio(-5, 60_000)).toBe(0)
  })
})

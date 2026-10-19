import { describe, expect, it } from 'vitest'
import {
  applyTranscription,
  closeSession,
  createSession,
  liveMetrics,
  processFrame,
  summarizeSession,
} from './session'
import type { SessionState } from './session'
import type { SpeechChunk } from './speechChunks'
import { CHUNK_PAUSE_MS } from './speechChunks'
import { SILENCE_HANGOVER_MS } from './voiceActivity'

const FRAME_MS = 32

/** Feeds `count` frames; returns the new state and any chunks that closed. */
function feed(state: SessionState, count: number, probability: number) {
  let next = state
  const chunks: SpeechChunk[] = []
  for (let i = 0; i < count; i++) {
    const step = processFrame(next, probability, FRAME_MS)
    next = step.state
    if (step.chunk) chunks.push(step.chunk)
  }
  return { state: next, chunks }
}

const framesFor = (ms: number) => Math.ceil(ms / FRAME_MS)

describe('session', () => {
  it('starts empty', () => {
    expect(liveMetrics(createSession())).toEqual({
      elapsedMs: 0,
      speakingMs: 0,
      isSpeaking: false,
      talkRatio: 0,
      wordsPerMinute: null,
      pace: null,
      fillers: { total: 0, perMinute: null, top: [] },
    })
  })

  it('tracks talk time across speech and silence', () => {
    let { state } = feed(createSession(), 100, 0.9) // 3.2 s speech
    expect(liveMetrics(state)).toMatchObject({ isSpeaking: true, speakingMs: 3_200 })

    ;({ state } = feed(state, 100, 0.02)) // 3.2 s silence
    expect(liveMetrics(state)).toMatchObject({
      isSpeaking: false,
      elapsedMs: 6_400,
      speakingMs: 3_200,
      talkRatio: 0.5,
    })
  })

  it('counts the hangover as silence, not speech', () => {
    let { state } = feed(createSession(), 50, 0.9)
    ;({ state } = feed(state, SILENCE_HANGOVER_MS / FRAME_MS - 1, 0.02))
    expect(liveMetrics(state).isSpeaking).toBe(true)
    ;({ state } = feed(state, 1, 0.02))
    expect(liveMetrics(state).speakingMs).toBe(50 * FRAME_MS)
  })

  it('hands over a chunk to transcribe after a long pause', () => {
    const speech = feed(createSession(), 200, 0.9) // 6.4 s of speech
    expect(speech.chunks).toEqual([])
    const pause = feed(speech.state, framesFor(SILENCE_HANGOVER_MS + CHUNK_PAUSE_MS), 0.02)
    expect(pause.chunks).toEqual([{ startMs: 0, endMs: 6_400, speechMs: 6_400 }])
    expect(liveMetrics(pause.state).wordsPerMinute).toBeNull() // not transcribed yet
  })

  it('shows pace once the chunk is transcribed', () => {
    const speech = feed(createSession(), 250, 0.9) // 8 s of speech
    const pause = feed(speech.state, framesFor(SILENCE_HANGOVER_MS + CHUNK_PAUSE_MS), 0.02)
    const state = applyTranscription(pause.state, pause.chunks[0]!, { words: 20, fillers: {} }) // 20 words in 8 s
    expect(liveMetrics(state)).toMatchObject({ wordsPerMinute: 150, pace: 'good' })
  })

  it('closes the last sentence when the session stops', () => {
    let { state } = feed(createSession(), 100, 0.02)
    ;({ state } = feed(state, 100, 0.9))
    const closed = closeSession(state)
    expect(closed.chunk).toEqual({ startMs: 3_200, endMs: 6_400, speechMs: 3_200 })
    const summary = summarizeSession(
      applyTranscription(closed.state, closed.chunk!, { words: 8, fillers: { um: 1 } }),
    )
    expect(summary).toEqual({
      durationMs: 6_400,
      speakingMs: 3_200,
      talkRatio: 0.5,
      words: 8,
      wordsPerMinute: null, // 3.2 s is too little speech to judge pace
      fillers: { total: 1, perMinute: null, top: [{ filler: 'um', count: 1 }] },
    })
  })

  it('summarizes average pace over the session', () => {
    const speech = feed(createSession(), 250, 0.9)
    const pause = feed(speech.state, framesFor(SILENCE_HANGOVER_MS + CHUNK_PAUSE_MS), 0.02)
    const state = applyTranscription(pause.state, pause.chunks[0]!, { words: 30, fillers: {} }) // 30 words in 8 s
    expect(summarizeSession(closeSession(state).state)).toMatchObject({
      words: 30,
      wordsPerMinute: 225,
    })
  })

  it('summarizes an empty session as zeros', () => {
    const closed = closeSession(createSession())
    expect(closed.chunk).toBeNull()
    expect(summarizeSession(closed.state)).toEqual({
      durationMs: 0,
      speakingMs: 0,
      talkRatio: 0,
      words: 0,
      wordsPerMinute: null,
      fillers: { total: 0, perMinute: null, top: [] },
    })
  })

  it('ignores a transcript with more words than anyone could say', () => {
    const chunk = { startMs: 0, endMs: 10_000, speechMs: 10_000 }
    const glitch = applyTranscription(createSession(), chunk, { words: 500, fillers: { um: 9 } })
    expect(glitch).toEqual(createSession())
  })

  it('adds up fillers across chunks', () => {
    let state = createSession()
    const chunk = { startMs: 0, endMs: 20_000, speechMs: 20_000 }
    state = applyTranscription(state, chunk, { words: 50, fillers: { um: 2, like: 1 } })
    state = applyTranscription(
      state,
      { ...chunk, startMs: 30_000, endMs: 50_000 },
      {
        words: 50,
        fillers: { um: 1, 'you know': 2 },
      },
    )
    expect(liveMetrics(state).fillers).toEqual({
      total: 6,
      perMinute: 9, // 6 fillers in 40 s of speech
      top: [
        { filler: 'um', count: 3 },
        { filler: 'you know', count: 2 },
        { filler: 'like', count: 1 },
      ],
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  CHUNK_PAUSE_MS,
  flushChunker,
  initialChunker,
  MAX_CHUNK_MS,
  MIN_TRANSCRIBE_SPEECH_MS,
  stepChunker,
  TARGET_CHUNK_MS,
} from './speechChunks'
import type { ChunkerState, SpeechChunk } from './speechChunks'
import type { VoiceActivityEvent } from './voiceActivity'

const FRAME_MS = 32

/**
 * Simulates speech: a list of [startMs, endMs] segments, ticked frame by frame
 * until `untilMs`. Returns every chunk that closed, and the final state.
 */
function simulate(segments: Array<[number, number]>, untilMs: number) {
  const events = new Map<number, VoiceActivityEvent>()
  for (const [start, end] of segments) {
    // The detector reports speech a little after it happens (backdated), like the real one.
    events.set(Math.ceil((start + 96) / FRAME_MS) * FRAME_MS, { type: 'speechStart', atMs: start })
    events.set(Math.ceil((end + 320) / FRAME_MS) * FRAME_MS, { type: 'speechEnd', atMs: end })
  }
  let state: ChunkerState = initialChunker
  const chunks: SpeechChunk[] = []
  for (let now = FRAME_MS; now <= untilMs; now += FRAME_MS) {
    const step = stepChunker(state, events.get(now) ?? null, now)
    state = step.state
    if (step.chunk) chunks.push(step.chunk)
  }
  return { state, chunks }
}

describe('stepChunker', () => {
  it('keeps short pauses inside one chunk and closes after a long pause', () => {
    const { chunks, state } = simulate(
      [
        [1_000, 3_000],
        [3_800, 6_000], // 0.8 s pause: same phrase
      ],
      10_000,
    )
    expect(chunks).toEqual([{ startMs: 1_000, endMs: 6_000, speechMs: 4_200 }])
    expect(state.open).toBeNull()
  })

  it('splits at a pause of CHUNK_PAUSE_MS', () => {
    const { chunks } = simulate(
      [
        [0, 2_000],
        [2_000 + CHUNK_PAUSE_MS + 500, 6_000],
      ],
      12_000,
    )
    expect(chunks.map((c) => [c.startMs, c.endMs])).toEqual([
      [0, 2_000],
      [4_500, 6_000],
    ])
  })

  it('waits for the pause before closing, so the end is known', () => {
    const { chunks, state } = simulate([[0, 3_000]], 3_000 + CHUNK_PAUSE_MS - 100)
    expect(chunks).toEqual([])
    expect(state.open).not.toBeNull()
  })

  it('drops chunks with too little speech, where Whisper invents words', () => {
    const { chunks } = simulate([[1_000, 1_000 + MIN_TRANSCRIBE_SPEECH_MS - 100]], 8_000)
    expect(chunks).toEqual([])
  })

  it('closes a long monologue at the first pause after TARGET_CHUNK_MS', () => {
    // Sentences of 3 s with 0.5 s pauses, for 30 s.
    const segments: Array<[number, number]> = []
    for (let t = 0; t < 30_000; t += 3_500) segments.push([t, t + 3_000])
    const { chunks } = simulate(segments, 40_000)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    const [first] = chunks
    expect(first!.startMs).toBe(0)
    expect(first!.endMs - first!.startMs).toBeGreaterThanOrEqual(TARGET_CHUNK_MS)
    expect(first!.endMs - first!.startMs).toBeLessThan(TARGET_CHUNK_MS + 3_500)
  })

  it('cuts speech with no pauses at MAX_CHUNK_MS and carries on', () => {
    const { chunks, state } = simulate([[0, 60_000]], 59_000)
    // Cuts happen on the first 32 ms frame at or after the limit.
    const toFrame = (ms: number) => Math.ceil(ms / FRAME_MS) * FRAME_MS
    const firstCut = toFrame(MAX_CHUNK_MS)
    const secondCut = toFrame(firstCut + MAX_CHUNK_MS)
    expect(chunks.map((c) => [c.startMs, c.endMs])).toEqual([
      [0, firstCut],
      [firstCut, secondCut],
    ])
    expect(chunks[0]!.speechMs).toBe(firstCut)
    expect(state.open?.startMs).toBe(secondCut)
  })

  it('ignores a speech end without a start', () => {
    const step = stepChunker(initialChunker, { type: 'speechEnd', atMs: 500 }, 900)
    expect(step).toEqual({ state: { open: null }, chunk: null })
  })
})

describe('flushChunker', () => {
  it('returns nothing between chunks', () => {
    expect(flushChunker(initialChunker, 5_000)).toBeNull()
  })

  it('closes speech in progress at the stop time', () => {
    const { state } = simulate([[1_000, 60_000]], 5_000)
    expect(flushChunker(state, 5_000)).toEqual({ startMs: 1_000, endMs: 5_000, speechMs: 4_000 })
  })

  it('closes a paused chunk where its speech ended', () => {
    const { state } = simulate([[0, 3_000]], 4_000)
    expect(flushChunker(state, 4_000)).toEqual({ startMs: 0, endMs: 3_000, speechMs: 3_000 })
  })

  it('drops a final chunk that is too short', () => {
    const { state } = simulate([[0, 400]], 1_000)
    expect(flushChunker(state, 1_000)).toBeNull()
  })
})

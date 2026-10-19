import { describe, expect, it } from 'vitest'
import { AudioHistory } from './audioHistory'

// 1 sample per millisecond keeps the arithmetic readable.
const RATE_HZ = 1_000
const ramp = (from: number, count: number) =>
  Float32Array.from({ length: count }, (_, i) => from + i)

describe('AudioHistory', () => {
  it('returns the audio between two times', () => {
    const history = new AudioHistory(100, RATE_HZ)
    history.push(ramp(0, 50))
    expect(history.slice(10, 15)).toEqual(ramp(10, 5))
  })

  it('clips to what has been recorded so far', () => {
    const history = new AudioHistory(100, RATE_HZ)
    history.push(ramp(0, 20))
    expect(history.slice(-50, 5)).toEqual(ramp(0, 5))
    expect(history.slice(15, 999)).toEqual(ramp(15, 5))
  })

  it('wraps around and forgets audio older than its capacity', () => {
    const history = new AudioHistory(10, RATE_HZ)
    history.push(ramp(0, 7))
    history.push(ramp(7, 8)) // 15 samples into a buffer of 10
    expect(history.slice(0, 15)).toEqual(ramp(5, 10))
    expect(history.slice(8, 12)).toEqual(ramp(8, 4))
  })

  it('returns nothing for an empty or reversed range', () => {
    const history = new AudioHistory(10, RATE_HZ)
    history.push(ramp(0, 10))
    expect(history.slice(5, 5)).toHaveLength(0)
    expect(history.slice(8, 3)).toHaveLength(0)
  })

  it('returns a copy that later audio does not change', () => {
    const history = new AudioHistory(4, RATE_HZ)
    history.push(ramp(0, 4))
    const copy = history.slice(0, 4)
    history.push(ramp(100, 4))
    expect(copy).toEqual(ramp(0, 4))
  })

  it('converts milliseconds at the real sample rate', () => {
    const history = new AudioHistory(16_000, 16_000)
    history.push(ramp(0, 16_000))
    expect(history.slice(500, 501)).toEqual(ramp(8_000, 16))
  })

  it('forgets everything on reset', () => {
    const history = new AudioHistory(10, RATE_HZ)
    history.push(ramp(0, 10))
    history.reset()
    expect(history.slice(0, 10)).toHaveLength(0)
  })
})

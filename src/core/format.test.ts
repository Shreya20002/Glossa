import { describe, expect, it } from 'vitest'
import { formatDuration, formatPercent, formatSessionLength } from './format'

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(5_000)).toBe('0:05')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(59 * 60_000 + 59_000)).toBe('59:59')
  })

  it('adds hours from one hour up', () => {
    expect(formatDuration(60 * 60_000)).toBe('1:00:00')
    expect(formatDuration(2 * 60 * 60_000 + 3 * 60_000 + 4_000)).toBe('2:03:04')
  })

  it('drops partial seconds instead of rounding up', () => {
    expect(formatDuration(1_999)).toBe('0:01')
    expect(formatDuration(59_999)).toBe('0:59')
  })

  it('treats negative and non-finite input as zero', () => {
    expect(formatDuration(-1_000)).toBe('0:00')
    expect(formatDuration(Number.NaN)).toBe('0:00')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00')
  })
})

describe('formatPercent', () => {
  it('rounds to whole percent', () => {
    expect(formatPercent(0)).toBe('0%')
    expect(formatPercent(0.684)).toBe('68%')
    expect(formatPercent(0.996)).toBe('100%')
    expect(formatPercent(1)).toBe('100%')
  })

  it('clamps out-of-range values', () => {
    expect(formatPercent(-0.2)).toBe('0%')
    expect(formatPercent(1.3)).toBe('100%')
  })

  it('treats non-finite input as zero', () => {
    expect(formatPercent(Number.NaN)).toBe('0%')
    expect(formatPercent(Number.NEGATIVE_INFINITY)).toBe('0%')
  })
})

describe('formatSessionLength', () => {
  it('uses seconds under a minute', () => {
    expect(formatSessionLength(0)).toBe('0 sec')
    expect(formatSessionLength(24_400)).toBe('24 sec')
    expect(formatSessionLength(59_999)).toBe('59 sec')
  })

  it('rounds to whole minutes from one minute up', () => {
    expect(formatSessionLength(60_000)).toBe('1 min')
    expect(formatSessionLength(89_000)).toBe('1 min')
    expect(formatSessionLength(90_000)).toBe('2 min')
    expect(formatSessionLength(32 * 60_000)).toBe('32 min')
  })

  it('treats negative and non-finite input as zero', () => {
    expect(formatSessionLength(-1_000)).toBe('0 sec')
    expect(formatSessionLength(Number.NaN)).toBe('0 sec')
  })
})

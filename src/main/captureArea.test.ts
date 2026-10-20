import { describe, expect, it } from 'vitest'
import { toCaptureArea } from './captureArea'

describe('toCaptureArea', () => {
  it('rounds the edges outwards to whole pixels', () => {
    expect(toCaptureArea({ x: 28.4, y: 120.6, width: 352.2, height: 300.1 }, 420, 650)).toEqual({
      x: 28,
      y: 120,
      width: 353,
      height: 301,
    })
  })

  it('keeps the area inside the window', () => {
    expect(toCaptureArea({ x: -5, y: 600, width: 500, height: 100 }, 420, 650)).toEqual({
      x: 0,
      y: 600,
      width: 420,
      height: 50,
    })
  })

  it.each([
    ['nothing', undefined],
    ['a number', 42],
    ['missing sizes', { x: 0, y: 0 }],
    ['sizes in text', { x: 0, y: 0, width: '100', height: '100' }],
    ['an infinite size', { x: 0, y: 0, width: Infinity, height: 100 }],
    ['no width', { x: 10, y: 10, width: 0, height: 100 }],
    ['an area outside the window', { x: 500, y: 10, width: 100, height: 100 }],
  ])('rejects %s', (_problem, value) => {
    expect(toCaptureArea(value, 420, 650)).toBeNull()
  })
})

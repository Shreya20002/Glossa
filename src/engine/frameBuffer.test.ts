import { describe, expect, it } from 'vitest'
import { FrameBuffer } from './frameBuffer'

const ramp = (from: number, count: number) =>
  Float32Array.from({ length: count }, (_, i) => from + i)

describe('FrameBuffer', () => {
  it('returns nothing until a frame is full', () => {
    const buffer = new FrameBuffer(4)
    expect(buffer.push(ramp(0, 3))).toEqual([])
  })

  it('joins chunks across frame boundaries, in order', () => {
    const buffer = new FrameBuffer(4)
    expect(buffer.push(ramp(0, 3))).toEqual([])
    expect(buffer.push(ramp(3, 6))).toEqual([ramp(0, 4), ramp(4, 4)])
    expect(buffer.push(ramp(9, 3))).toEqual([ramp(8, 4)])
  })

  it('handles exact-size chunks', () => {
    const buffer = new FrameBuffer(4)
    expect(buffer.push(ramp(0, 4))).toEqual([ramp(0, 4)])
  })

  it('returns independent frames that later pushes do not overwrite', () => {
    const buffer = new FrameBuffer(2)
    const [first] = buffer.push(ramp(0, 2))
    buffer.push(ramp(10, 2))
    expect(first).toEqual(ramp(0, 2))
  })

  it('drops a partial frame on reset', () => {
    const buffer = new FrameBuffer(4)
    buffer.push(ramp(0, 3))
    buffer.reset()
    expect(buffer.push(ramp(100, 4))).toEqual([ramp(100, 4)])
  })
})

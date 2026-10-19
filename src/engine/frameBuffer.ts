/**
 * Collects audio chunks of any length into fixed-size frames, because the VAD
 * model only accepts exactly `frameSamples` samples at a time.
 */
export class FrameBuffer {
  private buffer: Float32Array
  private filled = 0

  constructor(private readonly frameSamples: number) {
    this.buffer = new Float32Array(frameSamples)
  }

  /** Adds samples and returns every frame they completed, in order. */
  push(samples: Float32Array): Float32Array[] {
    const frames: Float32Array[] = []
    let offset = 0
    while (offset < samples.length) {
      const count = Math.min(this.frameSamples - this.filled, samples.length - offset)
      this.buffer.set(samples.subarray(offset, offset + count), this.filled)
      this.filled += count
      offset += count
      if (this.filled === this.frameSamples) {
        frames.push(this.buffer)
        this.buffer = new Float32Array(this.frameSamples)
        this.filled = 0
      }
    }
    return frames
  }

  /** Drops any partial frame. */
  reset(): void {
    this.buffer = new Float32Array(this.frameSamples)
    this.filled = 0
  }
}

/**
 * Remembers the most recent audio, so that when a chunk of speech closes, its
 * audio can be cut out and transcribed. Older audio is overwritten as new
 * audio arrives (a "ring buffer"): nothing older than the capacity is kept,
 * and nothing is ever written to disk.
 */
export class AudioHistory {
  private readonly buffer: Float32Array
  /** Total samples ever pushed; sample i lives at buffer[i % capacity]. */
  private written = 0

  constructor(
    private readonly capacitySamples: number,
    private readonly sampleRateHz: number,
  ) {
    this.buffer = new Float32Array(capacitySamples)
  }

  push(samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
      this.buffer[(this.written + i) % this.capacitySamples] = samples[i]!
    }
    this.written += samples.length
  }

  /**
   * A copy of the audio between two times (ms since the session started),
   * clipped to what is still remembered.
   */
  slice(fromMs: number, toMs: number): Float32Array {
    const toSample = (ms: number) => Math.round((ms * this.sampleRateHz) / 1000)
    const oldest = Math.max(0, this.written - this.capacitySamples)
    const start = Math.max(oldest, toSample(fromMs))
    const end = Math.min(this.written, toSample(toMs))
    if (end <= start) return new Float32Array(0)
    const copy = new Float32Array(end - start)
    for (let i = start; i < end; i++) copy[i - start] = this.buffer[i % this.capacitySamples]!
    return copy
  }

  /** Forgets everything. */
  reset(): void {
    this.buffer.fill(0)
    this.written = 0
  }
}

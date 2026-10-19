// Runs on the browser's real-time audio thread (an "AudioWorklet"), not the
// page's main thread. It receives microphone audio 128 samples at a time,
// collects it into 512-sample chunks (32 ms at 16 kHz, the size the VAD model
// uses) and hands each chunk to the page.

// The audio thread has its own globals, which TypeScript's DOM types don't include.
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
  abstract process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void

const CHUNK_SAMPLES = 512

class CaptureProcessor extends AudioWorkletProcessor {
  private chunk = new Float32Array(CHUNK_SAMPLES)
  private filled = 0

  process(inputs: Float32Array[][]): boolean {
    const samples = inputs[0]?.[0]
    if (samples) {
      let offset = 0
      while (offset < samples.length) {
        const count = Math.min(CHUNK_SAMPLES - this.filled, samples.length - offset)
        this.chunk.set(samples.subarray(offset, offset + count), this.filled)
        this.filled += count
        offset += count
        if (this.filled === CHUNK_SAMPLES) {
          // Transfer (not copy) the buffer to the page, then start a fresh one.
          this.port.postMessage(this.chunk, [this.chunk.buffer])
          this.chunk = new Float32Array(CHUNK_SAMPLES)
          this.filled = 0
        }
      }
    }
    // Keep running until the page disconnects us.
    return true
  }
}

registerProcessor('glossa-capture', CaptureProcessor)

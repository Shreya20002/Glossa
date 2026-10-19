import * as ort from 'onnxruntime-node'

/** The model works on 16 kHz mono audio. */
export const VAD_SAMPLE_RATE_HZ = 16_000

/** Samples per frame the model expects at 16 kHz: 512 samples = 32 ms. */
export const VAD_FRAME_SAMPLES = 512

/** Silero v5+ also looks at the last 64 samples of the previous frame, for continuity. */
const CONTEXT_SAMPLES = 64

/** Shape of the model's recurrent "memory" tensor, carried from frame to frame. */
const STATE_DIMS = [2, 1, 128]

function emptyState(): ort.Tensor {
  return new ort.Tensor('float32', new Float32Array(2 * 1 * 128), STATE_DIMS)
}

/**
 * Runs the Silero voice activity detection model (https://github.com/snakers4/silero-vad).
 * Feed it consecutive 32 ms frames; it returns how likely each one is to contain speech.
 */
export class SileroVad {
  private state = emptyState()
  private context = new Float32Array(CONTEXT_SAMPLES)
  private readonly sampleRate = new ort.Tensor(
    'int64',
    BigInt64Array.from([BigInt(VAD_SAMPLE_RATE_HZ)]),
    [],
  )

  private constructor(private readonly session: ort.InferenceSession) {}

  static async load(modelPath: string): Promise<SileroVad> {
    // One thread is plenty for this small model (~0.3 ms per frame) and leaves
    // the CPU free for the speech recognition model added later.
    const session = await ort.InferenceSession.create(modelPath, {
      intraOpNumThreads: 1,
      interOpNumThreads: 1,
    })
    return new SileroVad(session)
  }

  /** Forgets previous audio. Call at the start of each session. */
  reset(): void {
    this.state = emptyState()
    this.context = new Float32Array(CONTEXT_SAMPLES)
  }

  /** Probability (0–1) that `frame` contains speech. Frames must be consecutive. */
  async speechProbability(frame: Float32Array): Promise<number> {
    if (frame.length !== VAD_FRAME_SAMPLES) {
      throw new Error(`Expected ${VAD_FRAME_SAMPLES} samples per frame, got ${frame.length}`)
    }
    const input = new Float32Array(CONTEXT_SAMPLES + VAD_FRAME_SAMPLES)
    input.set(this.context)
    input.set(frame, CONTEXT_SAMPLES)

    const result = await this.session.run({
      input: new ort.Tensor('float32', input, [1, input.length]),
      state: this.state,
      sr: this.sampleRate,
    })
    const output = result['output']
    const nextState = result['stateN']
    if (!output || !nextState) throw new Error('Unexpected output from the VAD model')

    this.state = nextState
    this.context = frame.slice(-CONTEXT_SAMPLES)
    return Number(output.data[0])
  }
}

import { env, pipeline } from '@huggingface/transformers'
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

/**
 * Runs the Whisper tiny.en speech recognition model (via transformers.js),
 * turning a chunk of speech (16 kHz mono) into text.
 *
 * Why tiny.en: in Glossa's spike it kept every "um" and "uh" (the larger
 * base.en deleted all of them), transcribed normal-pace speech word-perfectly,
 * and ran ~1.5× faster using ~150 MB less memory. See docs/architecture.md.
 */
export class SpeechRecognizer {
  private constructor(private readonly recognize: AutomaticSpeechRecognitionPipeline) {}

  /** Loads the model from `modelsDir/modelName`, a folder from `pnpm fetch-models`. */
  static async load(modelsDir: string, modelName: string): Promise<SpeechRecognizer> {
    // Golden rule 1: load models from disk only. Never download anything.
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = modelsDir
    const recognize = await pipeline('automatic-speech-recognition', modelName, {
      local_files_only: true,
      dtype: 'q8',
      // One thread is as fast as several for this small model and uses ~3×
      // less CPU, leaving room for the meeting app (measured in the spike).
      session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 },
    })
    return new SpeechRecognizer(recognize)
  }

  async transcribe(samples: Float32Array): Promise<string> {
    const output = await this.recognize(samples)
    const result = Array.isArray(output) ? output[0] : output
    return result?.text.trim() ?? ''
  }
}

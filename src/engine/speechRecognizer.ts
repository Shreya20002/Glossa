import {
  AutoProcessor,
  AutoTokenizer,
  Tensor,
  WhisperForConditionalGeneration,
  env,
} from '@huggingface/transformers'
import type { PreTrainedTokenizer, Processor } from '@huggingface/transformers'

/** Whisper's special tokens we need, read from the model's generation_config.json. */
interface WhisperTokens {
  decoder_start_token_id: number
  no_timestamps_token_id: number
  prev_sot_token_id: number
}

function whisperTokens(config: unknown): WhisperTokens {
  const c = config as Partial<Record<keyof WhisperTokens, unknown>>
  const ids = {
    decoder_start_token_id: c.decoder_start_token_id,
    no_timestamps_token_id: c.no_timestamps_token_id,
    prev_sot_token_id: c.prev_sot_token_id,
  }
  for (const [name, value] of Object.entries(ids)) {
    if (typeof value !== 'number') throw new Error(`Whisper model is missing ${name}`)
  }
  return ids as WhisperTokens
}

/**
 * The prompt Glossa gives Whisper. Whisper is trained on cleaned-up
 * transcripts and normally deletes hesitations; a prompt with plain "um" and
 * "uh" in an ordinary sentence shows it the style to keep. On real meetings
 * (`pnpm eval`) it took um/uh detection from 0% to about 80%. It has no topic
 * words, so it doesn't bias what Whisper thinks was said.
 */
export const FILLER_PROMPT = 'Um, so, uh, I was thinking that, um, we could, uh, try it.'

export interface SpeechRecognizerOptions {
  /**
   * Text Whisper treats as "what was said just before". Writing it in the
   * style you want (e.g. with fillers) nudges Whisper to keep that style.
   */
  prompt?: string
}

/**
 * Runs a Whisper speech recognition model (via transformers.js), turning a
 * chunk of speech (16 kHz mono) into text.
 *
 * Why tiny.en: with FILLER_PROMPT it caught slightly more ums and uhs than
 * base.en, and it runs ~1.5× faster using ~150 MB less memory. See
 * docs/architecture.md.
 */
export class SpeechRecognizer {
  private constructor(
    private readonly processor: Processor,
    private readonly tokenizer: PreTrainedTokenizer,
    private readonly model: WhisperForConditionalGeneration,
    private readonly startTokens: number[],
  ) {}

  /** Loads the model from `modelsDir/modelName`, a folder from `pnpm fetch-models`. */
  static async load(
    modelsDir: string,
    modelName: string,
    options: SpeechRecognizerOptions = {},
  ): Promise<SpeechRecognizer> {
    // Golden rule 1: load models from disk only. Never download anything.
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = modelsDir
    const fromDisk = { local_files_only: true }
    const processor = await AutoProcessor.from_pretrained(modelName, fromDisk)
    const tokenizer = await AutoTokenizer.from_pretrained(modelName, fromDisk)
    const model = (await WhisperForConditionalGeneration.from_pretrained(modelName, {
      ...fromDisk,
      dtype: 'q8',
      // One thread is as fast as several for this small model and uses ~3×
      // less CPU, leaving room for the meeting app (measured in the spike).
      session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 },
    })) as WhisperForConditionalGeneration

    // English-only Whisper starts from <|startoftranscript|><|notimestamps|>.
    // A prompt goes before that, after <|startofprev|>.
    const tokens = whisperTokens(model.generation_config)
    const start = [tokens.decoder_start_token_id, tokens.no_timestamps_token_id]
    const startTokens = options.prompt
      ? [
          tokens.prev_sot_token_id,
          ...tokenizer.encode(` ${options.prompt.trim()}`, { add_special_tokens: false }),
          ...start,
        ]
      : start
    return new SpeechRecognizer(processor, tokenizer, model, startTokens)
  }

  async transcribe(samples: Float32Array): Promise<string> {
    const { input_features } = (await this.processor(samples)) as { input_features: Tensor }
    // transformers.js's types mark `generation_config` as required, but at
    // runtime it's optional and defaults to the model's own, which we want.
    const output = await this.model.generate({
      inputs: input_features,
      decoder_input_ids: this.startTokens,
      max_new_tokens: 200,
    } as Parameters<WhisperForConditionalGeneration['generate']>[0])
    if (!(output instanceof Tensor)) throw new Error('Unexpected output from the Whisper model')
    const [sequence] = output.tolist() as Array<Array<number | bigint>>
    const generated = (sequence ?? []).map(Number).slice(this.startTokens.length)
    return this.tokenizer.decode(generated, { skip_special_tokens: true }).trim()
  }
}

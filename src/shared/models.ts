/**
 * Where each model lives inside models/ (downloaded by `pnpm fetch-models`,
 * bundled into installers). Must match the list in scripts/fetch-models.mjs.
 */
export const ModelFile = {
  voiceActivity: 'silero_vad.onnx',
  /** A folder in the layout transformers.js expects (config, tokenizer, onnx/). */
  speechRecognition: 'whisper-tiny.en',
} as const

/** Files that must exist before a session can start. */
export const REQUIRED_MODEL_FILES = [
  ModelFile.voiceActivity,
  `${ModelFile.speechRecognition}/onnx/encoder_model_quantized.onnx`,
  `${ModelFile.speechRecognition}/onnx/decoder_model_merged_quantized.onnx`,
] as const

// Downloads the AI models Glossa needs into models/ and verifies each one.
//
// Run it with `pnpm fetch-models`. It's safe to run again: files that are
// already present and correct are skipped.
//
// Every model is pinned to an exact source URL (a git commit, never a branch)
// and a SHA-256 checksum, a fingerprint of the file's exact bytes. If a file
// is changed in any way, even by one byte, the checksum won't match and the
// script refuses it. This is the only network code in Glossa, and it runs only
// on developer machines and in CI, never inside the app.

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODELS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'models')

/** Whisper tiny.en converted to ONNX, pinned to an exact Hugging Face commit. */
const WHISPER_REPO =
  'https://huggingface.co/onnx-community/whisper-tiny.en/resolve/2575352d61be1bf7225cf8f8b268a4678025fc58'
const WHISPER = 'Whisper tiny.en: turns speech into words (OpenAI, Apache-2.0 license)'

/**
 * The model files Glossa ships. To update one, change BOTH its url and sha256,
 * and update the credit in NOTICE if the license changes.
 * Paths must match src/shared/models.ts.
 */
const MODELS = [
  {
    file: 'silero_vad.onnx',
    description: 'Silero VAD v6.2.3: detects when someone is speaking (MIT license)',
    url: 'https://raw.githubusercontent.com/snakers4/silero-vad/5cd7945676eb32225748052e2e6a0580e4686a08/src/silero_vad/data/silero_vad.onnx',
    sha256: '1a153a22f4509e292a94e67d6f9b85e8deb25b4988682b7e174c65279d8788e3',
  },
  ...[
    ['config.json', '251ea843b5901a99efa58c0b99b8052c6019aa3e7d2baf46693a1128ff606233'],
    ['generation_config.json', '7b2e8451ed5f118e75fdd991409d72119d21d2fef1eba9723f68fb9c57fe5dc9'],
    [
      'preprocessor_config.json',
      'a6a76d28c93edb273669eb9e0b0636a2bddbb1272c3261e47b7ca6dfdbac1b8d',
    ],
    ['tokenizer.json', '5eb60cec1e77aeeb6869a2bb5a8e01a84c3fe5d072d75369343021fe6f5310d0'],
    ['tokenizer_config.json', '93879c3dccdd4b976f709acd85b44778873f30c275e67026f30ca1e4c975230c'],
    [
      'onnx/encoder_model_quantized.onnx',
      'e93ec822f16a8fd264e7de972ad17d615ea7334b75a52d54c50c2e18dd503a25',
    ],
    [
      'onnx/decoder_model_merged_quantized.onnx',
      'c0592d0749413c960569e1c7fb806b060d5d18f3ebad4a95cbf9a77dc6e9be52',
    ],
  ].map(([path, sha256]) => ({
    file: `whisper-tiny.en/${path}`,
    description: WHISPER,
    url: `${WHISPER_REPO}/${path}`,
    sha256,
  })),
]

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function readIfExists(path) {
  try {
    return await readFile(path)
  } catch {
    return undefined
  }
}

async function fetchModel(model) {
  const target = join(MODELS_DIR, model.file)
  const existing = await readIfExists(target)
  if (existing && sha256(existing) === model.sha256) {
    console.log(`✓ ${model.file} is already up to date`)
    return
  }

  console.log(`↓ Downloading ${model.file}: ${model.description}`)
  const response = await fetch(model.url)
  if (!response.ok) {
    throw new Error(`Download failed for ${model.file}: HTTP ${response.status}`)
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  const actual = sha256(bytes)
  if (actual !== model.sha256) {
    throw new Error(
      `Checksum mismatch for ${model.file}. The file is not the one Glossa expects.\n` +
        `  expected ${model.sha256}\n  received ${actual}`,
    )
  }

  // Write to a temporary name first, so an interrupted download never leaves
  // a half-written model behind.
  const partial = `${target}.part`
  await mkdir(dirname(target), { recursive: true })
  await writeFile(partial, bytes)
  await rename(partial, target)
  const size =
    bytes.length >= 1e6
      ? `${(bytes.length / 1e6).toFixed(1)} MB`
      : `${(bytes.length / 1e3).toFixed(0)} kB`
  console.log(`✓ ${model.file} saved (${size}, checksum verified)`)
}

await mkdir(MODELS_DIR, { recursive: true })
try {
  for (const model of MODELS) await fetchModel(model)
} catch (error) {
  await Promise.all(MODELS.map((m) => rm(join(MODELS_DIR, `${m.file}.part`), { force: true })))
  console.error(`✗ ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
